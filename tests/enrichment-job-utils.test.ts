import { describe, expect, it } from "vitest";
import { chunk, estimateTokens, hasEnoughData } from "@/application/ai-enrichment/enrichment-job";
import { buildSampleInput } from "./fixtures";

describe("chunk", () => {
  it("divide 300 eventos en 20 lotes de 15", () => {
    const batches = chunk(Array.from({ length: 300 }, (_, index) => index), 15);
    expect(batches).toHaveLength(20);
    expect(batches.every((batch) => batch.length === 15)).toBe(true);
  });

  it("mantiene el resto en el ultimo lote", () => {
    const batches = chunk([1, 2, 3, 4, 5], 2);
    expect(batches).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("rechaza tamanos invalidos", () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});

describe("estimateTokens", () => {
  it("estima tokens proporcionales al tamano del input", () => {
    const one = estimateTokens([buildSampleInput()]);
    const two = estimateTokens([buildSampleInput(), buildSampleInput()]);
    expect(one).toBeGreaterThan(0);
    expect(two).toBeGreaterThan(one);
  });
});

describe("hasEnoughData", () => {
  it("acepta eventos con forma reciente o metricas", () => {
    expect(hasEnoughData(buildSampleInput())).toBe(true);
  });

  it("rechaza eventos sin ninguna senal analizable", () => {
    const input = buildSampleInput({
      participantA: { id: "a", name: "A" },
      participantB: { id: "b", name: "B" },
    });
    expect(hasEnoughData(input)).toBe(false);
  });
});
