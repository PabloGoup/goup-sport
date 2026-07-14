import { describe, expect, it } from "vitest";
import { normalizeGroqBaseUrl } from "@/infrastructure/ai/groq/groq-client";

describe("normalizeGroqBaseUrl", () => {
  it("quita el sufijo /openai/v1 que el SDK ya agrega", () => {
    expect(normalizeGroqBaseUrl("https://api.groq.com/openai/v1")).toBe("https://api.groq.com");
  });

  it("tolera una barra final", () => {
    expect(normalizeGroqBaseUrl("https://api.groq.com/openai/v1/")).toBe("https://api.groq.com");
  });

  it("deja intacto un host sin el sufijo (proxy propio)", () => {
    expect(normalizeGroqBaseUrl("https://proxy.interno/groq")).toBe("https://proxy.interno/groq");
  });
});
