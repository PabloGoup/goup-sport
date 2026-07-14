import { getPrisma } from "@/lib/prisma";
import {
  computeAdjustedTeamStrengths,
  predictFootballMatch,
  type CompletedMatch,
} from "@/domain/prediction/football-poisson";
import { ELO_START, eloExpectedScore } from "@/domain/prediction/elo";
import { canonicalTeamName } from "@/domain/prediction/team-name";
import {
  baseRates,
  summarize,
  calibrationCurve,
  type Outcome,
  type Prediction,
  type Prob1x2,
} from "@/domain/prediction/metrics";

type DatedMatch = CompletedMatch & { date: Date };

const FOOTBALL_PROVIDERS = ["OpenFootball", "StatsBomb Open Data", "TheSportsDB", "API-Sports Football"];

type RawPayload = {
  match?: { home_score?: number | null; away_score?: number | null };
  goals?: { home?: number | null; away?: number | null };
};

function scoreOf(payload: unknown): { home: number; away: number } | null {
  const p = payload as RawPayload;
  const home = p?.match?.home_score ?? p?.goals?.home;
  const away = p?.match?.away_score ?? p?.goals?.away;
  if (home === null || home === undefined || away === null || away === undefined) return null;
  return { home, away };
}

async function loadDatedMatches(client?: ReturnType<typeof getPrisma>): Promise<DatedMatch[]> {
  const prisma = client ?? getPrisma();
  const events = await prisma.event.findMany({
    where: { sportId: "sport-football", status: "completed", dataSource: { provider: { in: FOOTBALL_PROVIDERS } } },
    include: { home: { select: { name: true } }, away: { select: { name: true } } },
    orderBy: { startsAt: "asc" },
    take: 8000,
  });
  const matches: DatedMatch[] = [];
  for (const e of events) {
    const s = scoreOf(e.rawPayload);
    if (!s) continue;
    matches.push({
      date: e.startsAt,
      homeTeam: canonicalTeamName(e.home.name),
      awayTeam: canonicalTeamName(e.away.name),
      homeGoals: s.home,
      awayGoals: s.away,
    });
  }
  return matches;
}

function outcomeOf(m: DatedMatch): Outcome {
  return m.homeGoals > m.awayGoals ? "home" : m.homeGoals === m.awayGoals ? "draw" : "away";
}

function marginMultiplier(goalDiff: number): number {
  const abs = Math.abs(goalDiff);
  if (abs <= 1) return 1;
  if (abs === 2) return 1.5;
  return (11 + abs) / 8;
}

function eloProbs(ratingHome: number, ratingAway: number): Prob1x2 {
  const expected = eloExpectedScore(ratingHome, ratingAway);
  const draw = 0.28 * (1 - Math.abs(2 * expected - 1));
  const homeWin = Math.max(0, expected - draw / 2);
  const awayWin = Math.max(0, 1 - expected - draw / 2);
  const total = homeWin + draw + awayWin || 1;
  return { homeWin: homeWin / total, draw: draw / total, awayWin: awayWin / total };
}

function blend(a: Prob1x2, b: Prob1x2): Prob1x2 {
  const homeWin = (a.homeWin + b.homeWin) / 2;
  const draw = (a.draw + b.draw) / 2;
  const awayWin = (a.awayWin + b.awayWin) / 2;
  const total = homeWin + draw + awayWin || 1;
  return { homeWin: homeWin / total, draw: draw / total, awayWin: awayWin / total };
}

export type BacktestReport = {
  totalMatches: number;
  evaluated: number;
  ensemble: ReturnType<typeof summarize>;
  poisson: ReturnType<typeof summarize>;
  elo: ReturnType<typeof summarize>;
  baselineHome: ReturnType<typeof summarize>;
  baselineRate: ReturnType<typeof summarize>;
  calibration: ReturnType<typeof calibrationCurve>;
};

export type BacktestOptions = {
  minHistory?: number; // partidos previos minimos antes de evaluar
  window?: number; // ventana de partidos para las fuerzas Poisson
  recomputeEvery?: number; // cada cuantos partidos se recalcula Poisson
  eloK?: number;
};

/**
 * Validacion walk-forward: recorre los partidos en orden cronologico y predice
 * cada uno usando SOLO los anteriores (Elo incremental + Poisson por ventana),
 * luego compara con el resultado real. Mide el ensemble y cada modelo por
 * separado contra dos lineas base.
 */
export async function runFootballBacktest(
  options: BacktestOptions = {},
  client?: ReturnType<typeof getPrisma>,
): Promise<BacktestReport> {
  const minHistory = options.minHistory ?? 200;
  const window = options.window ?? 1000;
  const recomputeEvery = options.recomputeEvery ?? 40;
  const eloK = options.eloK ?? 24;

  const matches = await loadDatedMatches(client);
  const ratings = new Map<string, number>();
  const getR = (t: string) => ratings.get(t) ?? ELO_START;

  let strengths: ReturnType<typeof computeAdjustedTeamStrengths>["strengths"] | null = null;
  let leagueAvg = 0;

  const ens: Prediction[] = [];
  const poi: Prediction[] = [];
  const el: Prediction[] = [];
  const rate = baseRates(matches.map((m) => ({ probs: { homeWin: 0, draw: 0, awayWin: 0 }, actual: outcomeOf(m) })));

  const baseHome: Prediction[] = [];
  const baseRate: Prediction[] = [];

  for (let i = 0; i < matches.length; i += 1) {
    const m = matches[i];
    const actual = outcomeOf(m);

    if (i >= minHistory) {
      // Recalcula fuerzas Poisson periodicamente desde la ventana previa.
      if (!strengths || i % recomputeEvery === 0) {
        const hist = matches.slice(Math.max(0, i - window), i);
        const res = computeAdjustedTeamStrengths(hist);
        strengths = res.strengths;
        leagueAvg = res.leagueAverageGoals;
      }

      const poisson = strengths && leagueAvg > 0 ? predictFootballMatch(m.homeTeam, m.awayTeam, strengths, leagueAvg) : null;
      const eloP = ratings.has(m.homeTeam) && ratings.has(m.awayTeam) ? eloProbs(getR(m.homeTeam), getR(m.awayTeam)) : null;

      // Solo evaluamos cuando el modelo puede predecir (ambos con historia).
      if (poisson && eloP) {
        poi.push({ probs: poisson.probabilities, actual });
        el.push({ probs: eloP, actual });
        ens.push({ probs: blend(poisson.probabilities, eloP), actual });
        baseHome.push({ probs: { homeWin: 1, draw: 0, awayWin: 0 }, actual });
        baseRate.push({ probs: rate, actual });
      }
    }

    // Actualiza Elo con el resultado real (despues de predecir).
    const expected = eloExpectedScore(getR(m.homeTeam), getR(m.awayTeam));
    const actualScore = actual === "home" ? 1 : actual === "draw" ? 0.5 : 0;
    const delta = eloK * marginMultiplier(m.homeGoals - m.awayGoals) * (actualScore - expected);
    ratings.set(m.homeTeam, getR(m.homeTeam) + delta);
    ratings.set(m.awayTeam, getR(m.awayTeam) - delta);
  }

  return {
    totalMatches: matches.length,
    evaluated: ens.length,
    ensemble: summarize(ens),
    poisson: summarize(poi),
    elo: summarize(el),
    baselineHome: summarize(baseHome),
    baselineRate: summarize(baseRate),
    calibration: calibrationCurve(ens),
  };
}
