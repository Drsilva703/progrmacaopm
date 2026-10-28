export type Status = "PROGRAMADO" | "CARREGANDO" | "EM ROTA" | "CONCLUÍDO" | "CANCELADO";
export const STATUSES: Status[] = ["PROGRAMADO", "CARREGANDO", "EM ROTA", "CONCLUÍDO", "CANCELADO"];

export interface Route { id: string; code: string; days: number }
export interface Driver { id: string; name: string }
export interface Vehicle { id: string; plate: string }
export interface Trip {
  id: string;
  date: string; // yyyy-mm-dd (saída)
  orders: string[];
  routeId: string;
  vehicleId: string;
  driverId: string;
  status: Status;
  days: number; // duração
  time: string; // HH:MM
}
export interface Shift { date: string; time: string; names: string }

export type UnavailabilityReason = "OFICINA" | "FOLGA" | "ATESTADO" | "FERIAS";
export interface Unavailability {
  id: string;
  resourceType: "driver" | "vehicle";
  resourceId: string;
  reason: UnavailabilityReason;
  startDate: string;
  endDate: string;
  notes: string;
}

/** Both ends are inclusive; a trip must be free throughout its entire period. */
export function resourceBlocks(blocks: Unavailability[] | undefined, type: Unavailability["resourceType"], id: string, start: string, end = start) {
  if (!id) return [];
  return (blocks ?? []).filter(b => b.resourceType === type && b.resourceId === id && b.startDate <= end && start <= b.endDate);
}

export function tripBlocks(trip: Trip, blocks: Unavailability[] | undefined) {
  if (trip.status === "CANCELADO") return { driver: [], vehicle: [] };
  const end = arrivalDate(trip.date, trip.days);
  return {
    driver: resourceBlocks(blocks, "driver", trip.driverId, trip.date, end),
    vehicle: resourceBlocks(blocks, "vehicle", trip.vehicleId, trip.date, end),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = (s: string) => {
  const [y = 0, m = 1, d = 1] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDaysISO = (s: string, n: number) => {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

/** Chegada: a saída conta como 1º dia (planilha: 3 dias saindo 16/10 → chegada 18/10; 0 dias → mesmo dia). */
export const arrivalDate = (date: string, days: number) => addDaysISO(date, Math.max(days - 1, 0));
/** Recurso fica livre no dia seguinte à chegada (ou no mesmo dia para rotas de 0 dias). */
export const availableFrom = (date: string, days: number) =>
  days <= 0 ? date : addDaysISO(arrivalDate(date, days), 1);

const overlaps = (a: Trip, b: Trip) =>
  a.date <= arrivalDate(b.date, b.days) && b.date <= arrivalDate(a.date, a.days);

export function findConflicts(trip: Trip, trips: Trip[]) {
  const others = trips.filter((t) => t.id !== trip.id && t.status !== "CANCELADO" && overlaps(t, trip));
  return {
    driver: trip.driverId ? others.filter((t) => t.driverId === trip.driverId) : [],
    vehicle: trip.vehicleId ? others.filter((t) => t.vehicleId === trip.vehicleId) : [],
  };
}

export const WEEKDAYS = ["DOMINGO", "SEGUNDA-FEIRA", "TERÇA-FEIRA", "QUARTA-FEIRA", "QUINTA-FEIRA", "SEXTA-FEIRA", "SÁBADO"];
export const weekday = (s: string): string => WEEKDAYS[fromISO(s).getDay()] ?? "";
export const fmtBR = (s: string) => {
  const [y = "", m = "", d = ""] = s.split("-");
  return `${d}/${m}/${y.slice(2)}`;
};

/** Rotas previstas por dia da semana: SSA seg–sáb; PM 01–10 seg/qua/sex; PM 04–06 ter/qui/sáb; domingo nada. */
export function plannedRouteCodes(date: string): string[] {
  const wd = fromISO(date).getDay();
  if (wd === 0) return [];
  const pm = wd % 2 === 1 ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [4, 5, 6];
  return ["PM_FEC_SSA", "CO_FEC_SSA", ...pm.map((n) => `PM_FEC_${String(n).padStart(2, "0")}`)];
}
