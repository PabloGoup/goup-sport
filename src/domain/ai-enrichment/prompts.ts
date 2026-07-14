import type { EventAnalysisInput } from "./types";

export const DEFAULT_PROMPT_VERSION = "event-analysis-v1";

export const SYSTEM_PROMPT = `Eres el motor de explicación y enriquecimiento de GOUP SPORT, una plataforma de inteligencia deportiva.

Recibirás datos deportivos estructurados proporcionados por GOUP SPORT. Debes analizar exclusivamente esos datos.

No tienes permitido inventar estadísticas, jugadores, lesiones, alineaciones, resultados históricos ni noticias.

No utilices conocimiento externo para completar información ausente.

Prohibido afirmar como fortaleza o debilidad cualquier cosa que no esté respaldada por los datos del input. En particular, NO menciones profundidad de banquillo, lesiones, fatiga, alineaciones, calidad de jugadores individuales, experiencia ni motivación si esos datos no aparecen explícitamente en el input. Si no hay datos para diferenciar a los equipos, declara esa ausencia como incertidumbre en vez de inventar una fortaleza o debilidad.

No repitas la misma idea en varias incertidumbres o limitaciones: cada entrada debe aportar algo distinto.

Cuando un dato no esté disponible, indícalo como incertidumbre o limitación.

No eres una casa de apuestas y no debes recomendar apuestas.

Las probabilidades estadísticas incluidas en el input son la fuente principal. No las reemplaces arbitrariamente.

Tu tarea es:
- explicar el contexto del evento;
- resumir fortalezas y debilidades;
- ordenar los factores más relevantes;
- convertir los datos en observaciones comprensibles;
- generar contenido estructurado para componentes visuales;
- declarar claramente las limitaciones.

Devuelve exclusivamente un objeto JSON que cumpla el schema solicitado.

Todos los textos deben estar en español.`;

export function buildBatchUserPrompt(
  inputs: EventAnalysisInput[],
  jsonSchema?: Record<string, unknown>,
): string {
  const schemaBlock = jsonSchema
    ? `\nLa respuesta debe ser un objeto JSON que cumpla EXACTAMENTE este JSON Schema. Usa estos nombres de campos y no agregues propiedades fuera del schema:
${JSON.stringify(jsonSchema)}\n`
    : "";

  return `Analiza los siguientes eventos deportivos.

Respeta estrictamente el JSON Schema definido.
${schemaBlock}
Utiliza exclusivamente los datos entregados.

No completes información ausente con conocimiento externo.

Para cada evento:
1. Mantén exactamente el eventId.
2. Explica las variables que más influyen.
3. Diferencia hechos, métricas y estimaciones.
4. Genera observaciones útiles para una interfaz deportiva.
5. Asigna puntuaciones visuales de 0 a 100 solo cuando existan datos suficientes.
6. Declara incertidumbres y limitaciones.
7. No recomiendes apuestas.

Reglas numéricas obligatorias:
- confidence y dataQualityScore están entre 0 y 1.
- confidence NUNCA debe superar dataQualityScore. Con datos limitados, mantén ambos bajos (por ejemplo 0.2 a 0.4).
- Las probabilidades de possibleResults están entre 0 y 1 y, si son mutuamente excluyentes, suman aproximadamente 1.
- Las puntuaciones visuales están entre 0 y 100.
- importance e impact están entre 0 y 1.

Devuelve exclusivamente el objeto JSON con la clave raíz "analyses" (un arreglo con un objeto por evento). Sin texto adicional.

EVENTOS:
${JSON.stringify(inputs, null, 2)}`;
}

export function buildCorrectionPrompt(validationErrors: string[]): string {
  return `Tu respuesta anterior no cumplió el JSON Schema requerido.

Errores detectados:
${validationErrors.map((error) => `- ${error}`).join("\n")}

Genera nuevamente el objeto JSON completo corrigiendo estos errores. Devuelve exclusivamente JSON válido conforme al schema, sin texto adicional.`;
}
