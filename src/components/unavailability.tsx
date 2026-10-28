import { useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtBR, tripBlocks, type Unavailability } from "@/lib/schedule";
import { uid, type Data } from "@/lib/store";

const field = "w-full rounded border border-input bg-card px-3 py-2 text-sm";
type Props = { data: Data; update: (fn: (data: Data) => Data) => void; date: string };

export function UnavailabilityView({ data, update, date }: Props) {
  const empty = (): Unavailability => ({ id: "", resourceType: "driver", resourceId: "", reason: "FOLGA", startDate: date, endDate: date, notes: "" });
  const [draft, setDraft] = useState<Unavailability>(empty);
  const [error, setError] = useState("");
  const blocks = data.unavailabilities ?? [];
  const label = (b: Unavailability) => b.resourceType === "driver" ? data.drivers.find(d => d.id === b.resourceId)?.name ?? "Motorista removido" : data.vehicles.find(v => v.id === b.resourceId)?.plate ?? "Veículo removido";
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.resourceId || !draft.startDate || !draft.endDate) { setError("Selecione o recurso e informe o período."); return; }
    if (draft.endDate < draft.startDate) { setError("A data final deve ser igual ou posterior à inicial."); return; }
    const saved = { ...draft, id: draft.id || uid(), notes: draft.notes.trim() };
    update(d => ({ ...d, unavailabilities: [...(d.unavailabilities ?? []).filter(b => b.id !== saved.id), saved] }));
    setDraft(empty()); setError("");
  };
  return <section className="space-y-6">
    <h2 className="font-display text-2xl font-bold uppercase">Indisponibilidades</h2>
    <form onSubmit={submit} className="grid items-end gap-3 border-b border-border pb-5 sm:grid-cols-2 xl:grid-cols-6">
      <label className="space-y-1 text-sm font-semibold">Recurso
        <select aria-label="Recurso" className={field} value={draft.resourceType} onChange={e => { const vehicle = e.target.value === "vehicle"; setDraft({ ...draft, resourceType: vehicle ? "vehicle" : "driver", resourceId: "", reason: vehicle ? "OFICINA" : "FOLGA" }); }}>
          <option value="driver">Motorista</option><option value="vehicle">Veículo</option>
        </select>
      </label>
      <label className="space-y-1 text-sm font-semibold">{draft.resourceType === "driver" ? "Motorista" : "Placa"}
        <select aria-label={draft.resourceType === "driver" ? "Motorista" : "Placa"} required className={field} value={draft.resourceId} onChange={e => setDraft({ ...draft, resourceId: e.target.value })}>
          <option value="">Selecionar</option>
          {draft.resourceType === "driver" ? data.drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>) : data.vehicles.map(v => <option key={v.id} value={v.id}>{v.plate}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm font-semibold">Motivo
        <select aria-label="Motivo" className={field} value={draft.reason} onChange={e => setDraft({ ...draft, reason: e.target.value as Unavailability["reason"] })}>
          {draft.resourceType === "vehicle" ? <option value="OFICINA">OFICINA</option> : <><option value="FOLGA">FOLGA</option><option value="ATESTADO">ATESTADO</option><option value="FERIAS">FÉRIAS</option></>}
        </select>
      </label>
      <label className="space-y-1 text-sm font-semibold">De<input required type="date" className={field} value={draft.startDate} onChange={e => setDraft({ ...draft, startDate: e.target.value })} /></label>
      <label className="space-y-1 text-sm font-semibold">Até (inclusive)<input required type="date" min={draft.startDate} className={field} value={draft.endDate} onChange={e => setDraft({ ...draft, endDate: e.target.value })} /></label>
      <Button type="submit"><Plus />{draft.id ? "Salvar alteração" : "Registrar"}</Button>
      <label className="space-y-1 text-sm font-semibold sm:col-span-2 xl:col-span-5">Observação<input className={field} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></label>
      {draft.id && <Button type="button" variant="outline" onClick={() => { setDraft(empty()); setError(""); }}><X />Cancelar</Button>}
      {error && <p role="alert" className="text-sm text-destructive sm:col-span-2 xl:col-span-6">{error}</p>}
    </form>
    {blocks.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma indisponibilidade registrada.</p> : <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-muted-foreground"><tr>{["Recurso", "Motivo", "Período", "Observação", "Viagens afetadas", ""].map(h => <th key={h} className="px-2 py-3">{h}</th>)}</tr></thead>
        <tbody>{[...blocks].sort((a, b) => b.startDate.localeCompare(a.startDate)).map(b => {
          const count = data.trips.filter(t => { const found = tripBlocks(t, [b]); return found.driver.length + found.vehicle.length > 0; }).length;
          return <tr key={b.id} className="border-b border-border">
            <td className="px-2 py-3 font-semibold">{label(b)}</td><td className="px-2 py-3 font-bold text-destructive">{b.reason}</td>
            <td className="whitespace-nowrap px-2 py-3">{fmtBR(b.startDate)} – {fmtBR(b.endDate)}</td><td className="max-w-64 break-words px-2 py-3">{b.notes || "—"}</td>
            <td className={`px-2 py-3 ${count ? "text-destructive" : "text-muted-foreground"}`}>{count || "—"}</td>
            <td className="px-2 py-3"><div className="flex gap-1">
              <Button variant="ghost" size="icon" title="Editar indisponibilidade" aria-label="Editar indisponibilidade" onClick={() => { setDraft(b); setError(""); }}><Pencil /></Button>
              <Button variant="ghost" size="icon" title="Excluir indisponibilidade" aria-label="Excluir indisponibilidade" onClick={() => { if (confirm(`Excluir ${b.reason} de ${label(b)}?`)) update(d => ({ ...d, unavailabilities: (d.unavailabilities ?? []).filter(x => x.id !== b.id) })); }}><Trash2 /></Button>
            </div></td>
          </tr>;
        })}</tbody>
      </table>
    </div>}
  </section>;
}