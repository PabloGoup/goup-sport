# Schema del Analisis de Eventos

## Persistencia

Tabla `EventAnalysis` (ver `prisma/schema.prisma`). Claves:

- `@@unique([eventId, inputHash, promptVersion])`: garantia de idempotencia.
- `status: AnalysisStatus` (`PENDING | PROCESSING | COMPLETED | FAILED | STALE | SKIPPED`).
- `analysisType: AnalysisType` (`STATISTICAL | EXPERIMENTAL_AI | HYBRID`). Mientras no exista modelo predictivo propio validado, Groq produce `EXPERIMENTAL_AI`.
- Secciones de contenido en Json: `predictedOutcome`, `possibleResults`, `observations`, `strengths`, `weaknesses`, `uncertainties`, `keyFactors`, `playerInsights`, `visualScores`, `modelLimitations`.
- Trazabilidad: `provider`, `modelName`, `promptVersion`, `featureVersion`, `predictionVersion`, `inputHash`, `inputSnapshot`, `rawResponse`, tokens y latencia.

## DTO de entrada (`EventAnalysisInput`)

Definido en `src/domain/ai-enrichment/types.ts`. Resumen compacto construido por el feature builder desde PostgreSQL — nunca tablas completas:

- `eventId`, `sport`, `competition`, `startsAt`, `venue`.
- `participantA` / `participantB`: forma reciente, agregados por scope (`seasonStats`), metricas por deporte (`sportSpecific`).
- `statisticalPrediction`: resultado del motor predictivo propio si existe (tabla `Prediction`).
- `dataAvailability`: secciones disponibles y ausentes + nota de calidad. Es la base anti-alucinacion: el modelo debe declarar lo ausente, no completarlo.
- `meta.featureVersion` y `meta.predictionVersion`: participan del hash.

Metricas por deporte (solo si existen en la base): futbol (xG, tiros, posesion, pases, presiones...), basquetbol (ratings ofensivo/defensivo, ritmo, rebotes...), tenis (ranking, Elo por superficie, hold/break...). Ver `feature-builder-{football,basketball,tennis}.ts`.

## JSON de salida

La respuesta raiz de Groq es `{ "analyses": [...] }`. El contrato completo esta en `src/domain/ai-enrichment/output-schema.ts` (Zod, fuente unica de verdad). Reglas principales:

- `eventId` debe coincidir exactamente con un evento del lote; sin IDs extra ni duplicados.
- Probabilidades en [0,1]; resultados mutuamente excluyentes deben sumar ~1 (tolerancia 0.08).
- Puntuaciones visuales en [0,100].
- `confidence` no puede superar `dataQualityScore` (+0.15 de margen).
- Objetos `strict`: propiedades desconocidas invalidan la respuesta.
- Longitudes maximas por campo y arrays acotados (<= 12 items).
- Textos en espanol; prohibido mencionar apuestas, cuotas o certezas ("seguro", "garantizado").

Una respuesta que no valida no se guarda jamas; se reintenta con prompt de correccion y luego se divide el lote.

## API publica

`GET /api/v1/events/{eventId}/analysis` responde el DTO publico (`PublicEventAnalysis`):

```json
{
  "eventId": "...",
  "status": "COMPLETED",
  "analysisType": "EXPERIMENTAL_AI",
  "generatedAt": "...",
  "modelName": "...",
  "promptVersion": "event-analysis-v1",
  "confidence": 0.4,
  "dataQualityScore": 0.5,
  "headline": "...",
  "shortSummary": "...",
  "detailedSummary": "...",
  "predictedOutcome": {},
  "possibleResults": [],
  "observations": [],
  "strengths": {},
  "weaknesses": {},
  "uncertainties": [],
  "keyFactors": [],
  "playerInsights": [],
  "visualScores": {},
  "modelLimitations": []
}
```

Nunca se exponen: `rawResponse`, `inputSnapshot`, errores internos, API keys ni detalles del proveedor.

`GET /api/v1/events/{eventId}/analysis/history` devuelve los analisis `COMPLETED`/`STALE` mas recientes (max 20) para auditar evolucion.

## Mapeo a la UI

Componentes en `src/components/sports-shell/ai-analysis.tsx`, consumidos por `src/app/eventos/[id]/page.tsx`:

| Componente | Campos |
|---|---|
| `AIExplanation` | headline, shortSummary, detailedSummary, predictedOutcome, confidence |
| `PossibleResultsPanel` | possibleResults |
| `AIPredictionFactors` | keyFactors |
| `StrengthsWeaknesses` | strengths, weaknesses |
| `AIObservations` | observations |
| `PlayerInsights` | playerInsights |
| `TeamVisualScore` | visualScores |
| `UncertaintyPanel` | uncertainties, modelLimitations |
| `AIStatusNotice` | estados PENDING/PROCESSING/FAILED/SKIPPED/STALE/inexistente |

La seccion IA nunca bloquea la pagina: si no hay analisis se muestra un aviso de estado. Todo texto del modelo se renderiza escapado (React); nunca se usa `dangerouslySetInnerHTML`.
