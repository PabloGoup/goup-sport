import type { PrismaClient } from "@prisma/client";
import type { EventAnalysisInput } from "@/domain/ai-enrichment/types";
import { buildEventAnalysisInput } from "./feature-builder";
import { buildInputHash } from "./input-hash";

const ORPHAN_PROCESSING_MINUTES = 30;
const MAX_ATTEMPTS = 3;

export type SelectionOptions = {
  promptVersion: string;
  windowDays: number;
  eventId?: string;
  limit?: number;
  force?: boolean;
  retryFailed?: boolean;
  dryRun?: boolean;
};

export type SelectedAnalysis = {
  /** null en dry-run: no se crean filas. */
  analysisId: string | null;
  eventId: string;
  inputHash: string;
  input: EventAnalysisInput;
};

/** PROCESSING huerfano (worker caido) vuelve a PENDING para ser recuperable. */
export async function recoverOrphanedProcessing(prisma: PrismaClient): Promise<number> {
  const threshold = new Date(Date.now() - ORPHAN_PROCESSING_MINUTES * 60 * 1000);
  const result = await prisma.eventAnalysis.updateMany({
    where: { status: "PROCESSING", lastAttemptAt: { lt: threshold } },
    data: { status: "PENDING" },
  });
  return result.count;
}

/** Marca como STALE los analisis COMPLETED vigentes de un evento, con motivo auditable. */
export async function markEventAnalysisStale(
  prisma: PrismaClient,
  eventId: string,
  reason: string,
): Promise<number> {
  const result = await prisma.eventAnalysis.updateMany({
    where: { eventId, status: "COMPLETED" },
    data: { status: "STALE", staleReason: reason },
  });
  return result.count;
}

/**
 * Reserva atomica: solo un worker puede pasar la fila de PENDING a PROCESSING.
 * Devuelve false si otro worker la tomo primero.
 */
export async function claimAnalysis(prisma: PrismaClient, analysisId: string): Promise<boolean> {
  const result = await prisma.eventAnalysis.updateMany({
    where: { id: analysisId, status: "PENDING" },
    data: { status: "PROCESSING", lastAttemptAt: new Date(), attemptCount: { increment: 1 } },
  });
  return result.count === 1;
}

/**
 * Selecciona eventos que necesitan analisis y materializa filas PENDING.
 * Criterios: sin analisis vigente para (eventId, inputHash, promptVersion),
 * FAILED con reintentos disponibles, o hash de entrada cambiado (el analisis
 * anterior pasa a STALE). Ejecutar dos veces seguidas no duplica trabajo.
 */
export async function selectEventsForAnalysis(
  prisma: PrismaClient,
  options: SelectionOptions,
): Promise<SelectedAnalysis[]> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + options.windowDays * 24 * 60 * 60 * 1000);

  const events = await prisma.event.findMany({
    where: {
      ...(options.eventId
        ? { id: options.eventId }
        : {
            startsAt: { gte: now, lte: windowEnd },
            status: { in: ["live", "today", "upcoming"] },
          }),
    },
    select: { id: true },
    orderBy: { startsAt: "asc" },
    take: options.limit ?? 500,
  });

  const selected: SelectedAnalysis[] = [];

  for (const event of events) {
    const input = await buildEventAnalysisInput(prisma, event.id);
    if (!input) continue;

    const inputHash = buildInputHash(input, options.promptVersion);

    if (options.dryRun) {
      selected.push({ analysisId: null, eventId: event.id, inputHash, input });
      continue;
    }

    const existing = await prisma.eventAnalysis.findUnique({
      where: {
        eventId_inputHash_promptVersion: {
          eventId: event.id,
          inputHash,
          promptVersion: options.promptVersion,
        },
      },
      select: { id: true, status: true, attemptCount: true },
    });

    if (!existing) {
      // El input cambio (o es la primera vez): el analisis COMPLETED anterior queda STALE.
      await markEventAnalysisStale(prisma, event.id, "input-changed");

      const created = await prisma.eventAnalysis.create({
        data: {
          eventId: event.id,
          provider: "groq",
          modelName: "",
          promptVersion: options.promptVersion,
          featureVersion: input.meta.featureVersion,
          predictionVersion: input.meta.predictionVersion ?? null,
          inputHash,
          status: "PENDING",
          analysisType: "EXPERIMENTAL_AI",
          inputSnapshot: JSON.parse(JSON.stringify(input)),
        },
        select: { id: true },
      });

      selected.push({ analysisId: created.id, eventId: event.id, inputHash, input });
      continue;
    }

    const retryableFailed =
      existing.status === "FAILED" &&
      (options.retryFailed || existing.attemptCount < MAX_ATTEMPTS);

    if (existing.status === "PENDING") {
      selected.push({ analysisId: existing.id, eventId: event.id, inputHash, input });
    } else if (retryableFailed || (options.force && existing.status !== "PROCESSING")) {
      await prisma.eventAnalysis.update({
        where: { id: existing.id },
        data: { status: "PENDING", errorCode: null, errorMessage: null },
      });
      selected.push({ analysisId: existing.id, eventId: event.id, inputHash, input });
    }
    // COMPLETED/SKIPPED con mismo hash (sin --force) y PROCESSING activos se omiten.
  }

  return selected;
}
