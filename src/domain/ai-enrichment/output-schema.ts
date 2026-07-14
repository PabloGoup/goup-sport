import { z } from "zod";

const probability = z.number().min(0).max(1);
const visualScore = z.number().min(0).max(100);
const shortText = z.string().min(1).max(240);

const visualScoreBlock = z
  .object({
    overall: visualScore,
    form: visualScore,
    attack: visualScore,
    defense: visualScore,
    consistency: visualScore,
    momentum: visualScore,
  })
  .strict();

export const eventAnalysisOutputSchema = z
  .object({
    eventId: z.string().min(1).max(120),
    analysisType: z.enum(["STATISTICAL", "EXPERIMENTAL_AI", "HYBRID"]),
    headline: z.string().min(1).max(160),
    shortSummary: z.string().min(1).max(400),
    detailedSummary: z.string().min(1).max(2500),
    confidence: probability,
    dataQualityScore: probability,
    predictedOutcome: z
      .object({
        label: shortText,
        explanation: z.string().min(1).max(600),
      })
      .strict(),
    possibleResults: z
      .array(
        z
          .object({
            label: shortText,
            probability,
            source: z.enum(["STATISTICAL_MODEL", "EXPERIMENTAL_AI"]),
          })
          .strict(),
      )
      .max(12),
    observations: z
      .array(
        z
          .object({
            title: shortText,
            description: z.string().min(1).max(600),
            category: z.enum(["FORM", "ATTACK", "DEFENSE", "CONTEXT", "PLAYER", "HISTORY", "OTHER"]),
            importance: z.number().min(0).max(1),
          })
          .strict(),
      )
      .max(12),
    strengths: z
      .object({
        participantA: z.array(shortText).max(8),
        participantB: z.array(shortText).max(8),
      })
      .strict(),
    weaknesses: z
      .object({
        participantA: z.array(shortText).max(8),
        participantB: z.array(shortText).max(8),
      })
      .strict(),
    uncertainties: z
      .array(
        z
          .object({
            description: z.string().min(1).max(400),
            severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
          })
          .strict(),
      )
      .max(12),
    keyFactors: z
      .array(
        z
          .object({
            key: z.string().min(1).max(80),
            label: shortText,
            description: z.string().min(1).max(600),
            direction: z.enum(["PARTICIPANT_A", "PARTICIPANT_B", "NEUTRAL"]),
            impact: z.number().min(0).max(1),
          })
          .strict(),
      )
      .max(12),
    playerInsights: z
      .array(
        z
          .object({
            playerId: z.string().max(120).nullable(),
            playerName: shortText,
            observation: z.string().min(1).max(600),
            confidence: probability,
          })
          .strict(),
      )
      .max(12),
    visualScores: z
      .object({
        participantA: visualScoreBlock,
        participantB: visualScoreBlock,
      })
      .strict(),
    modelLimitations: z.array(z.string().min(1).max(400)).max(12),
  })
  .strict();

export const batchResponseSchema = z
  .object({
    analyses: z.array(eventAnalysisOutputSchema).max(50),
  })
  .strict();

export type EventAnalysisOutput = z.infer<typeof eventAnalysisOutputSchema>;
export type BatchResponse = z.infer<typeof batchResponseSchema>;

/** JSON Schema para Structured Outputs de Groq (`response_format: json_schema`). */
export function buildBatchResponseJsonSchema() {
  return z.toJSONSchema(batchResponseSchema, { target: "draft-7" });
}

const PROBABILITY_SUM_TOLERANCE = 0.08;

export type BatchValidationIssue = {
  code:
    | "unknown_event_id"
    | "duplicate_event_id"
    | "missing_event_id"
    | "probability_sum_out_of_range"
    | "confidence_exceeds_data_quality";
  eventId?: string;
  message: string;
};

/**
 * Reglas que Zod no expresa: pertenencia de IDs al lote, duplicados,
 * suma de probabilidades y coherencia confianza/calidad de datos.
 * Los eventos ausentes se reportan pero no invalidan al resto (pueden
 * haberse omitido por datos insuficientes).
 */
export function validateBatchResponse(
  response: BatchResponse,
  expectedEventIds: string[],
): { issues: BatchValidationIssue[]; invalidEventIds: Set<string>; missingEventIds: Set<string> } {
  const issues: BatchValidationIssue[] = [];
  const invalidEventIds = new Set<string>();
  const expected = new Set(expectedEventIds);
  const seen = new Set<string>();

  for (const analysis of response.analyses) {
    if (!expected.has(analysis.eventId)) {
      issues.push({
        code: "unknown_event_id",
        eventId: analysis.eventId,
        message: `eventId ${analysis.eventId} no pertenece al lote.`,
      });
      invalidEventIds.add(analysis.eventId);
      continue;
    }

    if (seen.has(analysis.eventId)) {
      issues.push({
        code: "duplicate_event_id",
        eventId: analysis.eventId,
        message: `eventId ${analysis.eventId} aparece duplicado en la respuesta.`,
      });
      invalidEventIds.add(analysis.eventId);
      continue;
    }
    seen.add(analysis.eventId);

    if (analysis.possibleResults.length > 0) {
      const sum = analysis.possibleResults.reduce((acc, item) => acc + item.probability, 0);
      if (Math.abs(sum - 1) > PROBABILITY_SUM_TOLERANCE) {
        issues.push({
          code: "probability_sum_out_of_range",
          eventId: analysis.eventId,
          message: `Las probabilidades de ${analysis.eventId} suman ${sum.toFixed(3)}, fuera de tolerancia.`,
        });
        invalidEventIds.add(analysis.eventId);
      }
    }

    if (analysis.confidence > analysis.dataQualityScore + 0.15) {
      issues.push({
        code: "confidence_exceeds_data_quality",
        eventId: analysis.eventId,
        message: `La confianza de ${analysis.eventId} supera la calidad de datos sin justificacion.`,
      });
      invalidEventIds.add(analysis.eventId);
    }
  }

  const missingEventIds = new Set(expectedEventIds.filter((id) => !seen.has(id)));

  return { issues, invalidEventIds, missingEventIds };
}
