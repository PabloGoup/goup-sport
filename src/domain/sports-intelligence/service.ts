import { events, matchAnalyses, news, predictions } from "./mock-data";
import type {
  EventInsight,
  EventSort,
  EventStatus,
  MatchAnalysis,
  PredictiveMarket,
  Prediction,
  SearchResult,
  Sport,
} from "./types";

export const supportedSports = ["football", "basketball", "tennis"] as const;
export const supportedStatuses = ["live", "today", "upcoming"] as const;
export const supportedEventSorts = ["confidence", "startsAt", "today"] as const;

export function isSport(value: string | null | undefined): value is Sport {
  return supportedSports.includes(value as Sport);
}

export function isEventStatus(value: string | null | undefined): value is EventStatus {
  return supportedStatuses.includes(value as EventStatus);
}

export function isEventSort(value: string | null | undefined): value is EventSort {
  return supportedEventSorts.includes(value as EventSort);
}

const finishedStatusShortCodes = new Set(["FT", "AET", "PEN", "CANC", "ABD", "AWD", "WO", "PST"]);
const finishedStatusPattern = /(match finished|finished|after extra time|after penalties|cancelled|abandoned|postponed|walkover)/i;

export function isFinishedEvent(event: EventInsight) {
  const payload = asApiSportsRawPayload(event.rawPayload);
  const statusShort = payload.fixture?.status?.short;
  const statusLong = payload.fixture?.status?.long ?? event.statusLabel;

  if (statusShort && finishedStatusShortCodes.has(statusShort)) return true;
  if (statusLong && finishedStatusPattern.test(statusLong)) return true;

  return false;
}

export function isVisibleEventCard(event: EventInsight) {
  return !isFinishedEvent(event);
}

export function isWithinEventProjectionWindow(event: EventInsight, days = 7) {
  const startsAt = new Date(event.startsAt).getTime();
  const now = Date.now();
  const max = now + days * 24 * 60 * 60 * 1000;

  return startsAt >= now - 6 * 60 * 60 * 1000 && startsAt <= max;
}

export function isProjectedVisibleEvent(event: EventInsight, days = 7) {
  return isVisibleEventCard(event) && isWithinEventProjectionWindow(event, days);
}

export function listEvents(filters?: {
  sport?: Sport;
  status?: EventInsight["status"];
  minConfidence?: number;
  sort?: EventSort;
}) {
  const filtered = events.filter((event) => {
    if (filters?.sport && event.sport !== filters.sport) return false;
    if (filters?.status && event.status !== filters.status) return false;
    if (filters?.minConfidence && event.confidence < filters.minConfidence) return false;
    return true;
  });

  return [...filtered].sort((a, b) => {
    if (filters?.sort === "confidence") return b.confidence - a.confidence;
    if (filters?.sort === "today") {
      if (a.status === "today" && b.status !== "today") return -1;
      if (b.status === "today" && a.status !== "today") return 1;
    }
    return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
  });
}

export function getEventById(id: string) {
  return events.find((event) => event.id === id);
}

export function getPredictionByEventId(eventId: string) {
  return predictions.find((prediction) => prediction.eventId === eventId);
}

export function getPredictionDetail(eventId: string) {
  const prediction = getPredictionByEventId(eventId);
  const event = getEventById(eventId);

  if (!prediction || !event) return null;

  return { ...prediction, event };
}

export function getEventDetail(id: string) {
  const event = getEventById(id);
  if (!event) return null;

  return {
    event,
    prediction: getPredictionByEventId(id) ?? null,
    relatedEvents: listEvents({ sport: event.sport }).filter((related) => related.id !== id),
  };
}

type ApiSportsRawPayload = {
  provider?: string;
  sourceUrl?: string;
  match?: {
    goals1?: Array<{ name?: string; minute?: string }>;
    goals2?: Array<{ name?: string; minute?: string }>;
  };
  goals?: { home?: number | null; away?: number | null };
  scores?: {
    home?: Record<string, number | null | undefined>;
    away?: Record<string, number | null | undefined>;
  };
  score?: {
    halftime?: { home?: number | null; away?: number | null };
    fulltime?: { home?: number | null; away?: number | null };
    extratime?: { home?: number | null; away?: number | null };
    penalty?: { home?: number | null; away?: number | null };
  };
  fixture?: {
    status?: {
      long?: string;
      short?: string;
      elapsed?: number | null;
    };
  };
  apiSportsDetails?: {
    storedAt?: string;
    statistics?: Array<{
      team?: { id?: number; name?: string };
      statistics?: Array<{ type?: string; value?: string | number | null }>;
    }>;
    events?: Array<{
      time?: { elapsed?: number; extra?: number | null };
      team?: { name?: string };
      player?: { name?: string | null };
      assist?: { name?: string | null };
      type?: string;
      detail?: string;
    }>;
    lineups?: Array<{
      team?: { name?: string };
      formation?: string;
      startXI?: Array<{ player?: { name?: string; pos?: string; number?: number } }>;
      substitutes?: Array<{ player?: { name?: string; pos?: string; number?: number } }>;
    }>;
    players?: Array<{
      team?: { name?: string };
      players?: Array<{
        player?: { id?: number; name?: string };
        statistics?: Array<{
          games?: { minutes?: number | null; position?: string | null; rating?: string | null };
          goals?: { total?: number | null; assists?: number | null };
          shots?: { total?: number | null; on?: number | null };
          passes?: { total?: number | null; key?: number | null; accuracy?: string | null };
          tackles?: { total?: number | null; interceptions?: number | null };
        }>;
      }>;
    }>;
  };
  apiSportsBasketballDetails?: {
    storedAt?: string;
    teamStatistics?: Array<unknown>;
    playerStatistics?: Array<unknown>;
    meta?: {
      teamStatisticsResults?: number;
      playerStatisticsResults?: number;
      storedTeamMetrics?: number;
    };
  };
};

function asApiSportsRawPayload(value: unknown): ApiSportsRawPayload {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as ApiSportsRawPayload) : {};
}

function statValue(
  details: ApiSportsRawPayload["apiSportsDetails"],
  teamName: string,
  type: string,
) {
  const teamStats = details?.statistics?.find((item) => item.team?.name === teamName);
  const stat = teamStats?.statistics?.find((item) => item.type === type);
  if (stat?.value === null || stat?.value === undefined) return "";
  return String(stat.value);
}

function buildStatisticsFromPayload(event: EventInsight, payload: ApiSportsRawPayload) {
  if (event.sport === "basketball") {
    const basketballStats = buildBasketballStatisticsFromPayload(event, payload);
    if (basketballStats.length > 0) return basketballStats;
  }

  const details = payload.apiSportsDetails;
  if (!details?.statistics?.length) {
    const scoreRows = [];
    const hasFinalScore =
      payload.goals?.home !== null &&
      payload.goals?.home !== undefined &&
      payload.goals?.away !== null &&
      payload.goals?.away !== undefined;
    const hasHalftimeScore =
      payload.score?.halftime?.home !== null &&
      payload.score?.halftime?.home !== undefined &&
      payload.score?.halftime?.away !== null &&
      payload.score?.halftime?.away !== undefined;
    const hasPenaltyScore =
      payload.score?.penalty?.home !== null &&
      payload.score?.penalty?.home !== undefined &&
      payload.score?.penalty?.away !== null &&
      payload.score?.penalty?.away !== undefined;

    if (hasFinalScore) {
      scoreRows.push({ label: "Marcador final", home: String(payload.goals?.home), away: String(payload.goals?.away) });
    }
    if (hasHalftimeScore) {
      scoreRows.push({
        label: "Descanso",
        home: String(payload.score?.halftime?.home),
        away: String(payload.score?.halftime?.away),
      });
    }
    if (hasPenaltyScore) {
      scoreRows.push({
        label: "Penales",
        home: String(payload.score?.penalty?.home),
        away: String(payload.score?.penalty?.away),
      });
    }

    return scoreRows;
  }

  const preferredStats = [
    "Ball Possession",
    "Total Shots",
    "Shots on Goal",
    "Corner Kicks",
    "Fouls",
    "Yellow Cards",
    "Red Cards",
    "Goalkeeper Saves",
    "Total passes",
    "Passes accurate",
  ];

  return preferredStats
    .map((label) => ({
      label,
      home: statValue(details, event.home.name, label),
      away: statValue(details, event.away.name, label),
    }))
    .filter((stat) => stat.home !== "" || stat.away !== "");
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function basketballStatTeamName(item: unknown) {
  const team = asRecord(asRecord(item).team);
  return typeof team.name === "string" ? team.name : "";
}

function basketballStatTeamExternalId(item: unknown) {
  const team = asRecord(asRecord(item).team);
  const id = team.id;
  return typeof id === "string" || typeof id === "number" ? String(id) : "";
}

function basketballTeamExternalId(event: EventInsight, side: "home" | "away") {
  const payload = asRecord(event.rawPayload);
  const teams = asRecord(payload.teams);
  const team = asRecord(teams[side]);
  const id = team.id;
  return typeof id === "string" || typeof id === "number" ? String(id) : "";
}

function basketballStatValue(stats: unknown[], event: EventInsight, side: "home" | "away", labels: string[]) {
  const externalId = basketballTeamExternalId(event, side);
  const teamName = side === "home" ? event.home.name : event.away.name;
  const item = stats.find((entry) => {
    const candidateId = basketballStatTeamExternalId(entry);
    if (candidateId && externalId) return candidateId === externalId;
    return basketballStatTeamName(entry) === teamName;
  });
  if (!item) return "";

  const object = asRecord(item);
  const statistics = object.statistics;
  if (Array.isArray(statistics)) {
    for (const label of labels) {
      const stat = statistics.find((entry) => {
        const entryObject = asRecord(entry);
        return entryObject.type === label || entryObject.name === label || entryObject.label === label;
      });
      const value = asRecord(stat).value ?? asRecord(stat).total ?? asRecord(stat).number;
      if (value !== null && value !== undefined && value !== "") return String(value);
    }
  }

  const flat = asRecord(statistics ?? item);
  for (const label of labels) {
    const value = flat[label] ?? flat[label.toLowerCase()] ?? flat[label.replace(/\s+/g, "_").toLowerCase()];
    if (value !== null && value !== undefined && value !== "") return String(value);
  }

  return "";
}

function basketballScoreValue(payload: ApiSportsRawPayload, side: "home" | "away", key: string) {
  const value = payload.scores?.[side]?.[key];
  return typeof value === "number" ? String(value) : "";
}

function buildBasketballStatisticsFromPayload(event: EventInsight, payload: ApiSportsRawPayload) {
  const stats = payload.apiSportsBasketballDetails?.teamStatistics ?? [];
  const rows = [
    { label: "Puntos", home: basketballScoreValue(payload, "home", "total"), away: basketballScoreValue(payload, "away", "total") },
    { label: "1Q", home: basketballScoreValue(payload, "home", "quarter_1"), away: basketballScoreValue(payload, "away", "quarter_1") },
    { label: "2Q", home: basketballScoreValue(payload, "home", "quarter_2"), away: basketballScoreValue(payload, "away", "quarter_2") },
    { label: "3Q", home: basketballScoreValue(payload, "home", "quarter_3"), away: basketballScoreValue(payload, "away", "quarter_3") },
    { label: "4Q", home: basketballScoreValue(payload, "home", "quarter_4"), away: basketballScoreValue(payload, "away", "quarter_4") },
  ];

  const preferredStats = [
    { label: "Tiros de campo", keys: ["field_goals", "Field Goals", "FG", "fg"] },
    { label: "Porcentaje de campo", keys: ["field_goals_percentage", "Field Goals Percentage", "FG%", "fg_pct"] },
    { label: "Triples", keys: ["threepoint_goals", "Three Point Goals", "3PT", "three_points"] },
    { label: "Tiros libres", keys: ["freethrows_goals", "Free Throws", "FT", "free_throws"] },
    { label: "Rebotes", keys: ["rebounds", "Rebounds", "REB"] },
    { label: "Asistencias", keys: ["assists", "Assists", "AST"] },
    { label: "Robos", keys: ["steals", "Steals", "STL"] },
    { label: "Bloqueos", keys: ["blocks", "Blocks", "BLK"] },
    { label: "Perdidas", keys: ["turnovers", "Turnovers", "TO"] },
    { label: "Faltas", keys: ["fouls", "Fouls", "PF"] },
  ];

  if (stats.length > 0) {
    rows.push(
      ...preferredStats.map((item) => ({
        label: item.label,
        home: basketballStatValue(stats, event, "home", item.keys),
        away: basketballStatValue(stats, event, "away", item.keys),
      })),
    );
  }

  return rows.filter((row) => row.home !== "" || row.away !== "");
}

function buildTimelineFromPayload(payload: ApiSportsRawPayload) {
  const events = payload.apiSportsDetails?.events ?? [];

  return events.slice(0, 10).map((item) => ({
    date: `${item.time?.elapsed ?? 0}${item.time?.extra ? `+${item.time.extra}` : ""}'`,
    competition: item.type ?? "Evento",
    home: item.team?.name ?? "Equipo",
    away: item.player?.name ?? "Jugador",
    score: item.detail ?? "Detalle",
  }));
}

function playerScoreFromRating(rating?: string | null) {
  const value = Number(rating);
  if (Number.isNaN(value)) return 72;
  return Math.min(99, Math.max(50, Math.round(value * 10)));
}

function basketballPlayerName(item: unknown) {
  const object = asRecord(item);
  const player = asRecord(object.player);
  const name = player.name ?? object.name;
  return typeof name === "string" ? name : "";
}

function basketballPlayerTeam(item: unknown) {
  const team = asRecord(asRecord(item).team);
  const name = team.name;
  return typeof name === "string" ? name : "";
}

function basketballPlayerMetric(item: unknown, keys: string[]) {
  const object = asRecord(item);
  const statistics = asRecord(object.statistics ?? object);
  for (const key of keys) {
    const value = object[key] ?? statistics[key] ?? statistics[key.toLowerCase()] ?? statistics[key.replace(/\s+/g, "_").toLowerCase()];
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace("%", "").replace(",", "."));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function basketballPlayersFromPayload(payload: ApiSportsRawPayload) {
  const players = payload.apiSportsBasketballDetails?.playerStatistics ?? [];
  return players
    .map((item, index) => {
      const name = basketballPlayerName(item);
      if (!name) return null;

      const points = basketballPlayerMetric(item, ["points", "PTS", "pts"]);
      const rebounds = basketballPlayerMetric(item, ["rebounds", "REB", "reb"]);
      const assists = basketballPlayerMetric(item, ["assists", "AST", "ast"]);
      const steals = basketballPlayerMetric(item, ["steals", "STL", "stl"]);
      const blocks = basketballPlayerMetric(item, ["blocks", "BLK", "blk"]);
      const minutes = basketballPlayerMetric(item, ["minutes", "MIN", "min"]);
      const score = Math.min(99, Math.max(62, 64 + points * 2 + rebounds + assists + steals * 2 + blocks * 2));

      return {
        id: `api-sports-basketball-player-${name}-${index}`,
        name,
        team: basketballPlayerTeam(item),
        position: "Basketball",
        nationality: "",
        score,
        form: score,
        projection: [
          points ? `${points} pts` : null,
          rebounds ? `${rebounds} reb` : null,
          assists ? `${assists} ast` : null,
          minutes ? `${minutes} min` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        attributes: [
          { label: "Puntos", value: Math.min(99, points * 4) },
          { label: "Rebotes", value: Math.min(99, rebounds * 8) },
          { label: "Asistencias", value: Math.min(99, assists * 10) },
          { label: "Robos", value: Math.min(99, steals * 20) },
          { label: "Bloqueos", value: Math.min(99, blocks * 20) },
          { label: "Impacto", value: score },
        ],
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((item) => item.projection)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

function buildPlayersFromPayload(payload: ApiSportsRawPayload) {
  const basketballPlayers = basketballPlayersFromPayload(payload);
  if (basketballPlayers.length > 0) return basketballPlayers;

  const teams = payload.apiSportsDetails?.players ?? [];
  const cards = teams
    .flatMap((team) =>
      (team.players ?? []).map((item) => {
        const stats = item.statistics?.[0];
        return {
          id: `api-sports-player-${item.player?.id ?? item.player?.name}`,
          name: item.player?.name ?? "Jugador",
          team: team.team?.name ?? "Equipo",
          position: stats?.games?.position ?? "Jugador",
          nationality: "",
          score: playerScoreFromRating(stats?.games?.rating),
          form: playerScoreFromRating(stats?.games?.rating),
          projection: [
            typeof stats?.games?.minutes === "number" ? `${stats.games.minutes} min` : null,
            stats?.games?.rating ? `rating ${stats.games.rating}` : null,
          ]
            .filter(Boolean)
            .join(" · "),
          attributes: [
            { label: "Goles", value: Math.min(99, (stats?.goals?.total ?? 0) * 25) },
            { label: "Asistencias", value: Math.min(99, (stats?.goals?.assists ?? 0) * 25) },
            { label: "Tiros", value: Math.min(99, (stats?.shots?.total ?? 0) * 15) },
            { label: "Pases", value: Math.min(99, Math.round((stats?.passes?.total ?? 0) / 2)) },
            { label: "Pases clave", value: Math.min(99, (stats?.passes?.key ?? 0) * 20) },
            { label: "Defensa", value: Math.min(99, ((stats?.tackles?.total ?? 0) + (stats?.tackles?.interceptions ?? 0)) * 18) },
          ],
        };
      }),
    )
    .filter((player) => player.name !== "Jugador")
    .sort((a, b) => b.score - a.score);

  if (cards.length > 0) return cards.slice(0, 4);

  const openFootballScorers = [
    ...(payload.match?.goals1 ?? []).map((goal) => ({ ...goal, team: "Local" })),
    ...(payload.match?.goals2 ?? []).map((goal) => ({ ...goal, team: "Visita" })),
  ].filter((goal) => goal.name);

  if (openFootballScorers.length > 0) {
    return openFootballScorers.slice(0, 4).map((goal, index) => ({
      id: `openfootball-scorer-${goal.name}-${index}`,
      name: goal.name ?? "Jugador",
      team: goal.team,
      position: "Goleador registrado",
      nationality: "",
      score: 86,
      form: 84,
      projection: goal.minute ? `Gol ${goal.minute}'` : "Gol registrado",
      attributes: [
        { label: "Impacto", value: 88 },
        { label: "Definicion", value: 86 },
        { label: "Forma", value: 82 },
        { label: "Influencia", value: 84 },
        { label: "Trazabilidad", value: 90 },
        { label: "Actualidad", value: 92 },
      ],
    }));
  }

  const eventPlayers = new Map<string, {
    name: string;
    team: string;
    score: number;
    actions: string[];
  }>();

  for (const item of payload.apiSportsDetails?.events ?? []) {
    const playerName = item.player?.name;
    if (!playerName) continue;

    const current = eventPlayers.get(playerName) ?? {
      name: playerName,
      team: item.team?.name ?? "Equipo",
      score: 70,
      actions: [],
    };

    const action = item.detail ?? item.type ?? "Evento";
    current.actions.push(action);
    current.score += item.type === "Goal" ? 18 : item.type === "Card" ? 4 : 8;
    eventPlayers.set(playerName, current);
  }

  return Array.from(eventPlayers.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((player) => ({
      id: `api-sports-event-player-${player.name}`,
      name: player.name,
      team: player.team,
      position: "Participacion en partido",
      nationality: "",
      score: Math.min(99, player.score),
      form: Math.min(99, player.score),
      projection: player.actions.slice(0, 2).join(" · "),
      attributes: [
        { label: "Impacto", value: Math.min(99, player.score) },
        { label: "Eventos", value: Math.min(99, player.actions.length * 25) },
        { label: "Goles", value: player.actions.some((action) => /goal/i.test(action)) ? 90 : 35 },
        { label: "Disciplina", value: player.actions.some((action) => /card/i.test(action)) ? 45 : 78 },
        { label: "Actividad", value: Math.min(99, player.actions.length * 20) },
        { label: "Trazabilidad", value: 88 },
      ],
    }));
}

function buildTeamComparisonFromStats(event: EventInsight, payload: ApiSportsRawPayload) {
  if (event.sport === "basketball") {
    const stats = payload.apiSportsBasketballDetails?.teamStatistics ?? [];
    if (stats.length === 0) return [];

    const numericStat = (side: "home" | "away", labels: string[]) => {
      const value = basketballStatValue(stats, event, side, labels).replace("%", "");
      const parsed = Number(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    return [
      {
        label: "Puntos",
        home: Number(basketballScoreValue(payload, "home", "total")) || numericStat("home", ["points", "PTS", "pts"]),
        away: Number(basketballScoreValue(payload, "away", "total")) || numericStat("away", ["points", "PTS", "pts"]),
      },
      { label: "Rebotes", home: numericStat("home", ["rebounds", "Rebounds", "REB"]), away: numericStat("away", ["rebounds", "Rebounds", "REB"]) },
      { label: "Asistencias", home: numericStat("home", ["assists", "Assists", "AST"]), away: numericStat("away", ["assists", "Assists", "AST"]) },
      { label: "Triples", home: numericStat("home", ["threepoint_goals", "Three Point Goals", "3PT"]), away: numericStat("away", ["threepoint_goals", "Three Point Goals", "3PT"]) },
      { label: "Perdidas", home: numericStat("home", ["turnovers", "Turnovers", "TO"]), away: numericStat("away", ["turnovers", "Turnovers", "TO"]) },
    ]
      .filter((item) => item.home > 0 || item.away > 0)
      .map((item) => ({
        ...item,
        home: Math.round(Math.min(99, item.home)),
        away: Math.round(Math.min(99, item.away)),
      }));
  }

  const details = payload.apiSportsDetails;
  if (!details?.statistics?.length) {
    return [];
  }

  const numericStat = (teamName: string, label: string) => {
    const value = statValue(details, teamName, label).replace("%", "");
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : Math.min(99, parsed);
  };

  return [
    { label: "Posesion", home: numericStat(event.home.name, "Ball Possession"), away: numericStat(event.away.name, "Ball Possession") },
    { label: "Tiros", home: numericStat(event.home.name, "Total Shots") * 5, away: numericStat(event.away.name, "Total Shots") * 5 },
    { label: "Al arco", home: numericStat(event.home.name, "Shots on Goal") * 12, away: numericStat(event.away.name, "Shots on Goal") * 12 },
    { label: "Corners", home: numericStat(event.home.name, "Corner Kicks") * 12, away: numericStat(event.away.name, "Corner Kicks") * 12 },
    { label: "Pases", home: numericStat(event.home.name, "Total passes") / 6, away: numericStat(event.away.name, "Total passes") / 6 },
  ].map((item) => ({
    ...item,
    home: Math.round(Math.min(99, item.home)),
    away: Math.round(Math.min(99, item.away)),
  }));
}

export type StatisticalPredictionView = {
  modelVersion: string;
  lambdaHome: number;
  lambdaAway: number;
  probabilities: { homeWin: number; draw: number; awayWin: number };
  expectedScore: { home: number; away: number };
  topScorelines: Array<{ label: string; probability: number }>;
  confidence: number;
  caveats: string[];
};

function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i += 1) result *= i;
  return result;
}

function poisson(k: number, lambda: number) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.exp(-lambda) * lambda ** k) / factorial(k);
}

function poissonCdf(max: number, lambda: number) {
  let total = 0;
  for (let i = 0; i <= max; i += 1) total += poisson(i, lambda);
  return total;
}

function marketPercent(value: number) {
  return `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
}

function numericStatValue(
  details: ApiSportsRawPayload["apiSportsDetails"],
  teamName: string,
  type: string,
) {
  const raw = statValue(details, teamName, type).replace("%", "");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function addObservedTeamStatMarket(
  markets: PredictiveMarket[],
  details: ApiSportsRawPayload["apiSportsDetails"],
  event: EventInsight,
  input: {
    id: string;
    group: PredictiveMarket["group"];
    label: string;
    statType: string;
    suffix?: string;
  },
) {
  const home = numericStatValue(details, event.home.name, input.statType);
  const away = numericStatValue(details, event.away.name, input.statType);
  if (home === null && away === null) return;

  markets.push({
    id: input.id,
    group: input.group,
    label: input.label,
    value: [home !== null ? `${event.home.shortName} ${home}${input.suffix ?? ""}` : null, away !== null ? `${event.away.shortName} ${away}${input.suffix ?? ""}` : null]
      .filter(Boolean)
      .join(" · "),
    detail: "Dato estadistico almacenado del proveedor.",
  });
}

function buildPredictiveMarkets(
  event: EventInsight,
  payload: ApiSportsRawPayload,
  pred: StatisticalPredictionView | null,
): PredictiveMarket[] {
  const markets: PredictiveMarket[] = [];

  if (pred) {
    const homeZero = poisson(0, pred.lambdaHome);
    const awayZero = poisson(0, pred.lambdaAway);
    const totalLambda = pred.lambdaHome + pred.lambdaAway;
    const confidence = Math.round(pred.confidence * 100);

    markets.push(
      {
        id: "home-win",
        group: "Resultado",
        label: `Victoria ${event.home.shortName}`,
        value: marketPercent(pred.probabilities.homeWin),
        confidence,
      },
      {
        id: "draw",
        group: "Resultado",
        label: "Empate",
        value: marketPercent(pred.probabilities.draw),
        confidence,
      },
      {
        id: "away-win",
        group: "Resultado",
        label: `Victoria ${event.away.shortName}`,
        value: marketPercent(pred.probabilities.awayWin),
        confidence,
      },
      {
        id: "home-or-draw",
        group: "Resultado",
        label: `${event.home.shortName} o empate`,
        value: marketPercent(pred.probabilities.homeWin + pred.probabilities.draw),
        confidence,
      },
      {
        id: "away-or-draw",
        group: "Resultado",
        label: `${event.away.shortName} o empate`,
        value: marketPercent(pred.probabilities.awayWin + pred.probabilities.draw),
        confidence,
      },
      {
        id: "both-score",
        group: "Goles",
        label: "Ambos equipos marcan",
        value: marketPercent(1 - homeZero - awayZero + homeZero * awayZero),
        confidence,
      },
      {
        id: "home-clean-sheet",
        group: "Goles",
        label: `Porteria a cero ${event.home.shortName}`,
        value: marketPercent(awayZero),
        confidence,
      },
      {
        id: "away-clean-sheet",
        group: "Goles",
        label: `Porteria a cero ${event.away.shortName}`,
        value: marketPercent(homeZero),
        confidence,
      },
      {
        id: "expected-total-goals",
        group: "Goles",
        label: "Total de goles esperado",
        value: totalLambda.toFixed(2),
        detail: `${event.home.shortName} ${pred.lambdaHome.toFixed(2)} · ${event.away.shortName} ${pred.lambdaAway.toFixed(2)}`,
        confidence,
      },
      ...[0.5, 1.5, 2.5, 3.5].map((line) => ({
        id: `over-${line}`,
        group: "Goles" as const,
        label: `Mas de ${line} goles`,
        value: marketPercent(1 - poissonCdf(Math.floor(line), totalLambda)),
        confidence,
      })),
      ...[1.5, 2.5, 3.5, 4.5].map((line) => ({
        id: `under-${line}`,
        group: "Goles" as const,
        label: `Menos de ${line} goles`,
        value: marketPercent(poissonCdf(Math.floor(line), totalLambda)),
        confidence,
      })),
    );
  }

  const details = payload.apiSportsDetails;
  if (details?.statistics?.length) {
    addObservedTeamStatMarket(markets, details, event, {
      id: "shots",
      group: "Produccion",
      label: "Tiros",
      statType: "Total Shots",
    });
    addObservedTeamStatMarket(markets, details, event, {
      id: "shots-on-goal",
      group: "Produccion",
      label: "Tiros al arco",
      statType: "Shots on Goal",
    });
    addObservedTeamStatMarket(markets, details, event, {
      id: "corners",
      group: "Produccion",
      label: "Corners",
      statType: "Corner Kicks",
    });
    addObservedTeamStatMarket(markets, details, event, {
      id: "cards-yellow",
      group: "Disciplina",
      label: "Tarjetas amarillas",
      statType: "Yellow Cards",
    });
    addObservedTeamStatMarket(markets, details, event, {
      id: "fouls",
      group: "Disciplina",
      label: "Faltas",
      statType: "Fouls",
    });
    addObservedTeamStatMarket(markets, details, event, {
      id: "possession",
      group: "Control",
      label: "Posesion",
      statType: "Ball Possession",
      suffix: "%",
    });
    addObservedTeamStatMarket(markets, details, event, {
      id: "passes",
      group: "Control",
      label: "Pases",
      statType: "Total passes",
    });
  }

  return markets;
}

function probabilityMargin(probabilities: { homeWin: number; draw?: number; awayWin: number }) {
  const values = [probabilities.homeWin, probabilities.draw ?? 0, probabilities.awayWin].sort((a, b) => b - a);
  return Math.max(0, values[0] - values[1]);
}

function matchScoreFromContext(input: {
  hasPrediction: boolean;
  hasProviderDetails: boolean;
  hasHistoricalMetrics: boolean;
  hasHeadToHead: boolean;
  margin: number;
  confidence: number;
}) {
  const balanceScore = Math.max(55, 100 - input.margin * 2);
  const dataScore =
    (input.hasPrediction ? 24 : 0) +
    (input.hasProviderDetails ? 24 : 0) +
    (input.hasHistoricalMetrics ? 18 : 0) +
    (input.hasHeadToHead ? 14 : 0);
  const confidenceScore = Math.round(input.confidence * 20);
  return Math.min(92, Math.max(58, Math.round(balanceScore * 0.45 + dataScore + confidenceScore)));
}

function matchScoreLabel(score: number) {
  if (score >= 85) return "Elite";
  if (score >= 78) return "Muy alto";
  if (score >= 70) return "Alto";
  return "Competitivo";
}

function buildHeadline(event: EventInsight, pred: StatisticalPredictionView | null, probabilities: { homeWin: number; draw?: number; awayWin: number }) {
  if (!pred) {
    return `${event.home.name} vs ${event.away.name}: ficha operativa con calendario, contexto competitivo y trazabilidad del evento.`;
  }

  const margin = probabilityMargin(probabilities);
  const leader =
    probabilities.homeWin >= (probabilities.draw ?? 0) && probabilities.homeWin >= probabilities.awayWin
      ? event.home.name
      : probabilities.awayWin >= (probabilities.draw ?? 0)
        ? event.away.name
        : "el empate";
  const balance = margin <= 3 ? "escenario muy parejo" : margin <= 8 ? "ventaja estrecha" : "ventaja clara";

  return `${event.home.name} vs ${event.away.name}: ${balance}; lectura principal ${leader} con margen de ${margin} puntos. Goles esperados ${pred.lambdaHome.toFixed(2)}-${pred.lambdaAway.toFixed(2)}.`;
}

export function buildExternalDataMatchAnalysis(
  event: EventInsight,
  options: {
    historicalMetrics?: MatchAnalysis["historicalMetrics"];
    featuredPlayers?: MatchAnalysis["featuredPlayers"];
    statisticalPrediction?: StatisticalPredictionView | null;
    headToHead?: MatchAnalysis["headToHead"];
  } = {},
): MatchAnalysis {
  const isFootball = event.sport === "football";
  const payload = asApiSportsRawPayload(event.rawPayload);
  const finalHome = payload.goals?.home;
  const finalAway = payload.goals?.away;
  const hasScore = finalHome !== null && finalHome !== undefined && finalAway !== null && finalAway !== undefined;
  const detailStoredAt = payload.apiSportsDetails?.storedAt ?? payload.apiSportsBasketballDetails?.storedAt;
  const expectedStats = buildStatisticsFromPayload(event, payload);
  const featuredPlayers = buildPlayersFromPayload(payload);
  const timeline = buildTimelineFromPayload(payload);

  const pred = options.statisticalPrediction ?? null;
  const pct = (value: number) => Math.round(value * 100);

  const modelProbabilities = pred
    ? { homeWin: pct(pred.probabilities.homeWin), draw: pct(pred.probabilities.draw), awayWin: pct(pred.probabilities.awayWin) }
    : isFootball
      ? { homeWin: 33, draw: 34, awayWin: 33 }
      : { homeWin: 50, awayWin: 50 };

  const modelScorelines = pred
    ? pred.topScorelines.map((line) => ({ label: line.label, probability: pct(line.probability) }))
    : [];
  const margin = probabilityMargin(modelProbabilities);
  const hasProviderDetails = Boolean(payload.apiSportsDetails ?? payload.apiSportsBasketballDetails);
  const hasHistoricalMetrics = Boolean(options.historicalMetrics?.length);
  const hasHeadToHead = Boolean(options.headToHead?.length || timeline.length);
  const matchScore = matchScoreFromContext({
    hasPrediction: Boolean(pred),
    hasProviderDetails,
    hasHistoricalMetrics,
    hasHeadToHead,
    margin,
    confidence: pred?.confidence ?? 0,
  });

  return {
    eventId: event.id,
    headline: buildHeadline(event, pred, modelProbabilities),
    favorite: "",
    updatedAt: detailStoredAt ?? event.source.collectedAt,
    probabilities: modelProbabilities,
    projectedScore: {
      home: pred ? pred.expectedScore.home : finalHome ?? 0,
      away: pred ? pred.expectedScore.away : finalAway ?? 0,
      label: pred
        ? `${pred.expectedScore.home}-${pred.expectedScore.away}`
        : hasScore
          ? `${finalHome}-${finalAway}`
          : "",
      interval: pred
        ? `Modelo Poisson GOUP (${pred.modelVersion}) · confianza ${pct(pred.confidence)}%`
        : payload.score?.penalty?.home !== null && payload.score?.penalty?.home !== undefined
          ? `Penales ${payload.score.penalty.home}-${payload.score.penalty.away}`
          : "",
    },
    confidence: pred ? pct(pred.confidence) : 0,
    riskLevel: "Alto",
    matchScore,
    matchScoreLabel: matchScoreLabel(matchScore),
    matchScoreComponents: [
      {
        label: "Equilibrio",
        score: Math.max(55, 100 - margin * 2),
        explanation:
          margin <= 3
            ? "Las probabilidades principales estan practicamente igualadas."
            : `La diferencia entre los escenarios principales es de ${margin} puntos.`,
      },
      {
        label: "Produccion ofensiva",
        score: pred ? Math.min(95, Math.round((pred.lambdaHome + pred.lambdaAway) * 28)) : hasProviderDetails ? 72 : 58,
        explanation: pred
          ? `El modelo proyecta ${pred.lambdaHome.toFixed(2)} goles para ${event.home.name} y ${pred.lambdaAway.toFixed(2)} para ${event.away.name}.`
          : "La produccion ofensiva se calcula cuando existe historial suficiente.",
      },
      {
        label: "Soporte estadistico",
        score: Math.min(95, 48 + (pred ? 18 : 0) + (hasProviderDetails ? 16 : 0) + (hasHistoricalMetrics ? 13 : 0)),
        explanation: [
          pred ? "modelo de goles historicos" : null,
          hasProviderDetails ? "estadisticas del proveedor" : null,
          hasHistoricalMetrics ? "metricas historicas StatsBomb" : null,
        ]
          .filter(Boolean)
          .join(" · ") || "Contexto competitivo disponible.",
      },
      {
        label: "Confianza del modelo",
        score: pred ? pct(pred.confidence) : 0,
        explanation: pred
          ? `Confianza limitada por muestra historica: ${pct(pred.confidence)}%.`
          : "La confianza se publica cuando existe modelo estadistico para el evento.",
      },
    ],
    scorelines: modelScorelines,
    simulations: {
      total: 0,
      homeWins: pred ? pct(pred.probabilities.homeWin) : 0,
      draws: isFootball ? (pred ? pct(pred.probabilities.draw) : 0) : undefined,
      awayWins: pred ? pct(pred.probabilities.awayWin) : 0,
    },
    teamComparison: buildTeamComparisonFromStats(event, payload),
    expectedStats,
    favorableFactors: pred
      ? [
          {
            label: "Base historica de goles",
            impact: 20,
            value: pred.modelVersion,
            direction: "positive",
            explanation: `El calculo usa goles historicos ponderados por recencia: ${event.home.name} ${pred.lambdaHome.toFixed(2)} xG proyectado y ${event.away.name} ${pred.lambdaAway.toFixed(2)}.`,
            source: "GOUP SPORT",
            updatedAt: event.source.collectedAt,
          },
          {
            label: margin <= 3 ? "Partido de margen minimo" : "Diferencia de escenarios",
            impact: margin <= 3 ? 16 : 10,
            value: `${margin} puntos`,
            direction: "positive",
            explanation:
              margin <= 3
                ? "Los tres escenarios principales quedan en rango estrecho, por eso el partido se clasifica como altamente competitivo."
                : `El escenario principal supera al segundo por ${margin} puntos.`,
            source: "GOUP SPORT",
            updatedAt: event.source.collectedAt,
          },
        ]
      : [
          {
            label: payload.apiSportsDetails ? "Estadisticas reales almacenadas" : "Evento trazable",
            impact: 12,
            value: payload.apiSportsDetails ? "statistics/events/players" : event.source.id,
            direction: "positive",
            explanation: payload.apiSportsDetails
              ? "La ficha ya puede mostrar rendimiento de equipos y jugadores desde Prisma."
              : "El evento cuenta con calendario, participantes, competicion y fuente registrada.",
            source: event.source.provider,
            updatedAt: event.source.collectedAt,
          },
        ],
    unfavorableFactors: [
      {
        label: pred ? "Confianza acotada" : "Contexto estadistico base",
        impact: pred ? -12 : -8,
        value: pred ? pred.modelVersion : event.modelVersion,
        direction: "negative",
        explanation: pred
          ? `La confianza publicada es ${pct(pred.confidence)}%, por lo que la lectura debe apoyarse en mercados predictivos y forma reciente.`
          : "La ficha se presenta con datos disponibles del evento.",
        source: "GOUP SPORT",
        updatedAt: event.source.collectedAt,
      },
    ],
    uncertainties: pred
      ? pred.caveats.map((caveat, index) => ({
          label: index === 0 ? "Modelo experimental" : "Muestra limitada",
          impact: -20,
          value: pred.modelVersion,
          direction: "uncertain" as const,
          explanation: caveat,
          source: "GOUP SPORT",
          updatedAt: event.source.collectedAt,
        }))
      : [],
    headToHead: options.headToHead && options.headToHead.length > 0 ? options.headToHead : timeline,
    featuredPlayers: featuredPlayers.length > 0 ? featuredPlayers : (options.featuredPlayers ?? []),
    historicalMetrics: options.historicalMetrics,
    predictiveMarkets: buildPredictiveMarkets(event, payload, pred),
  };
}

export function getMatchAnalysis(
  event: EventInsight,
  options: {
    historicalMetrics?: MatchAnalysis["historicalMetrics"];
    featuredPlayers?: MatchAnalysis["featuredPlayers"];
    statisticalPrediction?: StatisticalPredictionView | null;
    headToHead?: MatchAnalysis["headToHead"];
  } = {},
) {
  const mockAnalysis = matchAnalyses.find((analysis) => analysis.eventId === event.id);
  if (mockAnalysis) {
    return {
      ...mockAnalysis,
      historicalMetrics: options.historicalMetrics,
      featuredPlayers: options.featuredPlayers?.length ? options.featuredPlayers : mockAnalysis.featuredPlayers,
      predictiveMarkets: mockAnalysis.predictiveMarkets ?? [],
    };
  }

  return buildExternalDataMatchAnalysis(event, options);
}

export function listPredictions() {
  return predictions
    .map((prediction) => ({
      ...prediction,
      event: events.find((event) => event.id === prediction.eventId),
    }))
    .filter((prediction): prediction is Prediction & { event: EventInsight } =>
      Boolean(prediction.event),
    )
    .sort((a, b) => b.confidence - a.confidence);
}

export function searchSportsIntelligence(query: string): SearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const eventResults: SearchResult[] = events
    .filter((event) =>
      [
        event.home.name,
        event.home.shortName,
        event.away.name,
        event.away.shortName,
        event.league,
        event.venue,
        event.sport,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    )
    .map((event) => ({
      id: event.id,
      type: "event",
      title: `${event.home.name} vs ${event.away.name}`,
      subtitle: `${event.league} · ${event.confidence}% confianza`,
      href: `/eventos/${event.id}`,
      sport: event.sport,
    }));

  const predictionResults: SearchResult[] = listPredictions()
    .filter((prediction) =>
      [
        prediction.predictedOutcome,
        prediction.event.home.name,
        prediction.event.away.name,
        prediction.modelVersion,
        ...prediction.factors.map((factor) => factor.label),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    )
    .map((prediction) => ({
      id: prediction.eventId,
      type: "prediction",
      title: prediction.predictedOutcome,
      subtitle: `${prediction.event.home.shortName} vs ${prediction.event.away.shortName} · ${prediction.confidence}% confianza`,
      href: `/modelos/${prediction.eventId}`,
      sport: prediction.event.sport,
    }));

  const newsResults: SearchResult[] = news
    .filter((item) => [item.title, item.source, item.sport].join(" ").toLowerCase().includes(normalizedQuery))
    .map((item) => ({
      id: item.id,
      type: "news",
      title: item.title,
      subtitle: `${item.source} · ${item.publishedAt}`,
      href: "/",
      sport: item.sport,
    }));

  return [...eventResults, ...predictionResults, ...newsResults].slice(0, 12);
}

export function getSearchIndex(): SearchResult[] {
  const eventResults: SearchResult[] = events.map((event) => ({
    id: event.id,
    type: "event",
    title: `${event.home.name} vs ${event.away.name}`,
    subtitle: `${event.league} · ${event.confidence}% confianza`,
    href: `/eventos/${event.id}`,
    sport: event.sport,
  }));

  const predictionResults: SearchResult[] = listPredictions().map((prediction) => ({
    id: prediction.eventId,
    type: "prediction",
    title: prediction.predictedOutcome,
    subtitle: `${prediction.event.home.shortName} vs ${prediction.event.away.shortName} · ${prediction.confidence}% confianza`,
    href: `/modelos/${prediction.eventId}`,
    sport: prediction.event.sport,
  }));

  const newsResults: SearchResult[] = news.map((item) => ({
    id: item.id,
    type: "news",
    title: item.title,
    subtitle: `${item.source} · ${item.publishedAt}`,
    href: "/",
    sport: item.sport,
  }));

  return [...eventResults, ...predictionResults, ...newsResults];
}

export function getPlatformSnapshot() {
  const rankedPredictions = listPredictions();

  return {
    generatedAt: "2026-07-13T12:30:00-04:00",
    events,
    predictions: rankedPredictions,
    news,
    metrics: {
      sports: 3,
      modelFamilies: 3,
      trackedEvents: events.length,
      averageConfidence: Math.round(
        rankedPredictions.reduce((sum, prediction) => sum + prediction.confidence, 0) /
          rankedPredictions.length,
      ),
    },
  };
}
