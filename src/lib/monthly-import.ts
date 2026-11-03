import type { Data } from "./store";
import type { Trip, Unavailability, UnavailabilityReason } from "./schedule";
import { addDaysISO } from "./schedule";

export type Cell = string | number | null | undefined;
export interface MonthlyRow { driver: string; plate: string; days: Cell[] }
export interface MonthlyPreview { trips: number; offs: number; newDrivers: string[]; newPlates: string[]; skipped: number }

const MONTHS = ["JANEIRO", "FEVEREIRO", "MARCO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
export const NOTE = "Escala mensal";

/** Detecta "yyyy-mm" no título (ex.: "ESCALA MOTORISTA NOVEMBRO- 2026"). */
export function detectMonth(title: string): string | null {
  const t = norm(title);
  const m = MONTHS.findIndex((x) => t.includes(x));
  const y = t.match(/20\d\d/)?.[0];
  return m >= 0 && y ? `${y}-${String(m + 1).padStart(2, "0")}` : null;
}

/** Linha 1: título em A e números dos dias a partir da coluna D; linhas de motorista têm nome em A, placa em C. */
export function parseMatrix(rows: Cell[][]): { month: string | null; rows: MonthlyRow[] } {
  const header = rows[0] ?? [];
  const month = detectMonth(String(header[0] ?? ""));
  const out: MonthlyRow[] = [];
  for (const r of rows.slice(2)) {
    const name = String(r[0] ?? "").trim();
    if (!name || /^ROTA\b/i.test(name)) continue;
    const days = r.slice(3);
    if (!days.some((c) => c !== null && c !== undefined && String(c).trim() !== "")) continue;
    out.push({ driver: name, plate: String(r[2] ?? "").trim().toUpperCase(), days });
  }
  return { month, rows: out };
}

function dist(a: string, b: string) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]!; d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = d[j]!;
      d[j] = Math.min(d[j]! + 1, d[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return d[b.length]!;
}

/** Mesmo primeiro nome (aceita 1 letra de diferença) e pelo menos mais um nome em comum. */
export function matchDriver(name: string, drivers: Data["drivers"]) {
  const [first = "", ...rest] = norm(name).split(" ");
  let best: { id: string; score: number } | null = null;
  for (const d of drivers) {
    const [f = "", ...r] = norm(d.name).split(" ");
    if (dist(first, f) > 1) continue;
    const common = rest.filter((x) => (x.length > 2 && r.includes(x)) || (x.length === 1 && r.some((y) => y.startsWith(x)))).length;
    if (common === 0 && (rest.length > 0 && r.length > 0)) continue;
    const score = common * 10 - dist(first, f);
    if (!best || score > best.score) best = { id: d.id, score };
  }
  return best?.id;
}

const cellCode = (c: Cell): { route?: string; off?: UnavailabilityReason } => {
  const s = norm(String(c ?? ""));
  if (s === "F") return { off: "FOLGA" };
  if (s.startsWith("FERIAS")) return { off: "FERIAS" };
  if (s.startsWith("ATESTADO")) return { off: "ATESTADO" };
  const n = Number(s);
  if (Number.isInteger(n) && n >= 1 && n <= 10) return { route: `PM_FEC_${String(n).padStart(2, "0")}` };
  return {};
};

/** Substitui as viagens PM_FEC_01..10 e as folgas da escala do mês; rotas SSA não são criadas. */
export function applyMonthly(d: Data, month: string, rows: MonthlyRow[], newId: () => string): { data: Data; preview: MonthlyPreview } {
  const [y = 0, m = 1] = month.split("-").map(Number);
  const total = new Date(y, m, 0).getDate();
  const dates = Array.from({ length: total }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  const first = dates[0]!, last = dates[total - 1]!;
  const drivers = [...d.drivers], vehicles = [...d.vehicles];
  const newDrivers: string[] = [], newPlates: string[] = [];
  const pmRoutes = new Set(d.routes.filter((r) => /^PM_FEC_(0[1-9]|10)$/i.test(r.code)).map((r) => r.id));
  const trips: Trip[] = d.trips.filter((t) => !(t.date >= first && t.date <= last && pmRoutes.has(t.routeId)));
  const blocks: Unavailability[] = (d.unavailabilities ?? []).filter((b) => !(b.notes === NOTE && b.startDate >= first && b.endDate <= last));
  let added = 0, offs = 0, skipped = 0;
  for (const row of rows) {
    let driverId = matchDriver(row.driver, drivers);
    if (!driverId) { driverId = newId(); drivers.push({ id: driverId, name: row.driver.toUpperCase() }); newDrivers.push(row.driver); }
    let vehicleId = "";
    if (row.plate) {
      vehicleId = vehicles.find((v) => v.plate.toUpperCase() === row.plate)?.id ?? "";
      if (!vehicleId) { vehicleId = newId(); vehicles.push({ id: vehicleId, plate: row.plate }); newPlates.push(row.plate); }
    }
    let open: Unavailability | null = null;
    dates.forEach((date, i) => {
      const { route, off } = cellCode(row.days[i]);
      if (off) {
        if (open && open.reason === off && addDaysISO(open.endDate, 1) === date) open.endDate = date;
        else { open = { id: newId(), resourceType: "driver", resourceId: driverId, reason: off, startDate: date, endDate: date, notes: NOTE }; blocks.push(open); offs++; }
        return;
      }
      open = null;
      if (!route) return;
      const r = d.routes.find((x) => x.code.toUpperCase() === route);
      if (!r) { skipped++; return; }
      trips.push({ id: newId(), date, orders: [], routeId: r.id, vehicleId, driverId, status: "PROGRAMADO", days: r.days, time: "06:00" });
      added++;
    });
  }
  drivers.sort((a, b) => a.name.localeCompare(b.name));
  const filled = Array.from(new Set([...(d.filled ?? []), ...dates]));
  return {
    data: { ...d, drivers, vehicles, trips, unavailabilities: blocks, filled },
    preview: { trips: added, offs, newDrivers, newPlates, skipped },
  };
}
