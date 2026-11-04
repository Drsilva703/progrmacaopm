import { describe, expect, it } from "vitest";
import { LAST_DATE_KEY, LAST_VIEW_KEY, readLastView, writeLastView } from "./last-view";

const TABS = ["dia", "semana", "mes"] as const;
const TODAY = "2026-11-04";

const memory = (init: Record<string, string> = {}) => {
  const data = { ...init };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => { data[k] = v; },
  };
};

describe("última tela aberta", () => {
  it("abre no dia de hoje quando nada foi salvo", () => {
    expect(readLastView(memory(), TABS, TODAY)).toEqual({ tab: "dia", date: TODAY });
  });

  it("abre na última aba e na última data usadas", () => {
    const store = memory();
    writeLastView(store, { tab: "mes", date: "2026-11-20" });
    expect(readLastView(store, TABS, TODAY)).toEqual({ tab: "mes", date: "2026-11-20" });
  });

  it("volta para a primeira aba e para hoje se o salvo estiver inválido", () => {
    const store = memory({ [LAST_VIEW_KEY]: '{"tab":"inexistente","date":"16/10/2026"}' });
    expect(readLastView(store, TABS, TODAY)).toEqual({ tab: "dia", date: TODAY });
  });

  it("aproveita a data salva pela versão anterior do app", () => {
    const store = memory({ [LAST_DATE_KEY]: "2026-10-16" });
    expect(readLastView(store, TABS, TODAY)).toEqual({ tab: "dia", date: "2026-10-16" });
  });

  it("funciona sem armazenamento disponível", () => {
    expect(readLastView(null, TABS, TODAY)).toEqual({ tab: "dia", date: TODAY });
    expect(() => writeLastView(null, { tab: "dia", date: TODAY })).not.toThrow();
  });
});
