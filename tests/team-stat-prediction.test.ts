import { describe, expect, it } from "vitest";
import { getFootballStatMarkets } from "@/application/prediction/team-stat-prediction";
import type { PrismaClient } from "@prisma/client";

/**
 * Prisma falso: dos equipos con historial de corners/tarjetas.
 * "Alto" promedia 6 corners; "Bajo" promedia 3.
 */
function fakePrisma(homeCorners: number[], awayCorners: number[]) {
  const mk = (name: string, id: string) => ({ id, name });
  const participants = [mk("Alto", "p-alto"), mk("Bajo", "p-bajo")];

  const rowsFor = (pid: string, values: number[]) =>
    values.map((v, i) => ({ metricKey: "corners", metricValue: v, eventId: `${pid}-e${i}` }));

  return {
    participant: {
      findMany: async ({ where }: { where: { name: { equals: string } } }) =>
        participants.filter((p) => p.name.toLowerCase() === where.name.equals.toLowerCase()),
    },
    teamMatchMetric: {
      findMany: async ({ where }: { where: { participantId: { in: string[] } } }) => {
        if (where.participantId.in.includes("p-alto")) return rowsFor("p-alto", homeCorners);
        if (where.participantId.in.includes("p-bajo")) return rowsFor("p-bajo", awayCorners);
        return [];
      },
    },
  } as unknown as PrismaClient;
}

describe("getFootballStatMarkets", () => {
  it("predice corners esperados y over/under desde el historial", async () => {
    const prisma = fakePrisma([6, 6, 6, 6, 6], [3, 3, 3, 3, 3]);
    const markets = await getFootballStatMarkets("Alto", "Bajo", prisma);

    const total = markets.find((m) => m.id === "stat-corners-total");
    expect(total).toBeDefined();
    // 6 + 3 = 9 corners esperados
    expect(Number(total!.value)).toBeCloseTo(9, 1);

    const over85 = markets.find((m) => m.id === "stat-corners-over-8.5");
    expect(over85).toBeDefined();
    expect(over85!.value).toMatch(/%$/);
    // Con media 9, "mas de 8.5" debe ser mas probable que "mas de 10.5".
    const over105 = markets.find((m) => m.id === "stat-corners-over-10.5")!;
    expect(Number(over85!.value.replace("%", ""))).toBeGreaterThan(
      Number(over105.value.replace("%", "")),
    );
  });

  it("devuelve [] si un equipo no tiene muestra suficiente", async () => {
    const prisma = fakePrisma([6, 6], [3, 3, 3, 3, 3]); // "Alto" solo 2 partidos
    const markets = await getFootballStatMarkets("Alto", "Bajo", prisma);
    expect(markets).toEqual([]);
  });

  it("agrupa corners en Produccion y tarjetas/faltas en Disciplina", async () => {
    const prisma = fakePrisma([6, 6, 6, 6, 6], [3, 3, 3, 3, 3]);
    const markets = await getFootballStatMarkets("Alto", "Bajo", prisma);
    expect(markets.every((m) => ["Produccion", "Disciplina", "Control"].includes(m.group))).toBe(true);
    expect(markets.some((m) => m.group === "Produccion")).toBe(true);
  });
});
