import { describe, expect, it } from "vitest";
import {
  ELO_START,
  computeEloRatings,
  eloExpectedScore,
  eloWinProbabilities,
  type EloMatch,
} from "@/domain/prediction/elo";

describe("eloExpectedScore", () => {
  it("da 0.5 con ratings iguales y sin ventaja", () => {
    expect(eloExpectedScore(1500, 1500)).toBeCloseTo(0.5, 5);
  });

  it("favorece al equipo con mayor rating", () => {
    expect(eloExpectedScore(1700, 1500)).toBeGreaterThan(0.5);
  });
});

describe("computeEloRatings", () => {
  it("sube el rating del ganador y baja el del perdedor (suma cero)", () => {
    const matches: EloMatch[] = [{ homeTeam: "A", awayTeam: "B", homeGoals: 2, awayGoals: 0 }];
    const ratings = computeEloRatings(matches);
    expect(ratings.get("A")!.rating).toBeGreaterThan(ELO_START);
    expect(ratings.get("B")!.rating).toBeLessThan(ELO_START);
    const sum = ratings.get("A")!.rating + ratings.get("B")!.rating;
    expect(sum).toBeCloseTo(2 * ELO_START, 5);
  });

  it("mueve mas el rating cuando el margen de goles es mayor", () => {
    const narrow = computeEloRatings([{ homeTeam: "A", awayTeam: "B", homeGoals: 1, awayGoals: 0 }]);
    const blowout = computeEloRatings([{ homeTeam: "A", awayTeam: "B", homeGoals: 5, awayGoals: 0 }]);
    expect(blowout.get("A")!.rating).toBeGreaterThan(narrow.get("A")!.rating);
  });

  it("ordena por fuerza a un equipo que gana consistentemente", () => {
    const matches: EloMatch[] = [
      { homeTeam: "Fuerte", awayTeam: "Medio", homeGoals: 2, awayGoals: 1 },
      { homeTeam: "Medio", awayTeam: "Debil", homeGoals: 2, awayGoals: 1 },
      { homeTeam: "Fuerte", awayTeam: "Debil", homeGoals: 3, awayGoals: 0 },
    ];
    const ratings = computeEloRatings(matches);
    expect(ratings.get("Fuerte")!.rating).toBeGreaterThan(ratings.get("Medio")!.rating);
    expect(ratings.get("Medio")!.rating).toBeGreaterThan(ratings.get("Debil")!.rating);
  });
});

describe("eloWinProbabilities", () => {
  it("suma 1 y da empate maximo cuando estan parejos", () => {
    const even = eloWinProbabilities(1500, 1500);
    expect(even.homeWin + even.draw + even.awayWin).toBeCloseTo(1, 4);
    expect(even.homeWin).toBeCloseTo(even.awayWin, 4);

    const lopsided = eloWinProbabilities(1800, 1400);
    expect(lopsided.homeWin).toBeGreaterThan(lopsided.awayWin);
    // El empate cae cuando la diferencia de fuerza crece.
    expect(lopsided.draw).toBeLessThan(even.draw);
  });
});
