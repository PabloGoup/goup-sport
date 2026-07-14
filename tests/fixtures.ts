import type { EventAnalysisOutput } from "@/domain/ai-enrichment/output-schema";
import type { EventAnalysisInput } from "@/domain/ai-enrichment/types";

export function buildSampleInput(overrides: Partial<EventAnalysisInput> = {}): EventAnalysisInput {
  return {
    eventId: "event-1",
    sport: "football",
    competition: { name: "Liga de Prueba", country: "Chile", season: 2026 },
    startsAt: "2026-07-20T18:00:00.000Z",
    venue: "Estadio Prueba",
    participantA: {
      id: "team-a",
      name: "Equipo A",
      recentForm: ["W", "D", "W"],
      seasonStats: { "statsbomb-imported-matches:xg_total": 1.62 },
    },
    participantB: {
      id: "team-b",
      name: "Equipo B",
      recentForm: ["L", "L", "D"],
    },
    headToHead: null,
    statisticalPrediction: null,
    dataAvailability: {
      availableSections: ["competition", "participants", "schedule"],
      missingSections: ["headToHead", "injuries"],
      qualityNote: "Cobertura parcial.",
    },
    meta: { featureVersion: "feature-builder-v1" },
    ...overrides,
  };
}

const visualScoreBlock = {
  overall: 70,
  form: 65,
  attack: 72,
  defense: 60,
  consistency: 58,
  momentum: 66,
};

export function buildSampleAnalysis(
  overrides: Partial<EventAnalysisOutput> = {},
): EventAnalysisOutput {
  return {
    eventId: "event-1",
    analysisType: "EXPERIMENTAL_AI",
    headline: "Equipo A llega con mejor forma reciente",
    shortSummary: "El Equipo A acumula mejores resultados recientes que el Equipo B.",
    detailedSummary:
      "Con los datos disponibles, el Equipo A muestra una forma reciente superior. Faltan datos de enfrentamientos directos y ausencias.",
    confidence: 0.4,
    dataQualityScore: 0.5,
    predictedOutcome: {
      label: "Ligera ventaja del Equipo A",
      explanation: "Basado exclusivamente en la forma reciente entregada en el input.",
    },
    possibleResults: [
      { label: "Victoria Equipo A", probability: 0.45, source: "EXPERIMENTAL_AI" },
      { label: "Empate", probability: 0.3, source: "EXPERIMENTAL_AI" },
      { label: "Victoria Equipo B", probability: 0.25, source: "EXPERIMENTAL_AI" },
    ],
    observations: [
      {
        title: "Forma reciente dispar",
        description: "El Equipo A registra dos victorias recientes; el Equipo B no gana.",
        category: "FORM",
        importance: 0.8,
      },
    ],
    strengths: {
      participantA: ["Forma reciente positiva"],
      participantB: [],
    },
    weaknesses: {
      participantA: [],
      participantB: ["Racha negativa reciente"],
    },
    uncertainties: [
      { description: "No hay datos de enfrentamientos directos.", severity: "MEDIUM" },
    ],
    keyFactors: [
      {
        key: "recent_form",
        label: "Forma reciente",
        description: "Diferencia clara de resultados recientes entre ambos equipos.",
        direction: "PARTICIPANT_A",
        impact: 0.7,
      },
    ],
    playerInsights: [],
    visualScores: {
      participantA: visualScoreBlock,
      participantB: { ...visualScoreBlock, overall: 52, form: 40 },
    },
    modelLimitations: ["Analisis experimental sin modelo estadistico propio validado."],
    ...overrides,
  };
}
