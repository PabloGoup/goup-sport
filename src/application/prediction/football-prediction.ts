import { getPrisma } from "@/lib/prisma";
import {
  computeAdjustedTeamStrengths,
  predictFootballMatch,
  type CompletedMatch,
  type PoissonPrediction,
} from "@/domain/prediction/football-poisson";
import { computeEloRatings, eloWinProbabilities, type EloMatch } from "@/domain/prediction/elo";
import { seedFromString, simulateMatch, type SimulationResult } from "@/domain/prediction/monte-carlo";
import { canonicalTeamName } from "@/domain/prediction/team-name";

export const FOOTBALL_ENSEMBLE_VERSION = "goup-ensemble-football-0.3.0";

type StatsBombEventPayload = {
  match?: { home_score?: number | null; away_score?: number | null };
  goals?: { home?: number | null; away?: number | null };
};

// Vida media de la ponderacion por recencia. Un partido de hace ~1.5 anos
// pesa la mitad que uno reciente, para no arrastrar rendimiento antiguo.
const RECENCY_HALF_LIFE_YEARS = 1.5;

function recencyWeight(startsAt: Date, now: Date): number {
  const ageYears = Math.max(0, (now.getTime() - startsAt.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return 0.5 ** (ageYears / RECENCY_HALF_LIFE_YEARS);
}

function scoresFromPayload(payload: unknown): { home: number; away: number } | null {
  const p = payload as StatsBombEventPayload;
  const home = p?.match?.home_score ?? p?.goals?.home;
  const away = p?.match?.away_score ?? p?.goals?.away;
  if (home === null || home === undefined || away === null || away === undefined) return null;
  return { home, away };
}

export type HeadToHeadMatch = {
  date: string;
  competition: string;
  home: string;
  away: string;
  score: string;
};

/**
 * Enfrentamientos directos entre dos equipos, desde partidos completados reales.
 * Devuelve del mas reciente al mas antiguo. Nunca inventa cruces.
 */
export async function getFootballHeadToHead(
  homeTeam: string,
  awayTeam: string,
  client?: ReturnType<typeof getPrisma>,
): Promise<HeadToHeadMatch[]> {
  try {
    const prisma = client ?? getPrisma();
    const a = canonicalTeamName(homeTeam);
    const b = canonicalTeamName(awayTeam);

    const events = await prisma.event.findMany({
      where: { sportId: "sport-football", status: "completed" },
      include: {
        home: { select: { name: true } },
        away: { select: { name: true } },
        league: { select: { name: true } },
      },
      orderBy: { startsAt: "desc" },
      take: 1000,
    });

    const result: HeadToHeadMatch[] = [];
    for (const event of events) {
      const h = canonicalTeamName(event.home.name);
      const w = canonicalTeamName(event.away.name);
      const isCross = (h === a && w === b) || (h === b && w === a);
      if (!isCross) continue;

      const score = scoresFromPayload(event.rawPayload);
      if (!score) continue;

      result.push({
        date: event.startsAt.toISOString().slice(0, 10),
        competition: event.league.name,
        home: event.home.name,
        away: event.away.name,
        score: `${score.home}-${score.away}`,
      });
    }
    return result.slice(0, 8);
  } catch {
    return [];
  }
}

/** Carga partidos de futbol completados con marcador, desde datasets historicos reales. */
async function loadCompletedFootballMatches(
  prisma: ReturnType<typeof getPrisma>,
  providers: string[],
): Promise<CompletedMatch[]> {
  const events = await prisma.event.findMany({
    where: {
      sportId: "sport-football",
      status: "completed",
      dataSource: { provider: { in: providers } },
    },
    include: { home: { select: { name: true } }, away: { select: { name: true } } },
    orderBy: { startsAt: "desc" },
    take: 1000,
  });

  const now = events[0]?.startsAt ?? new Date(0);
  const matches: CompletedMatch[] = [];
  for (const event of events) {
    const score = scoresFromPayload(event.rawPayload);
    if (!score) continue;
    matches.push({
      homeTeam: canonicalTeamName(event.home.name),
      awayTeam: canonicalTeamName(event.away.name),
      homeGoals: score.home,
      awayGoals: score.away,
      weight: recencyWeight(event.startsAt, now),
    });
  }
  return matches;
}

type Probabilities1x2 = { homeWin: number; draw: number; awayWin: number };

export type FootballPredictionResult = PoissonPrediction & {
  homeTeam: string;
  awayTeam: string;
  caveats: string[];
  /** Salida de cada modelo del ensemble, para trazabilidad. */
  components: {
    poisson: Probabilities1x2;
    elo: (Probabilities1x2 & { ratingHome: number; ratingAway: number }) | null;
  };
  simulation: SimulationResult;
};

function blend1x2(a: Probabilities1x2, b: Probabilities1x2): Probabilities1x2 {
  const homeWin = (a.homeWin + b.homeWin) / 2;
  const draw = (a.draw + b.draw) / 2;
  const awayWin = (a.awayWin + b.awayWin) / 2;
  const total = homeWin + draw + awayWin || 1;
  return {
    homeWin: Number((homeWin / total).toFixed(4)),
    draw: Number((draw / total).toFixed(4)),
    awayWin: Number((awayWin / total).toFixed(4)),
  };
}

/**
 * Prediccion estadistica propia para un partido de futbol: ENSEMBLE de un
 * modelo de Poisson (goles, ajustado por rival) y un modelo Elo (fuerza
 * dinamica por resultados). Ambos se calculan desde partidos reales. Devuelve
 * null si no hay datos suficientes. Es experimental y su confianza esta acotada.
 */
export async function getFootballStatisticalPrediction(
  input: {
    homeTeam: string;
    awayTeam: string;
    providers?: string[];
  },
  client?: ReturnType<typeof getPrisma>,
): Promise<FootballPredictionResult | null> {
  try {
    const prisma = client ?? getPrisma();
    const providers = input.providers ?? ["OpenFootball", "StatsBomb Open Data", "TheSportsDB", "API-Sports Football"];
    const matches = await loadCompletedFootballMatches(prisma, providers);
    if (matches.length === 0) return null;

    // Nombres canonicos para enlazar el evento con su historia entre proveedores.
    const homeKey = canonicalTeamName(input.homeTeam);
    const awayKey = canonicalTeamName(input.awayTeam);

    const { strengths, leagueAverageGoals } = computeAdjustedTeamStrengths(matches);
    const prediction = predictFootballMatch(homeKey, awayKey, strengths, leagueAverageGoals);
    if (!prediction) return null;

    const poisson = prediction.probabilities;

    // Elo: partidos en orden cronologico (el loader los trae del mas reciente
    // al mas antiguo). Sede neutral por defecto (torneos).
    const chronological: EloMatch[] = [...matches]
      .reverse()
      .map((m) => ({ homeTeam: m.homeTeam, awayTeam: m.awayTeam, homeGoals: m.homeGoals, awayGoals: m.awayGoals }));
    const ratings = computeEloRatings(chronological);
    const home = ratings.get(homeKey);
    const away = ratings.get(awayKey);

    let probabilities = poisson;
    let elo: FootballPredictionResult["components"]["elo"] = null;
    if (home && away) {
      const eloProbs = eloWinProbabilities(home.rating, away.rating);
      elo = { ...eloProbs, ratingHome: Math.round(home.rating), ratingAway: Math.round(away.rating) };
      probabilities = blend1x2(poisson, eloProbs);
    }

    const predictedOutcome =
      probabilities.homeWin >= probabilities.draw && probabilities.homeWin >= probabilities.awayWin
        ? "home"
        : probabilities.awayWin >= probabilities.draw
          ? "away"
          : "draw";

    const caveats: string[] = [
      "Ensemble experimental (Poisson + Elo) sin validacion por backtesting propio todavia.",
    ];
    const minMatches = Math.min(prediction.sampleSize.home, prediction.sampleSize.away);
    if (minMatches < 5) {
      caveats.push(
        `Muestra reducida: solo ${minMatches} partidos historicos para el equipo con menos datos.`,
      );
    }

    // Monte Carlo desde las lambdas del modelo (semilla estable por matchup).
    const simulation = simulateMatch(prediction.lambdaHome, prediction.lambdaAway, {
      iterations: 10000,
      seed: seedFromString(`${input.homeTeam}|${input.awayTeam}`),
    });

    return {
      ...prediction,
      modelVersion: FOOTBALL_ENSEMBLE_VERSION,
      probabilities,
      predictedOutcome,
      homeTeam: input.homeTeam,
      awayTeam: input.awayTeam,
      caveats,
      components: { poisson, elo },
      simulation,
    };
  } catch {
    return null;
  }
}
