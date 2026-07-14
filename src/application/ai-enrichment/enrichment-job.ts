import type { PrismaClient } from "@prisma/client";
import { validateBatchResponse } from "@/domain/ai-enrichment/output-schema";
import type {
  AiEnrichmentProvider,
  EventAnalysisInput,
  EventAnalysisOutput,
} from "@/domain/ai-enrichment/types";
import { GroqProviderError } from "@/infrastructure/ai/groq/groq-errors";
import { getGroqConfig, type GroqConfig } from "@/infrastructure/ai/groq/groq-config";
import { GroqEnrichmentProvider } from "@/infrastructure/ai/groq/groq-provider";
import { getPrisma } from "@/lib/prisma";
import {
  claimAnalysis,
  recoverOrphanedProcessing,
  selectEventsForAnalysis,
  type SelectedAnalysis,
} from "./event-selector";

export type EnrichmentJobOptions = {
  trigger: "manual" | "cron" | "dry-run";
  dryRun?: boolean;
  eventId?: string;
  limit?: number;
  force?: boolean;
  retryFailed?: boolean;
  /** Inyectables para pruebas. */
  prisma?: PrismaClient;
  provider?: AiEnrichmentProvider;
  config?: GroqConfig;
};

export type EnrichmentJobSummary = {
  jobId: string;
  startedAt: string;
  finishedAt: string;
  selected: number;
  completed: number;
  failed: number;
  skipped: number;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  dryRun: boolean;
  batches: number;
  estimatedPromptTokens?: number;
};

export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error("El tamano de lote debe ser >= 1.");
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

/** Estimacion defensiva: ~4 caracteres por token en JSON compacto. */
export function estimateTokens(inputs: EventAnalysisInput[]): number {
  return Math.ceil(JSON.stringify(inputs).length / 4);
}

/** Sin forma reciente ni metricas historicas en ambos participantes no hay base analizable. */
export function hasEnoughData(input: EventAnalysisInput): boolean {
  const hasSignal = (p: EventAnalysisInput["participantA"]) =>
    Boolean(p.recentForm?.length) ||
    Boolean(p.seasonStats && Object.keys(p.seasonStats).length) ||
    Boolean(p.sportSpecific && Object.keys(p.sportSpecific).some((key) => key.startsWith("score_")));
  return hasSignal(input.participantA) || hasSignal(input.participantB);
}

type Counters = {
  completed: number;
  failed: number;
  skipped: number;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

async function persistCompleted(
  prisma: PrismaClient,
  item: SelectedAnalysis,
  analysis: EventAnalysisOutput,
  usage: { modelName: string; latencyMs: number; promptTokens: number; completionTokens: number; totalTokens: number },
  batchSize: number,
) {
  await prisma.eventAnalysis.update({
    where: { id: item.analysisId as string },
    data: {
      status: "COMPLETED",
      analysisType: analysis.analysisType,
      modelName: usage.modelName,
      confidence: analysis.confidence,
      dataQualityScore: analysis.dataQualityScore,
      headline: analysis.headline,
      shortSummary: analysis.shortSummary,
      detailedSummary: analysis.detailedSummary,
      predictedOutcome: analysis.predictedOutcome,
      possibleResults: analysis.possibleResults,
      observations: analysis.observations,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      uncertainties: analysis.uncertainties,
      keyFactors: analysis.keyFactors,
      playerInsights: analysis.playerInsights,
      visualScores: analysis.visualScores,
      modelLimitations: analysis.modelLimitations,
      rawResponse: JSON.parse(JSON.stringify(analysis)),
      promptTokens: Math.round(usage.promptTokens / batchSize),
      completionTokens: Math.round(usage.completionTokens / batchSize),
      totalTokens: Math.round(usage.totalTokens / batchSize),
      latencyMs: usage.latencyMs,
      generatedAt: new Date(),
      errorCode: null,
      errorMessage: null,
    },
  });
}

async function markFailed(
  prisma: PrismaClient,
  analysisId: string,
  errorCode: string,
  errorMessage: string,
) {
  await prisma.eventAnalysis.update({
    where: { id: analysisId },
    data: { status: "FAILED", errorCode, errorMessage: errorMessage.slice(0, 1000) },
  });
}

async function markSkipped(prisma: PrismaClient, analysisId: string, reason: string) {
  await prisma.eventAnalysis.update({
    where: { id: analysisId },
    data: { status: "SKIPPED", errorCode: "insufficient_data", errorMessage: reason },
  });
}

/**
 * Procesa un lote reservado. Ante respuesta invalida divide el lote en
 * mitades y baja hasta procesar eventos individualmente; el fallo de un
 * evento nunca invalida a los demas.
 */
async function processBatch(
  prisma: PrismaClient,
  provider: AiEnrichmentProvider,
  batch: SelectedAnalysis[],
  counters: Counters,
): Promise<void> {
  if (batch.length === 0) return;

  let result;
  try {
    counters.requests += 1;
    result = await provider.analyzeEvents(batch.map((item) => item.input));
  } catch (error) {
    if (error instanceof GroqProviderError && error.isAuthFailure) throw error;

    const splittable =
      error instanceof GroqProviderError &&
      (error.kind === "invalid_response" || error.kind === "payload_too_large");

    if (splittable && batch.length > 1) {
      const middle = Math.ceil(batch.length / 2);
      console.warn(`[enrich] lote de ${batch.length} invalido; dividiendo en mitades.`);
      await processBatch(prisma, provider, batch.slice(0, middle), counters);
      await processBatch(prisma, provider, batch.slice(middle), counters);
      return;
    }

    const message = error instanceof Error ? error.message : "Error desconocido";
    const code = error instanceof GroqProviderError ? error.kind : "unknown";
    for (const item of batch) {
      await markFailed(prisma, item.analysisId as string, code, message);
      counters.failed += 1;
    }
    return;
  }

  counters.promptTokens += result.usage.promptTokens;
  counters.completionTokens += result.usage.completionTokens;
  counters.totalTokens += result.usage.totalTokens;

  const expectedIds = batch.map((item) => item.eventId);
  const { issues, invalidEventIds, missingEventIds } = validateBatchResponse(
    { analyses: result.analyses },
    expectedIds,
  );

  for (const issue of issues) {
    console.warn(`[enrich] validacion: ${issue.code} ${issue.message}`);
  }

  const byEventId = new Map(result.analyses.map((analysis) => [analysis.eventId, analysis]));

  for (const item of batch) {
    const analysis = byEventId.get(item.eventId);

    if (missingEventIds.has(item.eventId)) {
      await markFailed(
        prisma,
        item.analysisId as string,
        "missing_from_response",
        "El proveedor no devolvio analisis para este evento.",
      );
      counters.failed += 1;
      continue;
    }

    if (!analysis || invalidEventIds.has(item.eventId)) {
      await markFailed(
        prisma,
        item.analysisId as string,
        "invalid_analysis",
        issues
          .filter((issue) => issue.eventId === item.eventId)
          .map((issue) => issue.message)
          .join("; ") || "Analisis invalido.",
      );
      counters.failed += 1;
      continue;
    }

    await persistCompleted(prisma, item, analysis, result.usage, batch.length);
    counters.completed += 1;
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    for (;;) {
      const item = queue.shift();
      if (item === undefined) return;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

export async function runEnrichmentJob(
  options: EnrichmentJobOptions,
): Promise<EnrichmentJobSummary> {
  const config = options.config ?? getGroqConfig();
  const prisma = options.prisma ?? getPrisma();
  const dryRun = Boolean(options.dryRun);
  const startedAt = new Date();

  if (!dryRun && !config.enabled) {
    throw new Error(
      "GROQ_ENRICHMENT_ENABLED=false: el job solo puede ejecutarse en modo --dry-run hasta activar la integracion.",
    );
  }

  const jobRun = dryRun
    ? null
    : await prisma.enrichmentJobRun.create({
        data: { trigger: options.trigger, startedAt, status: "running" },
        select: { id: true },
      });
  const jobId = jobRun?.id ?? `dry-run-${startedAt.getTime()}`;

  const counters: Counters = {
    completed: 0,
    failed: 0,
    skipped: 0,
    requests: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  try {
    if (!dryRun) {
      const recovered = await recoverOrphanedProcessing(prisma);
      if (recovered > 0) console.warn(`[enrich] ${recovered} analisis PROCESSING recuperados a PENDING.`);
    }

    const selected = await selectEventsForAnalysis(prisma, {
      promptVersion: config.promptVersion,
      windowDays: config.windowDays,
      eventId: options.eventId,
      limit: options.limit,
      force: options.force,
      retryFailed: options.retryFailed,
      dryRun,
    });

    const batches = chunk(selected, config.batchSize);

    if (dryRun) {
      const finishedAt = new Date();
      return {
        jobId,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        selected: selected.length,
        completed: 0,
        failed: 0,
        skipped: 0,
        requests: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        dryRun: true,
        batches: batches.length,
        estimatedPromptTokens: estimateTokens(selected.map((item) => item.input)),
      };
    }

    const provider = options.provider ?? new GroqEnrichmentProvider(config);

    // Reserva atomica + descarte temprano de eventos sin datos suficientes.
    const processable: SelectedAnalysis[] = [];
    for (const item of selected) {
      if (!item.analysisId) continue;
      const claimed = await claimAnalysis(prisma, item.analysisId);
      if (!claimed) continue;

      if (!hasEnoughData(item.input)) {
        await markSkipped(
          prisma,
          item.analysisId,
          "Sin forma reciente ni metricas historicas para ninguno de los participantes.",
        );
        counters.skipped += 1;
        continue;
      }
      processable.push(item);
    }

    const claimedBatches = chunk(processable, config.batchSize);
    await runWithConcurrency(claimedBatches, config.maxConcurrency, (batch) =>
      processBatch(prisma, provider, batch, counters),
    );

    const finishedAt = new Date();
    const summary: EnrichmentJobSummary = {
      jobId,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      selected: selected.length,
      completed: counters.completed,
      failed: counters.failed,
      skipped: counters.skipped,
      requests: counters.requests,
      promptTokens: counters.promptTokens,
      completionTokens: counters.completionTokens,
      totalTokens: counters.totalTokens,
      dryRun: false,
      batches: claimedBatches.length,
    };

    await prisma.enrichmentJobRun.update({
      where: { id: jobId },
      data: {
        finishedAt,
        status: "completed",
        selected: summary.selected,
        completed: summary.completed,
        failed: summary.failed,
        skipped: summary.skipped,
        requests: summary.requests,
        promptTokens: summary.promptTokens,
        completionTokens: summary.completionTokens,
        totalTokens: summary.totalTokens,
      },
    });

    return summary;
  } catch (error) {
    if (jobRun) {
      await prisma.enrichmentJobRun
        .update({
          where: { id: jobId },
          data: {
            finishedAt: new Date(),
            status: "failed",
            error: error instanceof Error ? error.message : "Error desconocido",
            completed: counters.completed,
            failed: counters.failed,
            skipped: counters.skipped,
            requests: counters.requests,
            promptTokens: counters.promptTokens,
            completionTokens: counters.completionTokens,
            totalTokens: counters.totalTokens,
          },
        })
        .catch(() => undefined);
    }
    throw error;
  }
}
