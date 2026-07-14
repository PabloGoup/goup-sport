import { describe, expect, it, vi } from "vitest";
import type { GroqClient } from "@/infrastructure/ai/groq/groq-client";
import type { GroqConfig } from "@/infrastructure/ai/groq/groq-config";
import { GroqEnrichmentProvider } from "@/infrastructure/ai/groq/groq-provider";
import { buildSampleAnalysis, buildSampleInput } from "./fixtures";

const config: GroqConfig = {
  enabled: true,
  apiKey: "test-key",
  baseUrl: "https://api.groq.com/openai/v1",
  model: "llama-3.3-70b-versatile",
  batchSize: 15,
  maxRetries: 3,
  requestTimeoutMs: 60000,
  maxConcurrency: 1,
  promptVersion: "event-analysis-v1",
  windowDays: 14,
};

function fakeClient(contents: string[]): GroqClient {
  let call = 0;
  return {
    createJsonCompletion: vi.fn(async () => ({
      content: contents[Math.min(call++, contents.length - 1)],
      modelName: "llama-3.3-70b-versatile",
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      latencyMs: 20,
      usedJsonObjectFallback: false,
    })),
  } as unknown as GroqClient;
}

describe("GroqEnrichmentProvider", () => {
  it("devuelve analisis validados con metricas de uso", async () => {
    const valid = JSON.stringify({ analyses: [buildSampleAnalysis()] });
    const provider = new GroqEnrichmentProvider(config, fakeClient([valid]));

    const result = await provider.analyzeEvents([buildSampleInput()]);
    expect(result.analyses).toHaveLength(1);
    expect(result.analyses[0].eventId).toBe("event-1");
    expect(result.usage.totalTokens).toBe(150);
  });

  it("reintenta con prompt de correccion ante JSON invalido y suma el uso", async () => {
    const valid = JSON.stringify({ analyses: [buildSampleAnalysis()] });
    const client = fakeClient(["esto no es JSON {", valid]);
    const provider = new GroqEnrichmentProvider(config, client);

    const result = await provider.analyzeEvents([buildSampleInput()]);
    expect(result.analyses).toHaveLength(1);
    expect(result.usage.totalTokens).toBe(300);
    expect(client.createJsonCompletion).toHaveBeenCalledTimes(2);
  });

  it("falla si la respuesta sigue siendo invalida tras la correccion (JSON truncado)", async () => {
    const truncated = '{"analyses":[{"eventId":"event-1","headline":"corte';
    const provider = new GroqEnrichmentProvider(config, fakeClient([truncated, truncated]));

    await expect(provider.analyzeEvents([buildSampleInput()])).rejects.toThrow(/JSON|schema/i);
  });

  it("falla si la respuesta valida como JSON pero no cumple el schema", async () => {
    const wrongShape = JSON.stringify({ analyses: [{ eventId: "event-1" }] });
    const provider = new GroqEnrichmentProvider(config, fakeClient([wrongShape, wrongShape]));

    await expect(provider.analyzeEvents([buildSampleInput()])).rejects.toThrow(/schema/i);
  });
});
