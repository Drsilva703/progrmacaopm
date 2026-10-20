import { describe, expect, it } from "vitest";
import { resourceBlocks, tripBlocks, type Trip, type Unavailability } from "./schedule";

const workshop: Unavailability = { id: "workshop", resourceType: "vehicle", resourceId: "FCB4403", reason: "OFICINA", startDate: "2026-10-19", endDate: "2026-10-20", notes: "" };
const leave: Unavailability = { ...workshop, id: "leave", resourceType: "driver", resourceId: "RONALDO", reason: "FOLGA" };
const trip: Trip = { id: "trip", date: "2026-10-18", orders: [], routeId: "route", vehicleId: "FCB4403", driverId: "RONALDO", days: 3, time: "06:00", status: "PROGRAMADO" };

describe("oficina e afastamentos", () => {
  it("FCB4403 permanece em oficina até terça-feira inclusive, liberando quarta", () => {
    expect(resourceBlocks([workshop], "vehicle", "FCB4403", "2026-10-20")).toEqual([workshop]);
    expect(resourceBlocks([workshop], "vehicle", "FCB4403", "2026-10-21")).toEqual([]);
  });
  it("RONALDO de folga ou atestado não pode ser escalado até terça-feira", () => {
    for (const reason of ["FOLGA", "ATESTADO"] as const) {
      const block = { ...leave, reason };
      expect(resourceBlocks([block], "driver", "RONALDO", "2026-10-20")).toEqual([block]);
      expect(resourceBlocks([block], "driver", "RONALDO", "2026-10-21")).toEqual([]);
    }
  });
  it("considera todo o período da viagem, não apenas a saída", () => {
    expect(tripBlocks(trip, [workshop, leave])).toEqual({ vehicle: [workshop], driver: [leave] });
  });
  it("não bloqueia outro recurso nem viagens canceladas", () => {
    expect(resourceBlocks([workshop, leave], "driver", "outro", "2026-10-20")).toEqual([]);
    expect(tripBlocks({ ...trip, status: "CANCELADO" }, [workshop, leave])).toEqual({ driver: [], vehicle: [] });
    expect(tripBlocks(trip, undefined)).toEqual({ driver: [], vehicle: [] });
  });
});