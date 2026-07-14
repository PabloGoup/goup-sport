import Groq from "groq-sdk";
import { withRetries } from "../retry";
import type { GroqConfig } from "./groq-config";
import { GroqProviderError, classifyStatus, parseRetryAfterMs } from "./groq-errors";
import type { GroqJsonRequest, GroqJsonResponse } from "./groq-types";

type ResponseFormat =
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: { name: string; schema: Record<string, unknown> } };

/**
 * El SDK de Groq ya agrega la ruta `/openai/v1` a cada endpoint. Como
 * `GROQ_BASE_URL` sigue la convencion estilo OpenAI e incluye ese sufijo,
 * lo removemos para el SDK y evitar rutas duplicadas (`/openai/v1/openai/v1`).
 */
export function normalizeGroqBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "").replace(/\/openai\/v1$/, "");
}

function toProviderError(error: unknown): GroqProviderError {
  if (error instanceof GroqProviderError) return error;

  if (error instanceof Groq.APIError) {
    const status = typeof error.status === "number" ? error.status : 0;
    const headers = error.headers as Headers | Record<string, string> | undefined;
    const retryAfterRaw =
      headers instanceof Headers ? headers.get("retry-after") : headers?.["retry-after"];

    return new GroqProviderError(`Groq respondio ${status}: ${error.message}`, {
      kind: classifyStatus(status),
      status,
      retryAfterMs: parseRetryAfterMs(retryAfterRaw),
      cause: error,
    });
  }

  if (error instanceof Groq.APIConnectionTimeoutError) {
    return new GroqProviderError("Timeout al llamar a Groq.", { kind: "timeout", cause: error });
  }

  if (error instanceof Groq.APIConnectionError) {
    return new GroqProviderError("Error de conexion con Groq.", { kind: "server", cause: error });
  }

  return new GroqProviderError("Error desconocido al llamar a Groq.", {
    kind: "unknown",
    cause: error,
  });
}

/**
 * Cliente centralizado de Groq. Responsabilidades:
 * timeout, clasificacion de errores, reintentos exponenciales que respetan
 * Retry-After, degradacion json_schema -> json_object y registro de uso.
 * Nunca registra la API key ni el prompt completo.
 */
export class GroqClient {
  private readonly sdk: Groq;
  private supportsJsonSchema = true;

  constructor(private readonly config: GroqConfig) {
    if (!config.apiKey) {
      throw new Error("GroqClient requiere GROQ_API_KEY. Revisa la configuracion del servidor.");
    }

    this.sdk = new Groq({
      apiKey: config.apiKey,
      baseURL: normalizeGroqBaseUrl(config.baseUrl),
      timeout: config.requestTimeoutMs,
      // Los reintentos los maneja withRetries para controlar backoff y Retry-After.
      maxRetries: 0,
    });
  }

  async createJsonCompletion(request: GroqJsonRequest): Promise<GroqJsonResponse> {
    return withRetries(() => this.executeOnce(request), {
      maxRetries: this.config.maxRetries,
      onRetry: (attempt, delayMs, error) => {
        const kind = error instanceof GroqProviderError ? error.kind : "unknown";
        console.warn(
          `[groq] reintento ${attempt}/${this.config.maxRetries} en ${delayMs}ms (motivo: ${kind})`,
        );
      },
    });
  }

  private async executeOnce(request: GroqJsonRequest): Promise<GroqJsonResponse> {
    const useSchema = Boolean(request.jsonSchema) && this.supportsJsonSchema;
    const responseFormat: ResponseFormat = useSchema
      ? {
          type: "json_schema",
          json_schema: {
            name: request.schemaName ?? "goup_event_analysis",
            schema: request.jsonSchema as Record<string, unknown>,
          },
        }
      : { type: "json_object" };

    const startedAt = Date.now();

    try {
      const completion = await this.sdk.chat.completions.create({
        model: this.config.model,
        temperature: 0.2,
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userPrompt },
        ],
        response_format: responseFormat,
      });

      const latencyMs = Date.now() - startedAt;
      const content = completion.choices[0]?.message?.content;

      if (!content) {
        throw new GroqProviderError("Groq devolvio una respuesta vacia.", {
          kind: "invalid_response",
        });
      }

      const usage = completion.usage;
      const result: GroqJsonResponse = {
        content,
        modelName: completion.model ?? this.config.model,
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: usage?.completion_tokens ?? 0,
        totalTokens: usage?.total_tokens ?? 0,
        latencyMs,
        usedJsonObjectFallback: !useSchema && Boolean(request.jsonSchema),
      };

      console.info(
        `[groq] ok model=${result.modelName} tokens=${result.totalTokens} latencia=${latencyMs}ms`,
      );

      return result;
    } catch (error) {
      const providerError = toProviderError(error);

      // El modelo configurado no soporta json_schema: degradar a json_object y reintentar.
      if (
        useSchema &&
        providerError.kind === "bad_request" &&
        /response_format|json_schema/i.test(providerError.message)
      ) {
        console.warn("[groq] el modelo no soporta json_schema; degradando a json_object.");
        this.supportsJsonSchema = false;
        return this.executeOnce(request);
      }

      console.error(
        `[groq] error kind=${providerError.kind} status=${providerError.status ?? "n/a"} latencia=${Date.now() - startedAt}ms`,
      );
      throw providerError;
    }
  }
}
