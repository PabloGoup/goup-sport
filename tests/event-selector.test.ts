import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  claimAnalysis,
  markEventAnalysisStale,
  selectEventsForAnalysis,
} from "@/application/ai-enrichment/event-selector";

type AnalysisRow = {
  id: string;
  eventId: string;
  inputHash: string;
  promptVersion: string;
  status: string;
  attemptCount: number;
  staleReason: string | null;
  lastAttemptAt: Date | null;
  [key: string]: unknown;
};

/**
 * Prisma falso en memoria con lo minimo que usan selector y feature builder.
 * Las pruebas no tocan base de datos ni la API real de Groq.
 */
function buildFakePrisma() {
  const analyses: AnalysisRow[] = [];
  let sequence = 0;

  const event = {
    id: "event-1",
    startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    season: 2026,
    round: "Jornada 1",
    venue: "Estadio Prueba",
    status: "upcoming",
    sport: { code: "football" },
    league: { name: "Liga de Prueba", country: "Chile", season: 2026 },
    home: { id: "team-a", name: "Equipo A", recentForm: ["W", "W"] },
    away: { id: "team-b", name: "Equipo B", recentForm: ["L"] },
    dataSource: { provider: "OpenFootball" },
  };

  const aggregates: Array<{
    participantId: string;
    scope: string;
    metricKey: string;
    metricValue: number;
    sampleSize: number;
  }> = [];

  const prisma = {
    event: {
      // La consulta de forma historica (status "completed") no aplica en este fake.
      findMany: async (args?: { where?: { status?: unknown } }) =>
        args?.where?.status === "completed" ? [] : [{ id: event.id }],
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === event.id ? event : null,
    },
    teamAggregateMetric: {
      findMany: async ({ where }: { where: { participantId: string } }) =>
        aggregates.filter((row) => row.participantId === where.participantId),
    },
    prediction: {
      findFirst: async () => null,
    },
    eventAnalysis: {
      findUnique: async ({ where }: { where: { eventId_inputHash_promptVersion: { eventId: string; inputHash: string; promptVersion: string } } }) => {
        const key = where.eventId_inputHash_promptVersion;
        return (
          analyses.find(
            (row) =>
              row.eventId === key.eventId &&
              row.inputHash === key.inputHash &&
              row.promptVersion === key.promptVersion,
          ) ?? null
        );
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `analysis-${++sequence}`,
          attemptCount: 0,
          staleReason: null,
          lastAttemptAt: null,
          ...data,
        } as AnalysisRow;
        analyses.push(row);
        return { id: row.id };
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = analyses.find((item) => item.id === where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        let count = 0;
        for (const row of analyses) {
          if (where.id && row.id !== where.id) continue;
          if (where.eventId && row.eventId !== where.eventId) continue;
          if (typeof where.status === "string" && row.status !== where.status) continue;
          count += 1;
          const patch = { ...data } as Record<string, unknown>;
          if (
            patch.attemptCount &&
            typeof patch.attemptCount === "object" &&
            "increment" in (patch.attemptCount as Record<string, unknown>)
          ) {
            row.attemptCount += (patch.attemptCount as { increment: number }).increment;
            delete patch.attemptCount;
          }
          Object.assign(row, patch);
        }
        return { count };
      },
    },
  };

  return { prisma: prisma as unknown as PrismaClient, analyses, aggregates, event };
}

const baseOptions = { promptVersion: "event-analysis-v1", windowDays: 14 };

describe("selectEventsForAnalysis", () => {
  it("crea una fila PENDING para un evento nuevo", async () => {
    const { prisma, analyses } = buildFakePrisma();
    const selected = await selectEventsForAnalysis(prisma, baseOptions);

    expect(selected).toHaveLength(1);
    expect(analyses).toHaveLength(1);
    expect(analyses[0].status).toBe("PENDING");
  });

  it("no duplica filas al ejecutarse dos veces con el mismo input", async () => {
    const { prisma, analyses } = buildFakePrisma();
    await selectEventsForAnalysis(prisma, baseOptions);
    const second = await selectEventsForAnalysis(prisma, baseOptions);

    expect(analyses).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(second[0].analysisId).toBe(analyses[0].id);
  });

  it("omite eventos ya COMPLETED con el mismo hash", async () => {
    const { prisma, analyses } = buildFakePrisma();
    await selectEventsForAnalysis(prisma, baseOptions);
    analyses[0].status = "COMPLETED";

    const second = await selectEventsForAnalysis(prisma, baseOptions);
    expect(second).toHaveLength(0);
    expect(analyses).toHaveLength(1);
  });

  it("regenera cuando cambia el input y marca el anterior como STALE", async () => {
    const { prisma, analyses, aggregates } = buildFakePrisma();
    await selectEventsForAnalysis(prisma, baseOptions);
    analyses[0].status = "COMPLETED";

    // Cambio relevante en los datos deportivos: nueva metrica historica.
    aggregates.push({
      participantId: "team-a",
      scope: "statsbomb-imported-matches",
      metricKey: "xg_total",
      metricValue: 1.8,
      sampleSize: 10,
    });

    const second = await selectEventsForAnalysis(prisma, baseOptions);
    expect(second).toHaveLength(1);
    expect(analyses).toHaveLength(2);
    expect(analyses[0].status).toBe("STALE");
    expect(analyses[0].staleReason).toBe("input-changed");
    expect(analyses[1].status).toBe("PENDING");
  });

  it("en dry-run no escribe filas", async () => {
    const { prisma, analyses } = buildFakePrisma();
    const selected = await selectEventsForAnalysis(prisma, { ...baseOptions, dryRun: true });

    expect(selected).toHaveLength(1);
    expect(selected[0].analysisId).toBeNull();
    expect(analyses).toHaveLength(0);
  });
});

describe("claimAnalysis", () => {
  it("solo un worker puede reservar la misma fila", async () => {
    const { prisma } = buildFakePrisma();
    const [selected] = await selectEventsForAnalysis(prisma, baseOptions);

    const first = await claimAnalysis(prisma, selected.analysisId as string);
    const second = await claimAnalysis(prisma, selected.analysisId as string);

    expect(first).toBe(true);
    expect(second).toBe(false);
  });
});

describe("markEventAnalysisStale", () => {
  it("marca los COMPLETED del evento con el motivo", async () => {
    const { prisma, analyses } = buildFakePrisma();
    await selectEventsForAnalysis(prisma, baseOptions);
    analyses[0].status = "COMPLETED";

    const count = await markEventAnalysisStale(prisma, "event-1", "lineup-confirmed");
    expect(count).toBe(1);
    expect(analyses[0].status).toBe("STALE");
    expect(analyses[0].staleReason).toBe("lineup-confirmed");
  });
});
