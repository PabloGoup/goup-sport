/**
 * Ratings Elo para futbol, con multiplicador por margen de victoria (estilo
 * World Football Elo / FiveThirtyEight). Mide fuerza dinamica basada en
 * resultados (no solo goles), complementando al modelo de Poisson.
 */

export const ELO_MODEL_VERSION = "goup-elo-football-0.1.0";

export const ELO_START = 1500;

export type EloMatch = {
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  /** Ventaja de local en puntos Elo (0 en sedes neutrales como el Mundial). */
  homeAdvantage?: number;
};

export type EloRating = { team: string; rating: number; matches: number };

export type EloOptions = {
  k?: number;
  defaultHomeAdvantage?: number;
};

/** Expectativa de puntuacion del local segun la diferencia de rating. */
export function eloExpectedScore(ratingHome: number, ratingAway: number, homeAdvantage = 0): number {
  return 1 / (1 + 10 ** ((ratingAway - ratingHome - homeAdvantage) / 400));
}

/** Multiplicador por margen de gol: ganar por mucho mueve mas el rating. */
function marginMultiplier(goalDiff: number): number {
  const absDiff = Math.abs(goalDiff);
  if (absDiff <= 1) return 1;
  if (absDiff === 2) return 1.5;
  return (11 + absDiff) / 8;
}

/**
 * Procesa partidos en orden cronologico (mas antiguo primero) y devuelve el
 * rating final de cada equipo. Todos parten en ELO_START.
 */
export function computeEloRatings(
  matchesChronological: EloMatch[],
  options: EloOptions = {},
): Map<string, EloRating> {
  const k = options.k ?? 24;
  const defaultHomeAdvantage = options.defaultHomeAdvantage ?? 0;
  const ratings = new Map<string, EloRating>();

  const get = (team: string): EloRating => {
    let entry = ratings.get(team);
    if (!entry) {
      entry = { team, rating: ELO_START, matches: 0 };
      ratings.set(team, entry);
    }
    return entry;
  };

  for (const match of matchesChronological) {
    const home = get(match.homeTeam);
    const away = get(match.awayTeam);
    const homeAdvantage = match.homeAdvantage ?? defaultHomeAdvantage;

    const expectedHome = eloExpectedScore(home.rating, away.rating, homeAdvantage);
    const actualHome = match.homeGoals > match.awayGoals ? 1 : match.homeGoals === match.awayGoals ? 0.5 : 0;
    const multiplier = marginMultiplier(match.homeGoals - match.awayGoals);
    const delta = k * multiplier * (actualHome - expectedHome);

    home.rating += delta;
    away.rating -= delta;
    home.matches += 1;
    away.matches += 1;
  }

  return ratings;
}

const DRAW_BASE = 0.28;

/**
 * Probabilidades 1X2 a partir de los ratings Elo. La expectativa Elo reparte
 * victoria/derrota; el empate se modela como maximo cuando el partido es
 * parejo y decrece con la diferencia de fuerza.
 */
export function eloWinProbabilities(
  ratingHome: number,
  ratingAway: number,
  homeAdvantage = 0,
): { homeWin: number; draw: number; awayWin: number } {
  const expected = eloExpectedScore(ratingHome, ratingAway, homeAdvantage);
  const draw = DRAW_BASE * (1 - Math.abs(2 * expected - 1));
  const homeWin = Math.max(0, expected - draw / 2);
  const awayWin = Math.max(0, 1 - expected - draw / 2);

  const total = homeWin + draw + awayWin || 1;
  return {
    homeWin: Number((homeWin / total).toFixed(4)),
    draw: Number((draw / total).toFixed(4)),
    awayWin: Number((awayWin / total).toFixed(4)),
  };
}
