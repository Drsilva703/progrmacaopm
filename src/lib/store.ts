import { useEffect, useState, useCallback } from "react";
import type { Driver, Route, Shift, Trip, Vehicle } from "./schedule";

export interface Data { routes: Route[]; drivers: Driver[]; vehicles: Vehicle[]; trips: Trip[]; shifts: Shift[] }
const KEY = "programacao-viagens-v1";
export const uid = () => Math.random().toString(36).slice(2, 10);

function seed(): Data {
  const r = (code: string, days: number): Route => ({ id: uid(), code, days });
  const routes = [r("PM_FEC_SSA", 0), r("CO_FEC_SSA", 0), r("PM_FEC_01", 3), r("PM_FEC_02", 2), r("PM_FEC_03", 2),
    r("PM_FEC_04", 3), r("PM_FEC_05", 0), r("PM_FEC_06", 0), r("PM_FEC_07", 5), r("PM_FEC_08", 2), r("PM_FEC_09", 3), r("PM_FEC_10", 2)];
  const names = ["PAULO H.", "TIAGO", "EDMILSON", "JARBAS", "HIPOLITO", "ALEX", "CRISTIANO S.", "NEIDSON", "LEANDRO", "LUCIANO", "LELIVALDO", "RANULFO"];
  const plates = ["OWC9532", "FCB4403", "QGF6164", "QGO5953", "AUD4427", "RGL6A47", "QGK9G08", "QGB3659", "TSX6J35", "AQT2B77", "QGM5987", "QGM7787"];
  const drivers = names.map((name) => ({ id: uid(), name }));
  const vehicles = plates.map((plate) => ({ id: uid(), plate }));
  const date = "2026-10-16";
  const trips: Trip[] = routes.map((rt, i) => ({
    id: uid(), date, orders: i < 2 ? [] : ["2026287", "2026288"], routeId: rt.id, vehicleId: vehicles[i].id,
    driverId: drivers[i].id, status: "CARREGANDO", days: rt.days, time: i < 2 ? "08:00" : i === 7 ? "07:00" : "06:00",
  }));
  return { routes, drivers, vehicles, trips, shifts: [{ date, time: "08:00", names: "MARCOS - RONALDO" }] };
}

export function useData() {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    setData(raw ? JSON.parse(raw) : seed());
  }, []);
  const update = useCallback((fn: (d: Data) => Data) => {
    setData((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  return { data, update };
}
