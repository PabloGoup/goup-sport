export type Sport = "football" | "basketball" | "tennis";

export type EventStatus = "live" | "today" | "upcoming";

export type EventSort = "confidence" | "startsAt" | "today";

export type DataSource = {
  id: string;
  provider: string;
  collectedAt: string;
  normalizedVersion: string;
};

export type Team = {
  id: string;
  name: string;
  shortName: string;
  form: string[];
  recentResults?: Array<{
    result: "W" | "D" | "L";
    opponent: string;
    score: string;
    date: string;
    competition: string;
  }>;
  logoUrl?: string;
  country?: string;
  tablePosition?: number;
};

export type EventInsight = {
  id: string;
  sport: Sport;
  league: string;
  leagueId?: string;
  country?: string;
  season?: number;
  round?: string;
  startsAt: string;
  status: EventStatus;
  statusLabel?: string;
  home: Team;
  away: Team;
  venue: string;
  confidence: number;
  modelVersion: string;
  source: DataSource;
  rawPayload?: unknown;
};

export type ModelFactor = {
  label: string;
  impact: number;
  explanation: string;
  value?: string;
  direction?: "positive" | "negative" | "uncertain";
  source?: string;
  updatedAt?: string;
};

export type Prediction = {
  eventId: string;
  predictedOutcome: string;
  confidence: number;
  probability: number;
  modelVersion: string;
  generatedAt: string;
  factors: ModelFactor[];
  caveats: string[];
};

export type NewsItem = {
  id: string;
  title: string;
  source: string;
  sport: Sport;
  publishedAt: string;
};

export type SearchResult = {
  id: string;
  type: "event" | "prediction" | "news";
  title: string;
  subtitle: string;
  href: string;
  sport?: Sport;
};

export type ProbabilitySet = {
  homeWin: number;
  draw?: number;
  awayWin: number;
};

export type ScoreProjection = {
  home: number;
  away: number;
  label: string;
  interval: string;
};

export type MatchScoreComponent = {
  label: string;
  score: number;
  explanation: string;
};

export type TeamAttributeComparison = {
  label: string;
  home: number;
  away: number;
};

export type ExpectedStat = {
  label: string;
  home: string;
  away: string;
};

export type HeadToHeadMatch = {
  date: string;
  competition: string;
  home: string;
  away: string;
  score: string;
};

export type PlayerAttribute = {
  label: string;
  value: number;
};

export type FeaturedPlayerCard = {
  id: string;
  name: string;
  team: string;
  position: string;
  nationality: string;
  score: number;
  form: number;
  projection: string;
  attributes: PlayerAttribute[];
};

export type HistoricalTeamMetric = {
  label: string;
  home: string;
  away: string;
  source: string;
  sampleSize: number;
};

export type PredictiveMarket = {
  id: string;
  group: "Resultado" | "Goles" | "Produccion" | "Disciplina" | "Control";
  label: string;
  value: string;
  detail?: string;
  confidence?: number;
};

export type MatchAnalysis = {
  eventId: string;
  headline: string;
  favorite: string;
  updatedAt: string;
  probabilities: ProbabilitySet;
  projectedScore: ScoreProjection;
  confidence: number;
  riskLevel: "Bajo" | "Medio" | "Alto";
  matchScore: number;
  matchScoreLabel: string;
  matchScoreComponents: MatchScoreComponent[];
  scorelines: Array<{ label: string; probability: number }>;
  simulations: {
    total: number;
    homeWins: number;
    draws?: number;
    awayWins: number;
  };
  teamComparison: TeamAttributeComparison[];
  expectedStats: ExpectedStat[];
  favorableFactors: ModelFactor[];
  unfavorableFactors: ModelFactor[];
  uncertainties: ModelFactor[];
  headToHead: HeadToHeadMatch[];
  featuredPlayers: FeaturedPlayerCard[];
  historicalMetrics?: HistoricalTeamMetric[];
  predictiveMarkets: PredictiveMarket[];
};
