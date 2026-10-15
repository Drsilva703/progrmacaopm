import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, AlertTriangle, Truck, Printer } from "lucide-react";
import {
  STATUSES, addDaysISO, arrivalDate, availableFrom, findConflicts, fmtBR, fromISO, toISO, weekday,
  type Trip, type Status,
} from "@/lib/schedule";
import { useData, uid, type Data } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Programação de Viagens — Transportadora" },
      { name: "description", content: "Planeje saídas, rotas, motoristas e veículos com controle de disponibilidade e agenda diária, semanal e mensal." },
      { property: "og:title", content: "Programação de Viagens — Transportadora" },
      { property: "og:description", content: "Agenda logística de saídas, retornos e disponibilidade de motoristas e veículos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: App,
});

type Tab = "dia" | "semana" | "mes" | "recursos" | "cadastros";
const TABS: [Tab, string][] = [["dia", "Programação do dia"], ["semana", "Semana"], ["mes", "Mês"], ["recursos", "Disponibilidade"], ["cadastros", "Cadastros"]];

function App() {
  const { data, update } = useData();
  const [tab, setTab] = useState<Tab>("dia");
  const [date, setDate] = useState("2026-10-16");
  const [editing, setEditing] = useState<Trip | null>(null);

  if (!data) return <div className="p-10 text-muted-foreground">Carregando…</div>;

  const newTrip = (d = date) => setEditing({
    id: "", date: d, orders: [], routeId: data.routes[0]?.id ?? "", vehicleId: "", driverId: "",
    status: "PROGRAMADO", days: data.routes[0]?.days ?? 1, time: "06:00",
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-sheet text-sheet-foreground print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-4">
          <Truck className="h-7 w-7 text-sheet-accent" />
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Programação de Viagens</h1>
          <nav className="ml-auto flex flex-wrap gap-1">
            {TABS.map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`rounded px-3 py-1.5 text-sm font-semibold uppercase tracking-wide transition ${tab === k ? "bg-sheet-accent text-sheet" : "hover:bg-sheet-foreground/10"}`}>
                {l}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        {tab !== "cadastros" && (
          <DateBar date={date} setDate={setDate} step={tab === "mes" ? "mes" : tab === "semana" ? 7 : 1} onAdd={() => newTrip()} />
        )}
        {tab === "dia" && <DaySheet data={data} update={update} date={date} onEdit={setEditing} />}
        {tab === "semana" && <WeekView data={data} date={date} onPick={(d) => { setDate(d); setTab("dia"); }} />}
        {tab === "mes" && <MonthView data={data} date={date} onPick={(d) => { setDate(d); setTab("dia"); }} />}
        {tab === "recursos" && <Availability data={data} date={date} />}
        {tab === "cadastros" && <Registry data={data} update={update} />}
      </main>
      {editing && <TripForm data={data} trip={editing} onClose={() => setEditing(null)} onSave={(t) => {
        update((d) => ({ ...d, trips: t.id ? d.trips.map((x) => (x.id === t.id ? t : x)) : [...d.trips, { ...t, id: uid() }] }));
        setEditing(null);
      }} />}
    </div>
  );
}

function DateBar({ date, setDate, step, onAdd }: { date: string; setDate: (d: string) => void; step: number | "mes"; onAdd: () => void }) {
  const move = (dir: number) => {
    if (step === "mes") { const d = fromISO(date); d.setMonth(d.getMonth() + dir, 1); setDate(toISO(d)); }
    else setDate(addDaysISO(date, step * dir));
  };
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
      <button onClick={() => move(-1)} className="rounded border border-border p-2 hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
      <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="rounded border border-input bg-card px-3 py-1.5" />
      <button onClick={() => move(1)} className="rounded border border-border p-2 hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
      <span className="font-display text-lg font-semibold uppercase">{weekday(date)}</span>
      <button onClick={onAdd} className="ml-auto inline-flex items-center gap-1 rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
        <Plus className="h-4 w-4" /> Nova saída
      </button>
    </div>
  );
}

const lookup = (data: Data) => ({
  route: (id: string) => data.routes.find((r) => r.id === id)?.code ?? "—",
  driver: (id: string) => data.drivers.find((r) => r.id === id)?.name ?? "—",
  plate: (id: string) => data.vehicles.find((r) => r.id === id)?.plate ?? "—",
});

const statusClass: Record<Status, string> = {
  PROGRAMADO: "bg-muted text-foreground",
  CARREGANDO: "bg-status-load text-foreground",
  "EM ROTA": "bg-primary text-primary-foreground",
  "CONCLUÍDO": "bg-status-done text-foreground",
  CANCELADO: "bg-destructive text-destructive-foreground",
};

function DaySheet({ data, update, date, onEdit }: { data: Data; update: (f: (d: Data) => Data) => void; date: string; onEdit: (t: Trip) => void }) {
  const L = lookup(data);
  const trips = data.trips.filter((t) => t.date === date).sort((a, b) => a.time.localeCompare(b.time) || L.route(a.routeId).localeCompare(L.route(b.routeId)));
  const returning = data.trips.filter((t) => t.days > 1 && arrivalDate(t.date, t.days) === date && t.status !== "CANCELADO");
  const shift = data.shifts.find((s) => s.date === date);
  const setShift = (patch: Partial<{ time: string; names: string }>) => update((d) => {
    const cur = d.shifts.find((s) => s.date === date) ?? { date, time: "08:00", names: "" };
    return { ...d, shifts: [...d.shifts.filter((s) => s.date !== date), { ...cur, ...patch }] };
  });
  const [d, m] = [date.slice(8), date.slice(5, 7)];

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-md border-2 border-sheet shadow-sm">
        <div className="flex items-center justify-between bg-sheet px-4 py-2 text-sheet-foreground">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide">Programação de viagem para saída em {d}/{m} – {weekday(date)}</h2>
          <button onClick={() => window.print()} className="print:hidden"><Printer className="h-5 w-5" /></button>
        </div>
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-sheet-sub font-display uppercase">
            <tr>{["Pedido", "Rota", "Veículo", "Motorista", "Status", "Dias", "Saída", "Chegada", "Horário saída", ""].map((h) => <th key={h} className="border border-sheet/30 px-2 py-1.5">{h}</th>)}</tr>
          </thead>
          <tbody>
            {trips.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Nenhuma saída programada para este dia.</td></tr>}
            {trips.map((t) => {
              const c = findConflicts(t, data.trips);
              const conflict = c.driver.length > 0 || c.vehicle.length > 0;
              return (
                <tr key={t.id} className={`${t.orders.length ? "bg-sheet-row" : "bg-card"} text-center font-semibold`}>
                  <td className="border border-sheet/20 px-2 py-1 text-xs leading-tight">{t.orders.length ? t.orders.map((o) => <div key={o}>{o}</div>) : "-"}</td>
                  <td className="border border-sheet/20 px-2">{L.route(t.routeId)}</td>
                  <td className={`border border-sheet/20 px-2 ${c.vehicle.length ? "text-destructive" : ""}`}>{L.plate(t.vehicleId)}</td>
                  <td className={`border border-sheet/20 px-2 ${c.driver.length ? "text-destructive" : ""}`}>{L.driver(t.driverId)}</td>
                  <td className="border border-sheet/20 px-1">
                    <select value={t.status} onChange={(e) => update((dd) => ({ ...dd, trips: dd.trips.map((x) => x.id === t.id ? { ...x, status: e.target.value as Status } : x) }))}
                      className={`rounded px-1 py-0.5 text-xs font-bold ${statusClass[t.status]}`}>
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="border border-sheet/20 px-2">{t.days}</td>
                  <td className="border border-sheet/20 px-2">{fmtBR(t.date)}</td>
                  <td className="border border-sheet/20 px-2">{fmtBR(arrivalDate(t.date, t.days))}</td>
                  <td className="border border-sheet/20 px-2">{t.time}:00</td>
                  <td className="border border-sheet/20 px-2 print:hidden">
                    <div className="flex items-center justify-center gap-2">
                      {conflict && <span title="Conflito de motorista ou veículo"><AlertTriangle className="h-4 w-4 text-destructive" /></span>}
                      <button onClick={() => onEdit(t)}><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => confirm("Excluir esta saída?") && update((dd) => ({ ...dd, trips: dd.trips.filter((x) => x.id !== t.id) }))}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center justify-center gap-2 bg-sheet px-4 py-2 font-display text-lg font-bold uppercase text-sheet-foreground">
          Plantão {d}/{m} – {weekday(date)}
          <input value={shift?.time ?? ""} onChange={(e) => setShift({ time: e.target.value })} placeholder="08:00" className="w-16 rounded bg-sheet-foreground/10 px-1 text-center" /> Hrs –
          <input value={shift?.names ?? ""} onChange={(e) => setShift({ names: e.target.value.toUpperCase() })} placeholder="NOMES DO PLANTÃO" className="w-64 rounded bg-sheet-foreground/10 px-2" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 print:hidden">
        <Panel title={`Retornos previstos em ${fmtBR(date)}`}>
          {returning.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum retorno neste dia.</p> :
            returning.map((t) => <p key={t.id} className="text-sm"><b>{L.route(t.routeId)}</b> · {L.driver(t.driverId)} · {L.plate(t.vehicleId)} (saiu {fmtBR(t.date)})</p>)}
        </Panel>
        <Panel title="Resumo do dia">
          <p className="text-sm">{trips.length} saídas · {new Set(trips.map((t) => t.routeId)).size} rotas · {trips.filter((t) => { const c = findConflicts(t, data.trips); return c.driver.length + c.vehicle.length > 0; }).length} com conflito</p>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-card p-4"><h3 className="mb-2 font-display font-bold uppercase">{title}</h3>{children}</div>;
}

function DayCell({ data, iso, onPick, dim }: { data: Data; iso: string; onPick: (d: string) => void; dim?: boolean }) {
  const L = lookup(data);
  const out = data.trips.filter((t) => t.date === iso && t.status !== "CANCELADO");
  const back = data.trips.filter((t) => t.days > 1 && arrivalDate(t.date, t.days) === iso && t.status !== "CANCELADO");
  return (
    <button onClick={() => onPick(iso)} className={`flex min-h-28 flex-col rounded border border-border bg-card p-2 text-left hover:border-primary ${dim ? "opacity-40" : ""}`}>
      <span className="font-display text-sm font-bold">{fmtBR(iso).slice(0, 5)}</span>
      {out.length > 0 && <span className="mt-1 rounded bg-sheet px-1 text-xs font-semibold text-sheet-foreground">{out.length} saídas</span>}
      {back.length > 0 && <span className="mt-1 rounded bg-status-done px-1 text-xs font-semibold">{back.length} retornos</span>}
      <div className="mt-1 space-y-0.5 text-[11px] leading-tight text-muted-foreground">
        {out.slice(0, 4).map((t) => <div key={t.id}>{L.route(t.routeId)} · {L.driver(t.driverId)}</div>)}
        {out.length > 4 && <div>+{out.length - 4}</div>}
      </div>
    </button>
  );
}

function WeekView({ data, date, onPick }: { data: Data; date: string; onPick: (d: string) => void }) {
  const start = addDaysISO(date, -fromISO(date).getDay());
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(start, i));
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
      {days.map((d) => <div key={d}><p className="mb-1 text-center text-xs font-bold uppercase text-muted-foreground">{weekday(d).split("-")[0]}</p><DayCell data={data} iso={d} onPick={onPick} /></div>)}
    </div>
  );
}

function MonthView({ data, date, onPick }: { data: Data; date: string; onPick: (d: string) => void }) {
  const first = fromISO(date.slice(0, 8) + "01");
  const start = addDaysISO(toISO(first), -first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => addDaysISO(start, i));
  const month = date.slice(0, 7);
  return (
    <div>
      <h2 className="mb-2 font-display text-xl font-bold uppercase">{first.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h2>
      <div className="grid grid-cols-7 gap-1">
        {["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map((w) => <p key={w} className="text-center text-xs font-bold text-muted-foreground">{w}</p>)}
        {days.map((d) => <DayCell key={d} data={data} iso={d} onPick={onPick} dim={!d.startsWith(month)} />)}
      </div>
    </div>
  );
}

function Availability({ data, date }: { data: Data; date: string }) {
  const L = lookup(data);
  const active = data.trips.filter((t) => t.status !== "CANCELADO" && t.status !== "CONCLUÍDO");
  const busy = (key: "driverId" | "vehicleId", id: string) =>
    active.find((t) => t[key] === id && t.date <= date && date < availableFrom(t.date, t.days) && t.days > 0);
  const nextFree = (key: "driverId" | "vehicleId", id: string) => {
    const t = busy(key, id);
    return t ? availableFrom(t.date, t.days) : null;
  };
  const Table = ({ rows, k }: { rows: { id: string; label: string }[]; k: "driverId" | "vehicleId" }) => (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r) => {
          const t = busy(k, r.id);
          return (
            <tr key={r.id} className="border-b border-border">
              <td className="py-1.5 font-semibold">{r.label}</td>
              <td>{t ? <span className="rounded bg-sheet-row px-2 text-xs font-bold">EM VIAGEM · {L.route(t.routeId)}</span> : <span className="rounded bg-status-done px-2 text-xs font-bold">DISPONÍVEL</span>}</td>
              <td className="text-right text-xs text-muted-foreground">{t ? `livre em ${fmtBR(nextFree(k, r.id)!)}` : ""}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title={`Motoristas em ${fmtBR(date)}`}><Table k="driverId" rows={data.drivers.map((d) => ({ id: d.id, label: d.name }))} /></Panel>
      <Panel title={`Veículos em ${fmtBR(date)}`}><Table k="vehicleId" rows={data.vehicles.map((v) => ({ id: v.id, label: v.plate }))} /></Panel>
    </div>
  );
}

const inp = "w-full rounded border border-input bg-card px-2 py-1.5 text-sm";

function TripForm({ data, trip, onClose, onSave }: { data: Data; trip: Trip; onClose: () => void; onSave: (t: Trip) => void }) {
  const [t, setT] = useState(trip);
  const [orders, setOrders] = useState(trip.orders.join(", "));
  const L = lookup(data);
  const draft = { ...t, orders: orders.split(/[,\s]+/).filter(Boolean) };
  const c = useMemo(() => findConflicts(draft, data.trips), [t, data.trips]); // eslint-disable-line react-hooks/exhaustive-deps
  const free = (key: "driverId" | "vehicleId", id: string) => findConflicts({ ...draft, [key]: id }, data.trips)[key === "driverId" ? "driver" : "vehicle"].length === 0;
  const set = (p: Partial<Trip>) => setT((x) => ({ ...x, ...p }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-md bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 font-display text-xl font-bold uppercase">{trip.id ? "Editar saída" : "Nova saída"}</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 text-xs font-semibold">Pedido(s)<input className={inp} value={orders} onChange={(e) => setOrders(e.target.value)} placeholder="2026287, 2026288" /></label>
          <label className="text-xs font-semibold">Data de saída<input type="date" className={inp} value={t.date} onChange={(e) => set({ date: e.target.value })} /></label>
          <label className="text-xs font-semibold">Horário<input type="time" className={inp} value={t.time} onChange={(e) => set({ time: e.target.value })} /></label>
          <label className="text-xs font-semibold">Rota<select className={inp} value={t.routeId} onChange={(e) => set({ routeId: e.target.value, days: data.routes.find((r) => r.id === e.target.value)?.days ?? t.days })}>
            {data.routes.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}</select></label>
          <label className="text-xs font-semibold">Duração (dias)<input type="number" min={0} className={inp} value={t.days} onChange={(e) => set({ days: Math.max(0, +e.target.value) })} /></label>
          <label className="text-xs font-semibold">Motorista<select className={inp} value={t.driverId} onChange={(e) => set({ driverId: e.target.value })}>
            <option value="">—</option>{data.drivers.map((d) => <option key={d.id} value={d.id}>{d.name}{free("driverId", d.id) ? "" : " (ocupado)"}</option>)}</select></label>
          <label className="text-xs font-semibold">Veículo<select className={inp} value={t.vehicleId} onChange={(e) => set({ vehicleId: e.target.value })}>
            <option value="">—</option>{data.vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}{free("vehicleId", v.id) ? "" : " (ocupado)"}</option>)}</select></label>
          <label className="text-xs font-semibold">Status<select className={inp} value={t.status} onChange={(e) => set({ status: e.target.value as Status })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <div className="text-xs font-semibold">Chegada calculada<div className="py-1.5 text-base">{fmtBR(arrivalDate(t.date, t.days))} ({weekday(arrivalDate(t.date, t.days)).toLowerCase()})</div></div>
        </div>
        {(c.driver.length > 0 || c.vehicle.length > 0) && (
          <div className="mt-3 rounded border border-destructive bg-destructive/10 p-2 text-sm text-destructive">
            <b>Conflito de programação:</b>
            {c.driver.map((x) => <div key={"d" + x.id}>Motorista já em {L.route(x.routeId)} ({fmtBR(x.date)}–{fmtBR(arrivalDate(x.date, x.days))})</div>)}
            {c.vehicle.map((x) => <div key={"v" + x.id}>Veículo já em {L.route(x.routeId)} ({fmtBR(x.date)}–{fmtBR(arrivalDate(x.date, x.days))})</div>)}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border border-border px-4 py-2 text-sm">Cancelar</button>
          <button disabled={!t.routeId} onClick={() => {
            if ((c.driver.length || c.vehicle.length) && !confirm("Há conflito de motorista/veículo. Salvar mesmo assim?")) return;
            onSave(draft);
          }} className="rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Salvar</button>
        </div>
      </div>
    </div>
  );
}

function Registry({ data, update }: { data: Data; update: (f: (d: Data) => Data) => void }) {
  const [route, setRoute] = useState({ code: "", days: 1 });
  const [driver, setDriver] = useState("");
  const [plate, setPlate] = useState("");
  const used = (k: "routeId" | "driverId" | "vehicleId", id: string) => data.trips.some((t) => t[k] === id);
  const del = (k: "routes" | "drivers" | "vehicles", tk: "routeId" | "driverId" | "vehicleId", id: string) => {
    if (used(tk, id)) return alert("Item usado em viagens programadas.");
    update((d) => ({ ...d, [k]: (d[k] as { id: string }[]).filter((x) => x.id !== id) }));
  };
  const Row = ({ label, onDel }: { label: string; onDel: () => void }) => (
    <li className="flex items-center justify-between border-b border-border py-1 text-sm font-semibold">{label}<button onClick={onDel}><Trash2 className="h-4 w-4 text-muted-foreground" /></button></li>
  );
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Panel title="Rotas">
        <form className="mb-3 flex gap-1" onSubmit={(e) => { e.preventDefault(); if (!route.code) return; update((d) => ({ ...d, routes: [...d.routes, { id: uid(), code: route.code.toUpperCase(), days: route.days }] })); setRoute({ code: "", days: 1 }); }}>
          <input className={inp} placeholder="Código" value={route.code} onChange={(e) => setRoute({ ...route, code: e.target.value })} />
          <input type="number" min={0} className={`${inp} w-20`} title="Dias" value={route.days} onChange={(e) => setRoute({ ...route, days: +e.target.value })} />
          <button className="rounded bg-primary px-2 text-primary-foreground"><Plus className="h-4 w-4" /></button>
        </form>
        <ul>{data.routes.map((r) => <Row key={r.id} label={`${r.code} · ${r.days} dia(s)`} onDel={() => del("routes", "routeId", r.id)} />)}</ul>
      </Panel>
      <Panel title="Motoristas">
        <form className="mb-3 flex gap-1" onSubmit={(e) => { e.preventDefault(); if (!driver) return; update((d) => ({ ...d, drivers: [...d.drivers, { id: uid(), name: driver.toUpperCase() }] })); setDriver(""); }}>
          <input className={inp} placeholder="Nome" value={driver} onChange={(e) => setDriver(e.target.value)} />
          <button className="rounded bg-primary px-2 text-primary-foreground"><Plus className="h-4 w-4" /></button>
        </form>
        <ul>{data.drivers.map((r) => <Row key={r.id} label={r.name} onDel={() => del("drivers", "driverId", r.id)} />)}</ul>
      </Panel>
      <Panel title="Veículos">
        <form className="mb-3 flex gap-1" onSubmit={(e) => { e.preventDefault(); if (!plate) return; update((d) => ({ ...d, vehicles: [...d.vehicles, { id: uid(), plate: plate.toUpperCase() }] })); setPlate(""); }}>
          <input className={inp} placeholder="Placa" value={plate} onChange={(e) => setPlate(e.target.value)} />
          <button className="rounded bg-primary px-2 text-primary-foreground"><Plus className="h-4 w-4" /></button>
        </form>
        <ul>{data.vehicles.map((r) => <Row key={r.id} label={r.plate} onDel={() => del("vehicles", "vehicleId", r.id)} />)}</ul>
      </Panel>
    </div>
  );
}
