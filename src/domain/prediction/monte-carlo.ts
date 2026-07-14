/**
 * Simulacion de Monte Carlo de un partido a partir de los goles esperados
 * (lambdas) del modelo Poisson. Usa un PRNG con semilla para resultados
 * deterministas y reproducibles (mismo partido -> misma simulacion).
 */

export type SimulationResult = {
  iterations: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  probabilities: { homeWin: number; draw: number; awayWin: number };
  topScores: Array<{ label: string; count: number; probability: number }>;
  averageGoals: { home: number; away: number };
};

/** PRNG mulberry32: rapido, determinista, suficiente para simulacion. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Semilla estable derivada de un texto (nombres de equipos). */
export function seedFromString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Muestrea una Poisson con el algoritmo de Knuth (adecuado para lambda pequena). */
export function samplePoisson(lambda: number, rng: () => number): number {
  const limit = Math.exp(-lambda);
  let product = 1;
  let count = 0;
  do {
    count += 1;
    product *= rng();
  } while (product > limit);
  return count - 1;
}

export function simulateMatch(
  lambdaHome: number,
  lambdaAway: number,
  options: { iterations?: number; seed?: number } = {},
): SimulationResult {
  const iterations = options.iterations ?? 10000;
  const rng = mulberry32(options.seed ?? 1);

  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let totalHomeGoals = 0;
  let totalAwayGoals = 0;
  const scoreCounts = new Map<string, number>();

  for (let i = 0; i < iterations; i += 1) {
    const h = samplePoisson(lambdaHome, rng);
    const a = samplePoisson(lambdaAway, rng);
    if (h > a) homeWins += 1;
    else if (h === a) draws += 1;
    else awayWins += 1;
    totalHomeGoals += h;
    totalAwayGoals += a;
    const label = `${h}-${a}`;
    scoreCounts.set(label, (scoreCounts.get(label) ?? 0) + 1);
  }

  const topScores = [...scoreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count, probability: Number((count / iterations).toFixed(4)) }));

  return {
    iterations,
    homeWins,
    draws,
    awayWins,
    probabilities: {
      homeWin: Number((homeWins / iterations).toFixed(4)),
      draw: Number((draws / iterations).toFixed(4)),
      awayWin: Number((awayWins / iterations).toFixed(4)),
    },
    topScores,
    averageGoals: {
      home: Number((totalHomeGoals / iterations).toFixed(2)),
      away: Number((totalAwayGoals / iterations).toFixed(2)),
    },
  };
}
