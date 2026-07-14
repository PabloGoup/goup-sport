export type GroqConfig = {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  batchSize: number;
  maxRetries: number;
  requestTimeoutMs: number;
  maxConcurrency: number;
  promptVersion: string;
  windowDays: number;
};

function readInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} debe ser un entero entre ${min} y ${max}. Valor recibido: "${raw}".`);
  }
  return value;
}

/**
 * Lee y valida la configuracion Groq desde el entorno.
 * Falla con mensaje claro si la integracion esta activada sin API key.
 * La clave existe solo en el servidor: nunca usar NEXT_PUBLIC_GROQ_API_KEY.
 */
export function getGroqConfig(): GroqConfig {
  const enabled = process.env.GROQ_ENRICHMENT_ENABLED === "true";
  const apiKey = process.env.GROQ_API_KEY ?? "";

  if (enabled && !apiKey) {
    throw new Error(
      "GROQ_ENRICHMENT_ENABLED=true pero falta GROQ_API_KEY. Define la clave en el entorno del servidor o desactiva la integracion.",
    );
  }

  return {
    enabled,
    apiKey,
    baseUrl: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
    model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
    batchSize: readInt("GROQ_BATCH_SIZE", 15, 1, 50),
    maxRetries: readInt("GROQ_MAX_RETRIES", 3, 0, 10),
    requestTimeoutMs: readInt("GROQ_REQUEST_TIMEOUT_MS", 60000, 1000, 600000),
    maxConcurrency: readInt("GROQ_MAX_CONCURRENCY", 1, 1, 8),
    promptVersion: process.env.GROQ_PROMPT_VERSION ?? "event-analysis-v1",
    windowDays: readInt("AI_ENRICHMENT_WINDOW_DAYS", 14, 1, 90),
  };
}
