import { useEffect, useState, useCallback } from "react";
import type { Driver, Route, Shift, Trip, Vehicle } from "./schedule";

export interface Data { routes: Route[]; drivers: Driver[]; vehicles: Vehicle[]; trips: Trip[]; shifts: Shift[]; filled?: string[] }
const KEY = "programacao-viagens-v1";
export const uid = () => Math.random().toString(36).slice(2, 10);

/** Frota e motoristas da planilha Pasta1.xlsx (motorista e veículo NÃO são fixos entre si). */
export const DRIVER_NAMES = [
  "ALEX CERQUEIRA BISPO", "ALIXANDRE GONÇALVES", "ANTONIO MARCOS BRITO", "ANTONIO MARCOS DO CARMO", "ANTONIO RANULFO NETO",
  "CRISTIANO BATISTA", "CRISTIANO SOUZA", "EDMILSON SANTOS DA SILVA", "EDNEI MOTA", "ELIELSON DE JESUS", "ELISON BISPO",
  "ERIOVALDO MONTEIRO", "HIPOLITO PEREIRA", "JARBAS MATOS DA SILVA", "JOSIMAR BARBOSA", "KLEITON SILVA DE JESUS",
  "LEANDRO DE JESUS ALMEIDA", "LELIVALDO DA SILVA", "LUCIANO AMERICO", "NEIDSON BASTOS", "PAULO HENRIQUE TOSTA",
  "RONALDO DE JESUS", "SAYMON OLIVEIRA", "TIAGO BULHOSA",
];
export const PLATES = [
  "AQT2B77", "AUD4427", "AUE8084", "NOH8817", "OWE1576", "TSX6J35", "QGS0619", "QGJ5307", "QGM5987", "QGM7787", "QGN2788",
  "QGO5953", "QGO3096", "QGB3659", "TSW9G25", "RGL5J57", "RGL6A47", "RGL6A87", "QGK9G08", "QGF6164", "FCB4403", "OWC9532",
];
const RENAME: Record<string, string> = {
  "PAULO H.": "PAULO HENRIQUE TOSTA", TIAGO: "TIAGO BULHOSA", EDMILSON: "EDMILSON SANTOS DA SILVA", JARBAS: "JARBAS MATOS DA SILVA",
  HIPOLITO: "HIPOLITO PEREIRA", ALEX: "ALEX CERQUEIRA BISPO", "CRISTIANO S.": "CRISTIANO SOUZA", NEIDSON: "NEIDSON BASTOS",
  LEANDRO: "LEANDRO DE JESUS ALMEIDA", LUCIANO: "LUCIANO AMERICO", LELIVALDO: "LELIVALDO DA SILVA", RANULFO: "ANTONIO RANULFO NETO",
};

/** Garante que todos os motoristas/placas da planilha existam, sem duplicar. */
export function withFleet(d: Data): Data {
  const drivers = d.drivers.map((x) => ({ ...x, name: RENAME[x.name] ?? x.name }));
  for (const name of DRIVER_NAMES) if (!drivers.some((x) => x.name === name)) drivers.push({ id: uid(), name });
  const vehicles = [...d.vehicles];
  for (const plate of PLATES) if (!vehicles.some((x) => x.plate === plate)) vehicles.push({ id: uid(), plate });
  drivers.sort((a, b) => a.name.localeCompare(b.name));
  return { ...d, drivers, vehicles };
}

function seed(): Data {
  const r = (code: string, days: number): Route => ({ id: uid(), code, days });
  const routes = [r("PM_FEC_SSA", 0), r("CO_FEC_SSA", 0), r("PM_FEC_01", 3), r("PM_FEC_02", 2), r("PM_FEC_03", 2),
    r("PM_FEC_04", 3), r("PM_FEC_05", 0), r("PM_FEC_06", 0), r("PM_FEC_07", 5), r("PM_FEC_08", 2), r("PM_FEC_09", 3), r("PM_FEC_10", 2)];
  const names = ["PAULO HENRIQUE TOSTA", "TIAGO BULHOSA", "EDMILSON SANTOS DA SILVA", "JARBAS MATOS DA SILVA", "HIPOLITO PEREIRA", "ALEX CERQUEIRA BISPO",
    "CRISTIANO SOUZA", "NEIDSON BASTOS", "LEANDRO DE JESUS ALMEIDA", "LUCIANO AMERICO", "LELIVALDO DA SILVA", "ANTONIO RANULFO NETO"];
  const plates = ["OWC9532", "FCB4403", "QGF6164", "QGO5953", "AUD4427", "RGL6A47", "QGK9G08", "QGB3659", "TSX6J35", "AQT2B77", "QGM5987", "QGM7787"];
  const base = withFleet({ routes, drivers: [], vehicles: [], trips: [], shifts: [] });
  const dId = (n: string) => base.drivers.find((x) => x.name === n)!.id;
  const vId = (p: string) => base.vehicles.find((x) => x.plate === p)!.id;
  const date = "2026-10-16";
  const trips: Trip[] = routes.map((rt, i) => ({
    id: uid(), date, orders: i < 2 ? [] : ["2026287", "2026288"], routeId: rt.id, vehicleId: vId(plates[i]!),
    driverId: dId(names[i]!), status: "CARREGANDO", days: rt.days, time: i < 2 ? "08:00" : i === 7 ? "07:00" : "06:00",
  }));
  return { ...base, trips, shifts: [{ date, time: "08:00", names: "MARCOS - RONALDO" }], filled: [date] };
}

export function useData() {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    setData(raw ? withFleet(JSON.parse(raw)) : seed());
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

/** Preenche uma data com as rotas previstas (uma única vez por data; exclusões manuais são respeitadas). */
export function autofill(d: Data, date: string, codes: string[]): Data {
  if (d.filled?.includes(date)) return d;
  const add: Trip[] = [];
  for (const code of codes) {
    const r = d.routes.find((x) => x.code.toUpperCase() === code);
    if (!r || d.trips.some((t) => t.date === date && t.routeId === r.id)) continue;
    add.push({ id: uid(), date, orders: [], routeId: r.id, vehicleId: "", driverId: "", status: "PROGRAMADO", days: r.days,
      time: code.endsWith("_SSA") ? "08:00" : "06:00" });
  }
  return { ...d, trips: [...d.trips, ...add], filled: [...(d.filled ?? []), date] };
}
