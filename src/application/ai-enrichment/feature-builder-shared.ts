/** Metricas agregadas de un participante agrupadas por scope. */
export type AggregatesByScope = Record<
  string,
  { metrics: Record<string, number>; sampleSize: number }
>;

/**
 * Extrae las metricas conocidas del deporte desde cualquier scope disponible.
 * Solo devuelve datos que existen en la base; lo ausente se omite.
 */
export function pickMetrics(
  aggregates: AggregatesByScope,
  metricKeys: string[],
): Record<string, number | string> {
  const result: Record<string, number | string> = {};

  for (const [scope, entry] of Object.entries(aggregates)) {
    for (const key of metricKeys) {
      const value = entry.metrics[key];
      if (value !== undefined && result[key] === undefined) {
        result[key] = value;
        result[`${key}_sample_size`] = entry.sampleSize;
        result[`${key}_scope`] = scope;
      }
    }
  }

  return result;
}
