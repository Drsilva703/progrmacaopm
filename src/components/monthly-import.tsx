import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Data } from "@/lib/store";
import { uid } from "@/lib/store";
import { applyMonthly, parseMatrix, type MonthlyRow, type MonthlyPreview, type Cell } from "@/lib/monthly-import";

export function MonthlyImportView({ data, update, onDone }: { data: Data; update: (fn: (d: Data) => Data) => void; onDone: (date: string) => void }) {
  const [rows, setRows] = useState<MonthlyRow[] | null>(null);
  const [month, setMonth] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const read = async (file: File) => {
    setError(""); setDone("");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer());
      const ws = wb.Sheets[wb.SheetNames[0] ?? ""];
      if (!ws) throw new Error();
      const parsed = parseMatrix(XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, defval: null }));
      if (!parsed.rows.length) throw new Error();
      setRows(parsed.rows); setFileName(file.name);
      if (parsed.month) setMonth(parsed.month);
    } catch { setError("Não consegui ler essa planilha. Confira se é a escala mensal (motoristas nas linhas, dias nas colunas)."); setRows(null); }
  };

  const preview: MonthlyPreview | null = rows && month ? applyMonthly(data, month, rows, uid).preview : null;

  const confirm = () => {
    if (!rows || !month || !preview) return;
    if (!window.confirm(`Substituir as rotas PM_FEC_01 a 10 da escala em ${month.split("-").reverse().join("/")}? As rotas SSA não serão alteradas e as folgas não serão preenchidas.`)) return;
    update((d) => applyMonthly(d, month, rows, uid).data);
    setDone(`Escala importada: ${preview.trips} viagens.`);
    setRows(null);
    onDone(`${month}-01`);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <h2 className="flex items-center gap-2 text-xl font-bold uppercase"><FileSpreadsheet className="h-5 w-5" /> Escala mensal</h2>
      <p className="text-sm opacity-80">Envie a planilha do mês: motorista na coluna A, placa na coluna C e os dias a partir da coluna D. Só os dias de saída em rota viram viagem: o número de 1 a 10 vira a rota PM_FEC_01 a PM_FEC_10 (06:00) com motorista e placa da linha. Para já sair com pedido, escreva “4/12345” (rota/pedido). “F” (folga) é ignorado e rotas SSA não são criadas.</p>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-sheet-border px-3 py-2 text-sm font-semibold hover:bg-sheet-foreground/10">
        Escolher arquivo .xlsx
        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ""; }} />
      </label>
      {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
      {done && <p className="text-sm font-semibold text-sheet-accent">{done}</p>}
      {rows && (
        <div className="space-y-3 rounded border border-sheet-border p-4">
          <p className="text-sm"><b>{fileName}</b> — {rows.length} motoristas encontrados.</p>
          <label className="flex items-center gap-2 text-sm">Mês da escala:
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded border border-sheet-border bg-transparent px-2 py-1" />
          </label>
          {preview && (
            <ul className="list-disc pl-5 text-sm">
              <li>{preview.trips} viagens PM_FEC serão programadas{preview.orders > 0 ? ` (${preview.orders} já com pedido)` : ""}</li>
              {preview.newDrivers.length > 0 && <li>Motoristas novos no cadastro: {preview.newDrivers.join(", ")}</li>}
              {preview.newPlates.length > 0 && <li>Placas novas no cadastro: {preview.newPlates.join(", ")}</li>}
              {preview.skipped > 0 && <li className="text-destructive">{preview.skipped} células com rota não cadastrada foram ignoradas</li>}
            </ul>
          )}
          <Button onClick={confirm} disabled={!month}>Importar para a programação</Button>
        </div>
      )}
    </div>
  );
}
