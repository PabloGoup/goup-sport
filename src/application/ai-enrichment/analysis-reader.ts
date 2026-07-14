import type { EventAnalysis } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { InMemoryAnalysisCache } from "./cache";

/**
 * DTO publico del analisis. Nunca expone rawResponse, inputSnapshot completo,
 * errores internos ni detalles sensibles del proveedor.
 */
export type PublicEventAnalysis = {
  eventId: string;
  status: string;
  analysisType: string;
  generatedAt: string | null;
  modelName: string | null;
  promptVersion: string;
  confidence: number | null;
  dataQualityScore: number | null;
  headline: string | null;
  shortSummary: string | null;
  detailedSummary: string | null;
  predictedOutcome: unknown;
  possibleResults: unknown;
  observations: unknown;
  strengths: unknown;
  weaknesses: unknown;
  uncertainties: unknown;
  keyFactors: unknown;
  playerInsights: unknown;
  visualScores: unknown;
  modelLimitations: unknown;
};

const cache = new InMemoryAnalysisCache<PublicEventAnalysis>();

function toPublicDto(analysis: EventAnalysis): PublicEventAnalysis {
  return {
    eventId: analysis.eventId,
    status: analysis.status,
    analysisType: analysis.analysisType,
    generatedAt: analysis.generatedAt?.toISOString() ?? null,
    modelName: analysis.status === "COMPLETED" ? analysis.modelName : null,
    promptVersion: analysis.promptVersion,
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
  };
}

/**
 * Devuelve el analisis vigente de un evento: el COMPLETED mas reciente o, en
 * su defecto, el estado del ultimo intento (PENDING/PROCESSING/FAILED/SKIPPED)
 * para que la UI pueda comunicarlo sin bloquear la pagina.
 */
export async function getLatestEventAnalysis(
  eventId: string,
): Promise<PublicEventAnalysis | null> {
  try {
    const prisma = getPrisma();

    const completed = await prisma.eventAnalysis.findFirst({
      where: { eventId, status: "COMPLETED" },
      orderBy: { generatedAt: "desc" },
    });

    if (completed) {
      const cacheKey = `${eventId}:${completed.inputHash}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const dto = toPublicDto(completed);
      cache.set(cacheKey, dto);
      return dto;
    }

    const latest = await prisma.eventAnalysis.findFirst({
      where: { eventId },
      orderBy: { createdAt: "desc" },
    });

    return latest ? toPublicDto(latest) : null;
  } catch {
    return null;
  }
}

/** Historial de analisis completados o stale, del mas reciente al mas antiguo. */
export async function getEventAnalysisHistory(eventId: string): Promise<PublicEventAnalysis[]> {
  try {
    const prisma = getPrisma();
    const rows = await prisma.eventAnalysis.findMany({
      where: { eventId, status: { in: ["COMPLETED", "STALE"] } },
      orderBy: { generatedAt: "desc" },
      take: 20,
    });
    return rows.map(toPublicDto);
  } catch {
    return [];
  }
}
