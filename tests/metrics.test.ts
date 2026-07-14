import { describe, expect, it } from "vitest";
import {
  accuracy,
  baseRates,
  brierScore,
  calibrationCurve,
  logLoss,
  type Prediction,
} from "@/domain/prediction/metrics";

const perfect: Prediction[] = [
  { probs: { homeWin: 1, draw: 0, awayWin: 0 }, actual: "home" },
  { probs: { homeWin: 0, draw: 1, awayWin: 0 }, actual: "draw" },
  { probs: { homeWin: 0, draw: 0, awayWin: 1 }, actual: "away" },
];

const uniform: Prediction[] = [
  { probs: { homeWin: 1 / 3, draw: 1 / 3, awayWin: 1 / 3 }, actual: "home" },
  { probs: { homeWin: 1 / 3, draw: 1 / 3, awayWin: 1 / 3 }, actual: "away" },
];

describe("accuracy", () => {
  it("es 1 con predicciones perfectas", () => {
    expect(accuracy(perfect)).toBe(1);
  });
  it("cuenta el argmax como acierto", () => {
    const p: Prediction[] = [{ probs: { homeWin: 0.5, draw: 0.3, awayWin: 0.2 }, actual: "home" }];
    expect(accuracy(p)).toBe(1);
    const q: Prediction[] = [{ probs: { homeWin: 0.5, draw: 0.3, awayWin: 0.2 }, actual: "away" }];
    expect(accuracy(q)).toBe(0);
  });
});

describe("brierScore", () => {
  it("es 0 con predicciones perfectas", () => {
    expect(brierScore(perfect)).toBeCloseTo(0, 6);
  });
  it("penaliza el modelo uniforme", () => {
    // Cada match uniforme: (1/3-1)^2 + (1/3)^2 + (1/3)^2 = 4/9+1/9+1/9 = 6/9
    expect(brierScore(uniform)).toBeCloseTo(6 / 9, 6);
  });
});

describe("logLoss", () => {
  it("es ~0 con predicciones perfectas", () => {
    expect(logLoss(perfect)).toBeCloseTo(0, 4);
  });
  it("es ln(3) con el modelo uniforme", () => {
    expect(logLoss(uniform)).toBeCloseTo(Math.log(3), 6);
  });
  it("no explota si la prob del resultado real es 0 (clamp)", () => {
    const p: Prediction[] = [{ probs: { homeWin: 0, draw: 0, awayWin: 1 }, actual: "home" }];
    expect(Number.isFinite(logLoss(p))).toBe(true);
  });
});

describe("baseRates", () => {
  it("calcula frecuencias de resultado", () => {
    const preds: Prediction[] = [
      { probs: { homeWin: 0, draw: 0, awayWin: 0 }, actual: "home" },
      { probs: { homeWin: 0, draw: 0, awayWin: 0 }, actual: "home" },
      { probs: { homeWin: 0, draw: 0, awayWin: 0 }, actual: "draw" },
      { probs: { homeWin: 0, draw: 0, awayWin: 0 }, actual: "away" },
    ];
    const r = baseRates(preds);
    expect(r.homeWin).toBeCloseTo(0.5, 6);
    expect(r.draw).toBeCloseTo(0.25, 6);
    expect(r.awayWin).toBeCloseTo(0.25, 6);
  });
});

describe("calibrationCurve", () => {
  it("agrupa por prob del favorito y mide acierto real", () => {
    const preds: Prediction[] = [
      { probs: { homeWin: 0.9, draw: 0.05, awayWin: 0.05 }, actual: "home" },
      { probs: { homeWin: 0.9, draw: 0.05, awayWin: 0.05 }, actual: "away" },
    ];
    const curve = calibrationCurve(preds, 5);
    const bin = curve.find((b) => b.count === 2);
    expect(bin).toBeDefined();
    expect(bin!.predicted).toBeCloseTo(0.9, 6);
    expect(bin!.observed).toBeCloseTo(0.5, 6); // 1 de 2 aciertos
  });
});
