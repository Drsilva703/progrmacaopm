import { useEffect, useState, useCallback, useRef } from "react";
import type { Driver, Route, Shift, Trip, Vehicle } from "./schedule";
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { saveChange, type Change, type Snapshot, type ScheduleTransport } from './cloud-sync';

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

function decode(payload: Json): Data {
  const d = payload as unknown as Data;
  if (!d || !['routes', 'drivers', 'vehicles', 'trips', 'shifts'].every(k => Array.isArray(d[k as keyof Data]))) {
    throw new Error('Não foi possível ler a programação.');
  }
  return d;
}

const transport: ScheduleTransport = {
  async read() {
    const { data, error } = await supabase.from('shared_schedule').select('payload,revision').eq('id', 'main').single();
    if (error) throw error;
    return { payload: decode(data.payload), revision: data.revision };
  },
  async compareAndSave(next, revision) {
    const { data, error } = await supabase.from('shared_schedule')
      .update({ payload: next as unknown as Json }).eq('id', 'main').eq('revision', revision)
      .select('payload,revision').maybeSingle();
    if (error) throw error;
    return data ? { payload: decode(data.payload), revision: data.revision } : null;
  },
};

export function useData() {
  const [data, setData] = useState<Data | null>(null);
  const [status, setStatus] = useState('Conectando à nuvem…');
  const [error, setError] = useState('');
  const [legacy, setLegacy] = useState<Data | null>(null);
  const latest = useRef<Snapshot | null>(null);
  const visible = useRef<Data | null>(null);
  const queue = useRef<Change[]>([]);
  const saving = useRef(false);
  const alive = useRef(false);

  const refresh = useCallback(async () => {
    if (saving.current || queue.current.length) return;
    try {
      const snapshot = await transport.read();
      if (!alive.current || saving.current || queue.current.length) return;
      if (latest.current && snapshot.revision < latest.current.revision) return;
      latest.current = snapshot;
      visible.current = snapshot.payload;
      setData(snapshot.payload);
      setStatus('Salvo na nuvem');
      setError('');
    } catch {
      if (alive.current) setError('Sem conexão com a nuvem. Verifique sua internet e tente novamente.');
    }
  }, []);

  const flush = useCallback(async () => {
    if (saving.current) return;
    saving.current = true;
    setError('');
    setStatus('Salvando…');
    try {
      while (queue.current.length) {
        const change = queue.current[0];
        if (!change) break;
        const saved = await saveChange(transport, change);
        latest.current = saved;
        queue.current.shift();
        visible.current = queue.current.reduce((d, fn) => fn(d), saved.payload);
        if (alive.current) setData(visible.current);
      }
      if (alive.current) setStatus('Salvo na nuvem');
    } catch {
      if (alive.current) {
        setStatus('Alterações não salvas');
        setError('Não foi possível salvar. Mantenha esta página aberta e tente novamente.');
      }
    } finally { saving.current = false; }
  }, []);

  useEffect(() => {
    alive.current = true;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw && !localStorage.getItem(`${KEY}-imported`)) setLegacy(decode(JSON.parse(raw)));
    } catch { /* Preserve the original browser data; never import it automatically. */ }
    void refresh();
    const channel = supabase.channel('shared-schedule')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shared_schedule' }, () => void refresh())
      .subscribe();
    const poll = window.setInterval(() => void refresh(), 5000);
    const reconnect = () => { if (queue.current.length) void flush(); else void refresh(); };
    const unload = (e: BeforeUnloadEvent) => { if (queue.current.length) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('online', reconnect);
    window.addEventListener('focus', reconnect);
    window.addEventListener('beforeunload', unload);
    return () => {
      alive.current = false;
      window.clearInterval(poll);
      window.removeEventListener('online', reconnect);
      window.removeEventListener('focus', reconnect);
      window.removeEventListener('beforeunload', unload);
      void supabase.removeChannel(channel);
    };
  }, [refresh, flush]);

  const update = useCallback((fn: (d: Data) => Data) => {
    if (!visible.current) return;
    const next = fn(visible.current);
    if (JSON.stringify(next) === JSON.stringify(visible.current)) return;
    // Freeze IDs allocated by UI callbacks so later queued edits still target the same rows.
    const collections = ['routes', 'drivers', 'vehicles', 'trips'] as const;
    const added = new Map<string, string[]>();
    for (const key of collections) {
      const existing = new Set(visible.current[key].map(x => x.id));
      added.set(key, next[key].filter(x => !existing.has(x.id)).map(x => x.id));
    }
    queue.current.push(current => {
      const result = fn(current);
      for (const key of collections) {
        const ids = added.get(key) ?? [];
        if (!ids.length) continue;
        const existing = new Set(current[key].map(x => x.id));
        let index = 0;
        const rows = result[key].map(x => existing.has(x.id) ? x : { ...x, id: ids[index++] ?? x.id });
        Object.assign(result, { [key]: rows });
      }
      return result;
    });
    visible.current = next;
    setData(next);
    void flush();
  }, [flush]);

  const importLegacy = useCallback(async () => {
    if (!legacy || saving.current || queue.current.length || !latest.current) return;
    if (!confirm(`Substituir TODA a programação compartilhada pelos dados deste navegador? ${legacy.trips.length} viagens serão importadas. Os dados atuais da nuvem serão substituídos.`)) return;
    saving.current = true;
    setStatus('Importando…');
    try {
      const saved = await transport.compareAndSave(legacy, latest.current.revision);
      if (!saved) throw new Error('A programação foi alterada por outra pessoa. Confira antes de importar novamente.');
      latest.current = saved;
      visible.current = saved.payload;
      setData(saved.payload);
      localStorage.setItem(`${KEY}-imported`, 'true');
      setLegacy(null);
      setError('');
      setStatus('Salvo na nuvem');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível importar. Tente novamente.');
      setStatus('Importação não concluída');
    } finally {
      saving.current = false;
      if (queue.current.length) void flush();
    }
  }, [legacy, flush]);
  return { data, update, status, error, retry: () => queue.current.length ? void flush() : void refresh(), legacy, importLegacy };
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
