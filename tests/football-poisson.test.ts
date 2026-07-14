import { describe, expect, it } from "vitest";
import {
  computeAdjustedTeamStrengths,
  computeTeamStrengths,
  poissonProbability,
  predictFootballMatch,
  type CompletedMatch,
} from "@/domain/prediction/football-poisson";

describe("poissonProbability", () => {
  it("suma aproximadamente 1 sobre el soporte", () => {
    const lambda = 1.5;
    let total = 0;
    for (let k = 0; k <= 20; k += 1) total += poissonProbability(k, lambda);
    expect(total).toBeCloseTo(1, 5);
  });

  it("P(0) con lambda 0 es 1", () => {
    expect(poissonProbability(0, 0)).toBe(1);
    expect(poissonProbability(2, 0)).toBe(0);
  });

  it("coincide con el valor conocido de Poisson", () => {
    // P(k=2, lambda=2) = e^-2 * 2^2 / 2 = 0.2707
    expect(poissonProbability(2, 2)).toBeCloseTo(0.2707, 4);
  });
});

const matches: CompletedMatch[] = [
  { homeTeam: "A", awayTeam: "B", homeGoals: 3, awayGoals: 0 },
  { homeTeam: "A", awayTeam: "C", homeGoals: 2, awayGoals: 1 },
  { homeTeam: "B", awayTeam: "C", homeGoals: 1, awayGoals: 1 },
  { homeTeam: "C", awayTeam: "A", homeGoals: 0, awayGoals: 2 },
  { homeTeam: "B", awayTeam: "A", homeGoals: 0, awayGoals: 1 },
];

describe("computeTeamStrengths", () => {
  it("calcula fuerzas relativas a la media de la liga", () => {
    const { strengths, leagueAverageGoals } = computeTeamStrengths(matches);
    expect(leagueAverageGoals).toBeGreaterThan(0);
    const a = strengths.get("A");
    const b = strengths.get("B");
    expect(a).toBeDefined();
    // A anota mucho y recibe poco: ataque alto, defensa baja (buena).
    expect(a!.attack).toBeGreaterThan(b!.attack);
    expect(a!.defense).toBeLessThan(b!.defense);
    expect(a!.matches).toBe(4);
  });
});

describe("predictFootballMatch", () => {
  it("produce probabilidades 1X2 que suman ~1", () => {
    const { strengths, leagueAverageGoals } = computeTeamStrengths(matches);
    const pred = predictFootballMatch("A", "B", strengths, leagueAverageGoals);
    expect(pred).not.toBeNull();
    const { homeWin, draw, awayWin } = pred!.probabilities;
    expect(homeWin + draw + awayWin).toBeCloseTo(1, 2);
  });

  it("favorece al equipo mas fuerte", () => {
    const { strengths, leagueAverageGoals } = computeTeamStrengths(matches);
    const pred = predictFootballMatch("A", "B", strengths, leagueAverageGoals)!;
    expect(pred.probabilities.homeWin).toBeGreaterThan(pred.probabilities.awayWin);
    expect(pred.predictedOutcome).toBe("home");
  });

  it("devuelve los cinco marcadores mas probables ordenados", () => {
    const { strengths, leagueAverageGoals } = computeTeamStrengths(matches);
    const pred = predictFootballMatch("A", "B", strengths, leagueAverageGoals)!;
    expect(pred.topScorelines).toHaveLength(5);
    for (let i = 1; i < pred.topScorelines.length; i += 1) {
      expect(pred.topScorelines[i - 1].probability).toBeGreaterThanOrEqual(
        pred.topScorelines[i].probability,
      );
    }
  });

  it("acota la confianza por el tamano de muestra (techo 0.6)", () => {
    const { strengths, leagueAverageGoals } = computeTeamStrengths(matches);
    const pred = predictFootballMatch("A", "B", strengths, leagueAverageGoals)!;
    expect(pred.confidence).toBeGreaterThanOrEqual(0.1);
    expect(pred.confidence).toBeLessThanOrEqual(0.6);
  });

  it("devuelve null si falta un equipo", () => {
    const { strengths, leagueAverageGoals } = computeTeamStrengths(matches);
    expect(predictFootballMatch("A", "Z", strengths, leagueAverageGoals)).toBeNull();
  });
});

describe("computeAdjustedTeamStrengths (ajuste por fuerza del rival)", () => {
  // "Fuerte" vence a rivales duros por poco; "Inflado" golea a rivales debiles.
  // El modelo ingenuo premia al que golea; el ajustado debe corregirlo.
  const schedule: CompletedMatch[] = [
    // Rivales duros entre si (definen que Duro1/Duro2 son buenos).
    { homeTeam: "Duro1", awayTeam: "Duro2", homeGoals: 2, awayGoals: 1 },
    { homeTeam: "Duro2", awayTeam: "Duro1", homeGoals: 1, awayGoals: 1 },
    // Rivales debiles reciben goleadas de todos.
    { homeTeam: "Debil1", awayTeam: "Debil2", homeGoals: 0, awayGoals: 0 },
    // "Fuerte" gana a rivales duros por poco.
    { homeTeam: "Fuerte", awayTeam: "Duro1", homeGoals: 2, awayGoals: 1 },
    { homeTeam: "Fuerte", awayTeam: "Duro2", homeGoals: 1, awayGoals: 0 },
    // "Inflado" golea a rivales debiles.
    { homeTeam: "Inflado", awayTeam: "Debil1", homeGoals: 6, awayGoals: 0 },
    { homeTeam: "Inflado", awayTeam: "Debil2", homeGoals: 5, awayGoals: 0 },
  ];

  it("no premia al que solo golea rivales debiles por encima del que vence rivales fuertes", () => {
    const naive = computeTeamStrengths(schedule);
    const adjusted = computeAdjustedTeamStrengths(schedule);

    // El modelo ingenuo pone a "Inflado" con ataque mucho mayor que "Fuerte".
    expect(naive.strengths.get("Inflado")!.attack).toBeGreaterThan(
      naive.strengths.get("Fuerte")!.attack,
    );

    // El ajustado corrige la brecha: la ventaja de ataque de "Inflado" se reduce.
    const naiveGap =
      naive.strengths.get("Inflado")!.attack - naive.strengths.get("Fuerte")!.attack;
    const adjustedGap =
      adjusted.strengths.get("Inflado")!.attack - adjusted.strengths.get("Fuerte")!.attack;
    expect(adjustedGap).toBeLessThan(naiveGap);
  });

  it("pondera partidos por recencia (weight) sin romper la normalizacion", () => {
    const weighted = schedule.map((m, i) => ({ ...m, weight: i === 5 ? 0.1 : 1 }));
    const { strengths, leagueAverageGoals } = computeAdjustedTeamStrengths(weighted);
    expect(leagueAverageGoals).toBeGreaterThan(0);
    expect(strengths.get("Inflado")).toBeDefined();
    expect(strengths.get("Inflado")!.attack).toBeGreaterThan(0);
  });

  it("produce una prediccion valida con fuerzas ajustadas", () => {
    const { strengths, leagueAverageGoals } = computeAdjustedTeamStrengths(schedule);
    const pred = predictFootballMatch("Fuerte", "Inflado", strengths, leagueAverageGoals);
    expect(pred).not.toBeNull();
    const { homeWin, draw, awayWin } = pred!.probabilities;
    expect(homeWin + draw + awayWin).toBeCloseTo(1, 2);
  });
});
