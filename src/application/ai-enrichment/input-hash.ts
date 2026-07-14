import { createHash } from "node:crypto";
import type { EventAnalysisInput } from "@/domain/ai-enrichment/types";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * Serializacion canonica: claves ordenadas recursivamente, floats redondeados
 * a 4 decimales y `undefined` omitido. Mismo input => misma cadena siempre.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function normalize(value: unknown): JsonValue {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return Number.isInteger(value) ? value : Number(value.toFixed(4));
  }

  if (typeof value === "string" || typeof value === "boolean") return value;

  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) return value.map(normalize);

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    const result: { [key: string]: JsonValue } = {};
    for (const [key, entryValue] of entries) {
      result[key] = normalize(entryValue);
    }
    return result;
  }

  return null;
}

/**
 * Hash determinista del input de analisis. Incluye promptVersion ademas de
 * los datos del evento (featureVersion y predictionVersion ya viajan en
 * `input.meta`), de modo que cualquier cambio relevante invalida el analisis.
 */
export function buildInputHash(input: EventAnalysisInput, promptVersion: string): string {
  const payload = canonicalJson({ input, promptVersion });
  return createHash("sha256").update(payload).digest("hex");
}
