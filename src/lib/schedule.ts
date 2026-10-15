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
