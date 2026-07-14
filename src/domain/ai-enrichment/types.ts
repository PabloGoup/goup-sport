import type { EventAnalysisOutput } from "./output-schema";

export type EnrichmentSport = "football" | "basketball" | "tennis";

export type ParticipantFeatures = {
  id: string;
  name: string;
  recentForm?: string[];
  seasonStats?: Record<string, number | string>;
  last5?: Record<string, number | string>;
  last10?: Record<string, number | string>;
  restDays?: number | null;
  sportSpecific?: Record<string, number | string | null>;
};

export type EventAnalysisInput = {
  eventId: string;
  sport: EnrichmentSport;
  competition: {
    name: string;
    country?: string;
    season?: number;
    round?: string;
  };
  startsAt: string;
  venue?: string;
  participantA: ParticipantFeatures;
  participantB: ParticipantFeatures;
  headToHead?: {
    summary: string;
    recentResults: string[];
  } | null;
  statisticalPrediction?: {
    predictedOutcome: string;
    probability: number;
    confidence: number;
    modelVersion: string;
    probabilities1x2?: { homeWin: number; draw: number; awayWin: number };
    topScorelines?: string[];
    caveats?: string[];
  } | null;
  dataAvailability: {
    availableSections: string[];
    missingSections: string[];
    qualityNote: string;
  };
  meta: {
    featureVersion: string;
    predictionVersion?: string;
  };
};

export type ProviderUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  modelName: string;
};

export type ProviderBatchResult = {
  analyses: EventAnalysisOutput[];
  usage: ProviderUsage;
};

export interface AiEnrichmentProvider {
  readonly name: string;
  analyzeEvents(events: EventAnalysisInput[]): Promise<ProviderBatchResult>;
}

export type { EventAnalysisOutput };
