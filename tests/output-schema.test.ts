import { describe, expect, it } from "vitest";
import {
  batchResponseSchema,
  validateBatchResponse,
} from "@/domain/ai-enrichment/output-schema";
import { buildSampleAnalysis } from "./fixtures";

describe("batchResponseSchema", () => {
  it("acepta una respuesta valida", () => {
    const result = batchResponseSchema.safeParse({ analyses: [buildSampleAnalysis()] });
    expect(result.success).toBe(true);
  });

  it("rechaza probabilidades fuera de [0,1]", () => {
    const analysis = buildSampleAnalysis({ confidence: 1.5 });
    expect(batchResponseSchema.safeParse({ analyses: [analysis] }).success).toBe(false);
  });

  it("rechaza puntuaciones visuales fuera de [0,100]", () => {
    const analysis = buildSampleAnalysis();
    analysis.visualScores.participantA.overall = 140;
    expect(batchResponseSchema.safeParse({ analyses: [analysis] }).success).toBe(false);
  });

  it("rechaza propiedades desconocidas", () => {
    const analysis = { ...buildSampleAnalysis(), invented: true };
    expect(batchResponseSchema.safeParse({ analyses: [analysis] }).success).toBe(false);
  });

  it("rechaza valores enum invalidos", () => {
    const analysis = buildSampleAnalysis({ analysisType: "MAGIC" as never });
    expect(batchResponseSchema.safeParse({ analyses: [analysis] }).success).toBe(false);
  });

  it("rechaza textos que exceden la longitud maxima", () => {
    const analysis = buildSampleAnalysis({ headline: "x".repeat(200) });
    expect(batchResponseSchema.safeParse({ analyses: [analysis] }).success).toBe(false);
  });
});

describe("validateBatchResponse", () => {
  it("acepta un lote correcto y completo", () => {
    const result = validateBatchResponse({ analyses: [buildSampleAnalysis()] }, ["event-1"]);
    expect(result.issues).toHaveLength(0);
    expect(result.invalidEventIds.size).toBe(0);
    expect(result.missingEventIds.size).toBe(0);
  });

  it("detecta IDs desconocidos", () => {
    const result = validateBatchResponse(
      { analyses: [buildSampleAnalysis({ eventId: "intruso" })] },
      ["event-1"],
    );
    expect(result.issues.some((issue) => issue.code === "unknown_event_id")).toBe(true);
    expect(result.missingEventIds.has("event-1")).toBe(true);
  });

  it("detecta IDs duplicados", () => {
    const result = validateBatchResponse(
      { analyses: [buildSampleAnalysis(), buildSampleAnalysis()] },
      ["event-1"],
    );
    expect(result.issues.some((issue) => issue.code === "duplicate_event_id")).toBe(true);
  });

  it("detecta sumas de probabilidades invalidas", () => {
    const analysis = buildSampleAnalysis({
      possibleResults: [
        { label: "A", probability: 0.9, source: "EXPERIMENTAL_AI" },
        { label: "B", probability: 0.9, source: "EXPERIMENTAL_AI" },
      ],
    });
    const result = validateBatchResponse({ analyses: [analysis] }, ["event-1"]);
    expect(result.issues.some((issue) => issue.code === "probability_sum_out_of_range")).toBe(true);
    expect(result.invalidEventIds.has("event-1")).toBe(true);
  });

  it("detecta confianza incoherente con la calidad de datos", () => {
    const analysis = buildSampleAnalysis({ confidence: 0.95, dataQualityScore: 0.2 });
    const result = validateBatchResponse({ analyses: [analysis] }, ["event-1"]);
    expect(
      result.issues.some((issue) => issue.code === "confidence_exceeds_data_quality"),
    ).toBe(true);
  });

  it("reporta eventos ausentes sin invalidar al resto", () => {
    const result = validateBatchResponse({ analyses: [buildSampleAnalysis()] }, [
      "event-1",
      "event-2",
    ]);
    expect(result.missingEventIds.has("event-2")).toBe(true);
    expect(result.invalidEventIds.has("event-1")).toBe(false);
  });
});
