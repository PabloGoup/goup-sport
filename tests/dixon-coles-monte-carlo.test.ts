import { describe, expect, it } from "vitest";
import {
  computeTeamStrengths,
  dixonColesTau,
  predictFootballMatch,
  type CompletedMatch,
} from "@/domain/prediction/football-poisson";
import {
  mulberry32,
  samplePoisson,
  seedFromString,
  simulateMatch,
} from "@/domain/prediction/monte-carlo";

describe("dixonColesTau", () => {
  it("es 1 fuera de los marcadores bajos", () => {
    expect(dixonColesTau(2, 1, 1.2, 1.0, -0.1)).toBe(1);
    expect(dixonColesTau(3, 2, 1.2, 1.0, -0.1)).toBe(1);
  });

  it("con rho<0 aumenta 0-0 y 1-1, y reduce 1-0 y 0-1", () => {
    const rho = -0.1;
    expect(dixonColesTau(0, 0, 1.2, 1.0, rho)).toBeGreaterThan(1);
    expect(dixonColesTau(1, 1, 1.2, 1.0, rho)).toBeGreaterThan(1);
    expect(dixonColesTau(1, 0, 1.2, 1.0, rho)).toBeLessThan(1);
    expect(dixonColesTau(0, 1, 1.2, 1.0, rho)).toBeLessThan(1);
  });

  it("sin correlacion (rho=0) no cambia nada", () => {
    expect(dixonColesTau(0, 0, 1.2, 1.0, 0)).toBe(1);
    expect(dixonColesTau(1, 1, 1.2, 1.0, 0)).toBe(1);
  });
});

const matches: CompletedMatch[] = [
  { homeTeam: "A", awayTeam: "B", homeGoals: 3, awayGoals: 0 },
  { homeTeam: "A", awayTeam: "C", homeGoals: 2, awayGoals: 1 },
  { homeTeam: "B", awayTeam: "C", homeGoals: 1, awayGoals: 1 },
  { homeTeam: "C", awayTeam: "A", homeGoals: 0, awayGoals: 2 },
  { homeTeam: "B", awayTeam: "A", homeGoals: 0, awayGoals: 1 },
];

describe("predictFootballMatch con Dixon-Coles", () => {
  it("sigue produciendo 1X2 que suman ~1", () => {
    const { strengths, leagueAverageGoals } = computeTeamStrengths(matches);
    const pred = predictFootballMatch("A", "B", strengths, leagueAverageGoals)!;
    const { homeWin, draw, awayWin } = pred.probabilities;
    expect(homeWin + draw + awayWin).toBeCloseTo(1, 2);
  });

  it("rho<0 no baja la probabilidad de empate respecto a Poisson puro", () => {
    const { strengths, leagueAverageGoals } = computeTeamStrengths(matches);
    const puro = predictFootballMatch("A", "B", strengths, leagueAverageGoals, { rho: 0 })!;
    const dc = predictFootballMatch("A", "B", strengths, leagueAverageGoals, { rho: -0.1 })!;
    expect(dc.probabilities.draw).toBeGreaterThanOrEqual(puro.probabilities.draw);
  });
});

describe("Monte Carlo", () => {
  it("mulberry32 es determinista para la misma semilla", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("seedFromString es estable", () => {
    expect(seedFromString("France|Spain")).toBe(seedFromString("France|Spain"));
    expect(seedFromString("France|Spain")).not.toBe(seedFromString("Spain|France"));
  });

  it("samplePoisson produce una media cercana a lambda", () => {
    const rng = mulberry32(7);
    const n = 20000;
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += samplePoisson(1.5, rng);
    expect(sum / n).toBeCloseTo(1.5, 1);
  });

  it("simula un partido de forma reproducible y coherente", () => {
    const a = simulateMatch(1.6, 1.1, { iterations: 5000, seed: 42 });
    const b = simulateMatch(1.6, 1.1, { iterations: 5000, seed: 42 });
    expect(a.homeWins).toBe(b.homeWins);
    expect(a.homeWins + a.draws + a.awayWins).toBe(5000);
    // Con mayor lambda local, gana el local mas veces que el visitante.
    expect(a.homeWins).toBeGreaterThan(a.awayWins);
    expect(a.averageGoals.home).toBeGreaterThan(a.averageGoals.away);
    const probSum = a.probabilities.homeWin + a.probabilities.draw + a.probabilities.awayWin;
    expect(probSum).toBeCloseTo(1, 4);
  });
});
