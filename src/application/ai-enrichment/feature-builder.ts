import type { PrismaClient } from "@prisma/client";
import type {
  EnrichmentSport,
  EventAnalysisInput,
  ParticipantFeatures,
} from "@/domain/ai-enrichment/types";
import { getFootballRecentForm } from "@/application/sports-intelligence/football-history-context";
import { getFootballStatisticalPrediction } from "@/application/prediction/football-prediction";
import { getTennisRecentForm } from "@/application/sports-intelligence/tennis-history-context";
import { buildBasketballSpecific } from "./feature-builder-basketball";
import { buildFootballSpecific } from "./feature-builder-football";
import type { AggregatesByScope } from "./feature-builder-shared";
import { buildTennisSpecific } from "./feature-builder-tennis";

export const FEATURE_VERSION = "feature-builder-v1";

const sportSpecificBuilders: Record<
  EnrichmentSport,
  (aggregates: AggregatesByScope) => Record<string, number | string>
> = {
  football: buildFootballSpecific,
  basketball: buildBasketballSpecific,
  tennis: buildTennisSpecific,
};

type EventWithRelations = {
  id: string;
  startsAt: Date;
  season: number | null;
  round: string | null;
  venue: string;
  sport: { code: string };
  league: { name: string; country: string | null; season: number | null };
  home: { id: string; name: string; recentForm: string[] };
  away: { id: string; name: string; recentForm: string[] };
  dataSource: { provider: string };
  rawPayload: unknown;
  status: string;
  statusLabel: string | null;
};

/**
 * Evita mezclar temporadas en la forma reciente. Un evento del Mundial 2026
 * (OpenFootball) solo debe considerar partidos de ese proveedor, no resultados
 * del Mundial 2022 (StatsBomb). Alineado con la logica de la UI.
 */
function recentFormProviders(event: EventWithRelations): string[] {
  if (
    event.dataSource.provider === "OpenFootball" &&
    (event.season ?? event.league.season) === 2026 &&
    event.league.name === "World Cup"
  ) {
    return ["OpenFootball"];
  }
  return ["OpenFootball", "StatsBomb Open Data", "TheSportsDB", "API-Sports Football"];
}

async function loadAggregates(
  prisma: PrismaClient,
  participantId: string,
): Promise<AggregatesByScope> {
  const rows = await prisma.teamAggregateMetric.findMany({
    where: { participantId },
    select: { scope: true, metricKey: true, metricValue: true, sampleSize: true },
  });

  const byScope: AggregatesByScope = {};
  for (const row of rows) {
    byScope[row.scope] = byScope[row.scope] ?? { metrics: {}, sampleSize: row.sampleSize };
    byScope[row.scope].metrics[row.metricKey] = row.metricValue;
    byScope[row.scope].sampleSize = Math.max(byScope[row.scope].sampleSize, row.sampleSize);
  }
  return byScope;
}

function buildParticipant(
  participant: EventWithRelations["home"],
  aggregates: AggregatesByScope,
  sport: EnrichmentSport,
  derivedForm: string[],
  providerSignals: Record<string, number | string | null> = {},
): ParticipantFeatures {
  const sportSpecific = sportSpecificBuilders[sport](aggregates);

  const seasonStats: Record<string, number | string> = {};
  for (const [scope, entry] of Object.entries(aggregates)) {
    for (const [key, value] of Object.entries(entry.metrics)) {
      seasonStats[`${scope}:${key}`] = value;
    }
  }

  // La forma almacenada tiene prioridad; si esta vacia se usa la derivada de
  // partidos completados reales (misma fuente que la UI). Nunca se inventa.
  const recentForm = participant.recentForm.length > 0 ? participant.recentForm : derivedForm;

  const features: ParticipantFeatures = {
    id: participant.id,
    name: participant.name,
  };
  if (recentForm.length > 0) features.recentForm = recentForm;
  if (Object.keys(seasonStats).length > 0) features.seasonStats = seasonStats;
  const mergedSportSpecific = { ...sportSpecific, ...providerSignals };
  if (Object.keys(mergedSportSpecific).length > 0) features.sportSpecific = mergedSportSpecific;

  return features;
}

function basketballScoreSignals(rawPayload: unknown) {
  const payload = rawPayload && typeof rawPayload === "object" ? (rawPayload as Record<string, unknown>) : {};
  const scores = payload.scores && typeof payload.scores === "object" ? (payload.scores as Record<string, unknown>) : {};
  const readTeam = (side: "home" | "away") => {
    const item = scores[side] && typeof scores[side] === "object" ? (scores[side] as Record<string, unknown>) : {};
    const output: Record<string, number | string | null> = {};
    for (const [source, target] of [
      ["total", "score_total"],
      ["quarter_1", "score_q1"],
      ["quarter_2", "score_q2"],
      ["quarter_3", "score_q3"],
      ["quarter_4", "score_q4"],
    ] as const) {
      const value = item[source];
      if (typeof value === "number") output[target] = value;
    }
    return output;
  };

  return {
    home: readTeam("home"),
    away: readTeam("away"),
  };
}

function rawObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseNumericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.trim().replace("%", "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMetricKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "");
}

function basketballTeamId(rawPayload: unknown, side: "home" | "away") {
  const payload = rawObject(rawPayload);
  const teams = rawObject(payload.teams);
  const team = rawObject(teams[side]);
  const id = team.id;
  return typeof id === "string" || typeof id === "number" ? String(id) : "";
}

function basketballDetailSignals(rawPayload: unknown) {
  const payload = rawObject(rawPayload);
  const details = rawObject(payload.apiSportsBasketballDetails);
  const stats = details.teamStatistics;
  if (!Array.isArray(stats)) return { home: {}, away: {} };

  const readSide = (side: "home" | "away") => {
    const expectedTeamId = basketballTeamId(rawPayload, side);
    const item = stats.find((entry) => {
      const teamId = rawObject(rawObject(entry).team).id;
      return expectedTeamId && String(teamId ?? "") === expectedTeamId;
    });
    const statistics = rawObject(item).statistics;
    const output: Record<string, number | string | null> = {};

    if (Array.isArray(statistics)) {
      for (const stat of statistics) {
        const object = rawObject(stat);
        const label = object.type ?? object.name ?? object.label ?? object.key;
        const value = object.value ?? object.total ?? object.number;
        if (typeof label !== "string") continue;
        const parsed = parseNumericValue(value);
        if (parsed !== null) output[`team_stat_${normalizeMetricKey(label)}`] = parsed;
      }
      return output;
    }

    for (const [key, value] of Object.entries(rawObject(statistics ?? item))) {
      if (["team", "game", "country", "league"].includes(key)) continue;
      const parsed = parseNumericValue(value);
      if (parsed !== null) output[`team_stat_${normalizeMetricKey(key)}`] = parsed;
    }

    return output;
  };

  return {
    home: readSide("home"),
    away: readSide("away"),
  };
}

async function deriveRecentForm(
  sport: EnrichmentSport,
  name: string,
  providers: string[],
  prisma: PrismaClient,
) {
  if (sport === "football") {
    return getFootballRecentForm(name, { providers }, prisma).then((form) => [...form].reverse());
  }
  if (sport === "tennis") {
    return getTennisRecentForm(name).then((form) => [...form].reverse());
  }
  return [];
}

function describeAvailability(input: {
  participantA: ParticipantFeatures;
  participantB: ParticipantFeatures;
  hasPrediction: boolean;
  extraAvailable?: string[];
}) {
  const available: string[] = ["competition", "participants", "schedule", ...(input.extraAvailable ?? [])];
  const missing: string[] = [];

  const check = (label: string, present: boolean) =>
    (present ? available : missing).push(label);

  check("recentFormA", Boolean(input.participantA.recentForm?.length));
  check("recentFormB", Boolean(input.participantB.recentForm?.length));
  check("historicalMetricsA", Boolean(input.participantA.seasonStats));
  check("historicalMetricsB", Boolean(input.participantB.seasonStats));
  check("statisticalPrediction", input.hasPrediction);
  missing.push("headToHead", "injuries", "lineups", "restDays");

  const qualityNote =
    missing.length > available.length
      ? "Cobertura de datos baja: el analisis debe declarar limitaciones amplias y evitar estimaciones precisas."
      : "Cobertura de datos parcial: usar solo las secciones disponibles y declarar lo ausente.";

  return { availableSections: available, missingSections: missing, qualityNote };
}

/**
 * Transforma los datos persistidos de un evento en el input compacto que se
 * envia a Groq. Solo incluye datos existentes en la base; nunca inventa.
 */
export async function buildEventAnalysisInput(
  prisma: PrismaClient,
  eventId: string,
): Promise<EventAnalysisInput | null> {
  const event = (await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      sport: { select: { code: true } },
      league: { select: { name: true, country: true, season: true } },
      home: { select: { id: true, name: true, recentForm: true } },
      away: { select: { id: true, name: true, recentForm: true } },
      dataSource: { select: { provider: true } },
    },
  })) as EventWithRelations | null;

  if (!event) return null;

  const sport = event.sport.code as EnrichmentSport;
  const providers = recentFormProviders(event);
  const [homeAggregates, awayAggregates, latestPrediction, homeForm, awayForm] = await Promise.all([
    loadAggregates(prisma, event.home.id),
    loadAggregates(prisma, event.away.id),
    prisma.prediction.findFirst({
      where: { eventId: event.id },
      orderBy: { generatedAt: "desc" },
      include: { modelVersion: { select: { name: true, version: true } } },
    }),
    deriveRecentForm(sport, event.home.name, providers, prisma),
    deriveRecentForm(sport, event.away.name, providers, prisma),
  ]);

  const basketballSignals = sport === "basketball" ? basketballScoreSignals(event.rawPayload) : { home: {}, away: {} };
  const basketballDetails = sport === "basketball" ? basketballDetailSignals(event.rawPayload) : { home: {}, away: {} };
  const participantA = buildParticipant(event.home, homeAggregates, sport, homeForm, {
    ...basketballSignals.home,
    ...basketballDetails.home,
  });
  const participantB = buildParticipant(event.away, awayAggregates, sport, awayForm, {
    ...basketballSignals.away,
    ...basketballDetails.away,
  });

  // Prioridad: prediccion GOUP persistida; si no existe, el modelo Poisson propio
  // calculado desde goles historicos reales. Groq solo explica estos numeros.
  const poissonPrediction =
    sport === "football" && !latestPrediction
      ? await getFootballStatisticalPrediction(
          { homeTeam: event.home.name, awayTeam: event.away.name },
          prisma,
        )
      : null;

  const statisticalPrediction = latestPrediction
    ? {
        predictedOutcome: latestPrediction.predictedOutcome,
        probability: latestPrediction.probability,
        confidence: latestPrediction.confidence / 100,
        modelVersion: `${latestPrediction.modelVersion.name}@${latestPrediction.modelVersion.version}`,
      }
    : poissonPrediction
      ? {
          predictedOutcome:
            poissonPrediction.predictedOutcome === "home"
              ? `Ventaja ${event.home.name}`
              : poissonPrediction.predictedOutcome === "away"
                ? `Ventaja ${event.away.name}`
                : "Partido parejo / empate probable",
          probability: Math.max(
            poissonPrediction.probabilities.homeWin,
            poissonPrediction.probabilities.draw,
            poissonPrediction.probabilities.awayWin,
          ),
          confidence: poissonPrediction.confidence,
          modelVersion: poissonPrediction.modelVersion,
          probabilities1x2: poissonPrediction.probabilities,
          topScorelines: poissonPrediction.topScorelines.map((line) => line.label),
          caveats: poissonPrediction.caveats,
        }
      : null;

  const providerSections: string[] = [];
  if (event.dataSource.provider === "API-Sports Basketball") {
    providerSections.push("providerFixture");
    if (Object.keys(basketballSignals.home).length > 0 || Object.keys(basketballSignals.away).length > 0) {
      providerSections.push("scoreboard");
    }
    if (Object.keys(basketballDetails.home).length > 0 || Object.keys(basketballDetails.away).length > 0) {
      providerSections.push("teamStatistics");
    }
  }
  if (event.dataSource.provider === "Jeff Sackmann Tennis Data") providerSections.push("tennisHistoricalMatch");

  return {
    eventId: event.id,
    sport,
    competition: {
      name: event.league.name,
      country: event.league.country ?? undefined,
      season: event.season ?? event.league.season ?? undefined,
      round: event.round ?? undefined,
    },
    startsAt: event.startsAt.toISOString(),
    venue: event.venue || undefined,
    participantA,
    participantB,
    headToHead: null,
    statisticalPrediction,
    dataAvailability: describeAvailability({
      participantA,
      participantB,
      hasPrediction: Boolean(statisticalPrediction),
      extraAvailable: providerSections,
    }),
    meta: {
      featureVersion: FEATURE_VERSION,
      predictionVersion: statisticalPrediction?.modelVersion,
    },
  };
}
