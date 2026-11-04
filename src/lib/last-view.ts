/** Última tela aberta no navegador: aba + data. É preferência de visualização, não faz parte da programação. */
export const LAST_VIEW_KEY = "programacao-ultima-tela";
export const LAST_DATE_KEY = "programacao-ultima-data";

export interface LastView<T extends string> { tab: T; date: string }
type Store = Pick<Storage, "getItem" | "setItem">;

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Aba e data da última visita; sem nada salvo (ou com dado inválido), abre na primeira aba e no dia de hoje. */
export function readLastView<T extends string>(store: Store | null, tabs: readonly T[], today: string): LastView<T> {
  const first = tabs[0] as T;
  if (!store) return { tab: first, date: today };
  try {
    const raw = store.getItem(LAST_VIEW_KEY);
    if (raw) {
      const v = JSON.parse(raw) as { tab?: unknown; date?: unknown };
      return {
        tab: tabs.includes(v.tab as T) ? (v.tab as T) : first,
        date: isDate(v.date) ? v.date : today,
      };
    }
    const old = store.getItem(LAST_DATE_KEY); // versão anterior guardava só a data
    if (isDate(old)) return { tab: first, date: old };
  } catch { /* armazenamento indisponível ou conteúdo inválido */ }
  return { tab: first, date: today };
}

export function writeLastView<T extends string>(store: Store | null, view: LastView<T>) {
  try { store?.setItem(LAST_VIEW_KEY, JSON.stringify(view)); } catch { /* armazenamento indisponível */ }
}
