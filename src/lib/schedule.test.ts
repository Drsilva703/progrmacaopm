import { describe, it, expect } from "vitest";
import { arrivalDate, availableFrom, findConflicts, weekday, type Trip } from "./schedule";

const t = (o: Partial<Trip>): Trip => ({
  id: "x", date: "2026-10-16", orders: [], routeId: "r", vehicleId: "v1", driverId: "d1",
  status: "CARREGANDO", days: 3, time: "06:00", ...o,
});

describe("schedule rules", () => {
  it("chegada segue a planilha", () => {
    expect(arrivalDate("2026-10-16", 3)).toBe("2026-10-18");
    expect(arrivalDate("2026-10-16", 5)).toBe("2026-10-20");
    expect(arrivalDate("2026-10-16", 0)).toBe("2026-10-16");
  });
  it("disponível no dia seguinte à chegada", () => {
    expect(availableFrom("2026-10-16", 2)).toBe("2026-10-18");
  });
  it("16/10/26 é sexta-feira", () => expect(weekday("2026-10-16")).toBe("SEXTA-FEIRA"));
  it("detecta conflito de motorista e veículo", () => {
    const a = t({ id: "a" });
    const b = t({ id: "b", date: "2026-10-18" });
    const c = t({ id: "c", date: "2026-10-19" });
    expect(findConflicts(b, [a]).driver).toHaveLength(1);
    expect(findConflicts(b, [a]).vehicle).toHaveLength(1);
    expect(findConflicts(c, [a]).driver).toHaveLength(0);
  });
});

import { plannedRouteCodes } from "./schedule";
describe("rotas previstas", () => {
  it("seg/qua/sex = 12 rotas", () => {
    for (const d of ["2026-10-12", "2026-10-14", "2026-10-16"]) expect(plannedRouteCodes(d)).toHaveLength(12);
  });
  it("ter/qui/sáb = SSA + PM 04,05,06", () => {
    for (const d of ["2026-10-13", "2026-10-15", "2026-10-17"])
      expect(plannedRouteCodes(d)).toEqual(["PM_FEC_SSA", "CO_FEC_SSA", "PM_FEC_04", "PM_FEC_05", "PM_FEC_06"]);
  });
  it("domingo vazio", () => expect(plannedRouteCodes("2026-10-18")).toEqual([]));
});
