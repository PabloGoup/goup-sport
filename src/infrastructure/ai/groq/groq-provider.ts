import {
  batchResponseSchema,
  buildBatchResponseJsonSchema,
  type BatchResponse,
} from "@/domain/ai-enrichment/output-schema";
import {
  SYSTEM_PROMPT,
  buildBatchUserPrompt,
  buildCorrectionPrompt,
} from "@/domain/ai-enrichment/prompts";
import type {
  AiEnrichmentProvider,
  EventAnalysisInput,
  ProviderBatchResult,
} from "@/domain/ai-enrichment/types";
import { GroqClient } from "./groq-client";
import type { GroqConfig } from "./groq-config";
import { GroqProviderError } from "./groq-errors";

function parseAndValidate(content: string): BatchResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new GroqProviderError("La respuesta de Groq no es JSON valido.", {
      kind: "invalid_response",
      cause: error,
    });
  }

  const result = batchResponseSchema.safeParse(parsed);
  if (!result.success) {
    const details = result.error.issues
      .slice(0, 10)
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    const validationError = new GroqProviderError(
      `La respuesta de Groq no cumple el schema: ${details.join("; ")}`,
      { kind: "invalid_response" },
    );
    (validationError as GroqProviderError & { validationDetails?: string[] }).validationDetails =
      details;
    throw validationError;
  }

  return result.data;
}

/**
 * Implementacion Groq de AiEnrichmentProvider. Ante una respuesta que no
 * cumple el schema hace un unico reintento con prompt de correccion; la
 * division del lote la maneja la capa de aplicacion.
 */
export class GroqEnrichmentProvider implements AiEnrichmentProvider {
  readonly name = "groq";
  private readonly client: GroqClient;
  private readonly jsonSchema = buildBatchResponseJsonSchema() as Record<string, unknown>;

  constructor(config: GroqConfig, client?: GroqClient) {
    this.client = client ?? new GroqClient(config);
  }

  async analyzeEvents(events: EventAnalysisInput[]): Promise<ProviderBatchResult> {
    const userPrompt = buildBatchUserPrompt(events, this.jsonSchema);

    const first = await this.client.createJsonCompletion({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      jsonSchema: this.jsonSchema,
      schemaName: "goup_event_analysis_batch",
    });

    try {
      const response = parseAndValidate(first.content);
      return {
        analyses: response.analyses,
        usage: {
          promptTokens: first.promptTokens,
          completionTokens: first.completionTokens,
          totalTokens: first.totalTokens,
          latencyMs: first.latencyMs,
          modelName: first.modelName,
        },
      };
    } catch (error) {
      if (!(error instanceof GroqProviderError) || error.kind !== "invalid_response") throw error;

      const details =
        (error as GroqProviderError & { validationDetails?: string[] }).validationDetails ?? [
          error.message,
        ];

      console.warn("[groq] respuesta invalida; reintentando con prompt de correccion.");

      const second = await this.client.createJsonCompletion({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: `${userPrompt}\n\n${buildCorrectionPrompt(details)}`,
        jsonSchema: this.jsonSchema,
        schemaName: "goup_event_analysis_batch",
      });

      const response = parseAndValidate(second.content);
      return {
        analyses: response.analyses,
        usage: {
          promptTokens: first.promptTokens + second.promptTokens,
          completionTokens: first.completionTokens + second.completionTokens,
          totalTokens: first.totalTokens + second.totalTokens,
          latencyMs: first.latencyMs + second.latencyMs,
          modelName: second.modelName,
        },
      };
    }
  }
}
