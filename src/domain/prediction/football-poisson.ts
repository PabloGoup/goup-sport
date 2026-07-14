export const FOOTBALL_MODEL_VERSION = "goup-poisson-football-0.2.0";

/** Resultado de un partido completado, desde la perspectiva de la liga. */
export type CompletedMatch = {
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  /** Peso del partido (recencia). 1 = peso pleno; por defecto 1. */
  weight?: number;
};

export type TeamStrength = {
  team: string;
  matches: number;
  goalsFor: number;
  goalsAgainst: number;
  attack: number; // relativo a la media de la liga (1 = promedio)
  defense: number; // relativo a la media de la liga (1 = promedio)
};

export type Scoreline = { home: number; away: number; label: string; probability: number };

export type PoissonPrediction = {
  modelVersion: string;
  lambdaHome: number;
  lambdaAway: number;
  probabilities: { homeWin: number; draw: number; awayWin: number };
  predictedOutcome: "home" | "draw" | "away";
  topScorelines: Scoreline[];
  expectedScore: { home: number; away: number };
  sampleSize: { home: number; away: number; league: number };
  /** Confianza [0,1] acotada por el tamano de muestra; nunca alta sin validacion. */
  confidence: number;
};

function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i += 1) result *= i;
  return result;
}

/** Probabilidad de Poisson de observar exactamente k eventos dada la media lambda. */
export function poissonProbability(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.exp(-lambda) * lambda ** k) / factorial(k);
}

/**
 * Fuerzas de ataque y defensa por equipo, relativas a la media de la liga.
 * Se calcula a partir de partidos completados reales; sin partidos no hay fuerza.
 */
export function computeTeamStrengths(matches: CompletedMatch[]): {
  strengths: Map<string, TeamStrength>;
  leagueAverageGoals: number;
} {
  const totals = new Map<string, { matches: number; goalsFor: number; goalsAgainst: number }>();
  let totalGoals = 0;

  const bump = (team: string, gf: number, ga: number) => {
    const current = totals.get(team) ?? { matches: 0, goalsFor: 0, goalsAgainst: 0 };
    current.matches += 1;
    current.goalsFor += gf;
    current.goalsAgainst += ga;
    totals.set(team, current);
  };

  for (const match of matches) {
    bump(match.homeTeam, match.homeGoals, match.awayGoals);
    bump(match.awayTeam, match.awayGoals, match.homeGoals);
    totalGoals += match.homeGoals + match.awayGoals;
  }

  // Media de goles que anota un equipo por partido en la liga.
  const teamMatches = matches.length * 2;
  const leagueAverageGoals = teamMatches > 0 ? totalGoals / teamMatches : 0;

  const strengths = new Map<string, TeamStrength>();
  for (const [team, stat] of totals) {
    const avgFor = stat.goalsFor / stat.matches;
    const avgAgainst = stat.goalsAgainst / stat.matches;
    strengths.set(team, {
      team,
      matches: stat.matches,
      goalsFor: stat.goalsFor,
      goalsAgainst: stat.goalsAgainst,
      attack: leagueAverageGoals > 0 ? avgFor / leagueAverageGoals : 1,
      defense: leagueAverageGoals > 0 ? avgAgainst / leagueAverageGoals : 1,
    });
  }

  return { strengths, leagueAverageGoals };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

type MatchAgg = {
  matches: number; // conteo crudo (para confianza)
  weight: number; // peso total (recencia)
  goalsFor: number; // ponderado
  goalsAgainst: number; // ponderado
  opponents: Array<{ opponent: string; weight: number; goalsFor: number; goalsAgainst: number }>;
};

/**
 * Fuerzas de ataque/defensa AJUSTADAS por la calidad del rival, resueltas de
 * forma iterativa: marcar goles contra una buena defensa vale mas que contra
 * una debil, y recibir pocos goles contra ataques flojos cuenta menos.
 * Aplica ademas encogimiento hacia la media para muestras pequenas.
 *
 * Es la correccion al sesgo del modelo v0.1, que trataba todos los goles igual
 * (un 7-0 a un rival debil inflaba injustamente a un equipo).
 */
export function computeAdjustedTeamStrengths(
  matches: CompletedMatch[],
  options: { iterations?: number; shrinkage?: number } = {},
): { strengths: Map<string, TeamStrength>; leagueAverageGoals: number } {
  const iterations = options.iterations ?? 12;
  const shrinkage = options.shrinkage ?? 4; // partidos ficticios hacia la media

  const agg = new Map<string, MatchAgg>();
  let weightedGoals = 0;
  let weightedTeamMatches = 0;

  const ensure = (team: string): MatchAgg => {
    let entry = agg.get(team);
    if (!entry) {
      entry = { matches: 0, weight: 0, goalsFor: 0, goalsAgainst: 0, opponents: [] };
      agg.set(team, entry);
    }
    return entry;
  };

  for (const match of matches) {
    const w = match.weight ?? 1;
    if (w <= 0) continue;

    const home = ensure(match.homeTeam);
    const away = ensure(match.awayTeam);

    home.matches += 1;
    away.matches += 1;
    home.weight += w;
    away.weight += w;
    home.goalsFor += w * match.homeGoals;
    home.goalsAgainst += w * match.awayGoals;
    away.goalsFor += w * match.awayGoals;
    away.goalsAgainst += w * match.homeGoals;
    home.opponents.push({ opponent: match.awayTeam, weight: w, goalsFor: match.homeGoals, goalsAgainst: match.awayGoals });
    away.opponents.push({ opponent: match.homeTeam, weight: w, goalsFor: match.awayGoals, goalsAgainst: match.homeGoals });

    weightedGoals += w * (match.homeGoals + match.awayGoals);
    weightedTeamMatches += 2 * w;
  }

  const leagueAverageGoals = weightedTeamMatches > 0 ? weightedGoals / weightedTeamMatches : 0;

  const attack = new Map<string, number>();
  const defense = new Map<string, number>();
  for (const team of agg.keys()) {
    attack.set(team, 1);
    defense.set(team, 1);
  }

  if (leagueAverageGoals > 0) {
    for (let iter = 0; iter < iterations; iter += 1) {
      const nextAttack = new Map<string, number>();
      const nextDefense = new Map<string, number>();

      for (const [team, entry] of agg) {
        // Ataque: goles marcados / goles esperados si el ataque fuera medio,
        // dada la defensa (ajustada) de cada rival enfrentado.
        let expectedFor = 0;
        let expectedAgainst = 0;
        for (const game of entry.opponents) {
          expectedFor += game.weight * (defense.get(game.opponent) ?? 1) * leagueAverageGoals;
          expectedAgainst += game.weight * (attack.get(game.opponent) ?? 1) * leagueAverageGoals;
        }
        const rawAttack = expectedFor > 0 ? entry.goalsFor / expectedFor : 1;
        const rawDefense = expectedAgainst > 0 ? entry.goalsAgainst / expectedAgainst : 1;

        // Encogimiento hacia 1 (media de liga) segun peso de muestra.
        const shrunkAttack = (entry.weight * rawAttack + shrinkage) / (entry.weight + shrinkage);
        const shrunkDefense = (entry.weight * rawDefense + shrinkage) / (entry.weight + shrinkage);
        nextAttack.set(team, clamp(shrunkAttack, 0.2, 3));
        nextDefense.set(team, clamp(shrunkDefense, 0.2, 3));
      }

      // Normaliza para que la media de ataque y defensa sea 1 (escala estable).
      const meanAttack = mean([...nextAttack.values()]);
      const meanDefense = mean([...nextDefense.values()]);
      for (const team of agg.keys()) {
        attack.set(team, meanAttack > 0 ? (nextAttack.get(team) ?? 1) / meanAttack : 1);
        defense.set(team, meanDefense > 0 ? (nextDefense.get(team) ?? 1) / meanDefense : 1);
      }
    }
  }

  const strengths = new Map<string, TeamStrength>();
  for (const [team, entry] of agg) {
    strengths.set(team, {
      team,
      matches: entry.matches,
      goalsFor: Math.round(entry.goalsFor),
      goalsAgainst: Math.round(entry.goalsAgainst),
      attack: attack.get(team) ?? 1,
      defense: defense.get(team) ?? 1,
    });
  }

  return { strengths, leagueAverageGoals };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Predice un partido con Poisson independiente. Venue neutro por defecto
 * (sin ventaja de local), apropiado para torneos como el Mundial.
 * Devuelve null si falta fuerza para alguno de los equipos.
 */
export function predictFootballMatch(
  homeTeam: string,
  awayTeam: string,
  strengths: Map<string, TeamStrength>,
  leagueAverageGoals: number,
  options: { homeAdvantage?: number; maxGoals?: number } = {},
): PoissonPrediction | null {
  const home = strengths.get(homeTeam);
  const away = strengths.get(awayTeam);
  if (!home || !away || leagueAverageGoals <= 0) return null;

  const homeAdvantage = options.homeAdvantage ?? 1;
  const maxGoals = options.maxGoals ?? 8;

  const lambdaHome = clamp(home.attack * away.defense * leagueAverageGoals * homeAdvantage, 0.05, 8);
  const lambdaAway = clamp(away.attack * home.defense * leagueAverageGoals, 0.05, 8);

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  const scorelines: Scoreline[] = [];

  for (let h = 0; h <= maxGoals; h += 1) {
    const ph = poissonProbability(h, lambdaHome);
    for (let a = 0; a <= maxGoals; a += 1) {
      const probability = ph * poissonProbability(a, lambdaAway);
      if (h > a) homeWin += probability;
      else if (h === a) draw += probability;
      else awayWin += probability;
      scorelines.push({ home: h, away: a, label: `${h}-${a}`, probability });
    }
  }

  // Normaliza por la masa truncada en maxGoals.
  const total = homeWin + draw + awayWin || 1;
  homeWin /= total;
  draw /= total;
  awayWin /= total;

  const topScorelines = scorelines
    .map((line) => ({ ...line, probability: line.probability / total }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5);

  const predictedOutcome =
    homeWin >= draw && homeWin >= awayWin ? "home" : awayWin >= draw ? "away" : "draw";

  const sampleSize = { home: home.matches, away: away.matches, league: leagueAverageGoals };
  // Confianza acotada por la muestra minima; techo 0.6 sin validacion propia.
  const minMatches = Math.min(home.matches, away.matches);
  const confidence = clamp(minMatches / 10, 0.1, 0.6);

  return {
    modelVersion: FOOTBALL_MODEL_VERSION,
    lambdaHome,
    lambdaAway,
    probabilities: {
      homeWin: Number(homeWin.toFixed(4)),
      draw: Number(draw.toFixed(4)),
      awayWin: Number(awayWin.toFixed(4)),
    },
    predictedOutcome,
    topScorelines: topScorelines.map((line) => ({
      ...line,
      probability: Number(line.probability.toFixed(4)),
    })),
    expectedScore: { home: Math.round(lambdaHome), away: Math.round(lambdaAway) },
    sampleSize,
    confidence: Number(confidence.toFixed(2)),
  };
}
