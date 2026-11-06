import { describe, expect, it } from "vitest";
import { applyMonthly, parseMatrix } from "./monthly-import";
import type { Data } from "./store";

const base: Data = {
  routes: [{ id: "r1", code: "PM_FEC_01", days: 1 }, { id: "s", code: "PM_FEC_SSA", days: 1 }],
  drivers: [{ id: "d1", name: "LELIVALDO DA SILVA" }], vehicles: [{ id: "v1", plate: "QGF6164" }], trips: [], shifts: [],
};
const rows = parseMatrix([["ESCALA MOTORISTA NOVEMBRO- 2026", null, null, 1, 2, 3], [], ["ROTA 01"], ["Lelisvaldo da Silva", "R.01", "QGF6164", "F", "F", "1/12345"], ["Paulo", "SSA", "", "PM", "PM", "PM"]]);
let n = 0;
const res = applyMonthly(base, rows.month!, rows.rows, () => `id${n++}`);

describe("escala mensal", () => {
  it("detecta o mês pelo título", () => expect(rows.month).toBe("2026-11"));
  it("número 1 vira PM_FEC_01 no dia 3 com motorista e placa da linha", () => {
    expect(res.data.trips).toHaveLength(1);
    expect(res.data.trips[0]).toMatchObject({ date: "2026-11-03", routeId: "r1", driverId: "d1", vehicleId: "v1", time: "06:00" });
  });
  it("célula rota/pedido preenche o pedido da viagem", () => {
    expect(res.data.trips[0]?.orders).toEqual(["12345"]);
    expect(res.preview.orders).toBe(1);
  });
  it("célula só com a rota deixa o pedido em branco", () => {
    const r2 = applyMonthly(base, rows.month!, [{ driver: "Lelisvaldo da Silva", plate: "QGF6164", days: [1] }], () => `x${n++}`);
    expect(r2.data.trips[0]?.orders).toEqual([]);
    expect(r2.preview.orders).toBe(0);
  });
  it("folgas (F) não são preenchidas", () => {
    expect(res.data.unavailabilities ?? []).toHaveLength(0);
  });
  it("PM (SSA) não cria viagem", () => expect(res.data.trips.some((t) => t.routeId === "s")).toBe(false));
});
