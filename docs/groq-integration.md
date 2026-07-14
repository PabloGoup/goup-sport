# Integracion con Groq

## Ubicacion

`src/infrastructure/ai/groq/`:

- `groq-config.ts`: lectura y validacion de variables de entorno. La app falla con mensaje claro si `GROQ_ENRICHMENT_ENABLED=true` sin `GROQ_API_KEY`.
- `groq-errors.ts`: taxonomia de errores (400/401/403/404/413/422/429/5xx/timeout) y parseo de `Retry-After`.
- `groq-client.ts`: cliente centralizado sobre el SDK oficial `groq-sdk`.
- `groq-provider.ts`: implementacion de la interfaz `AiEnrichmentProvider`.
- `groq-types.ts`: tipos de peticion/respuesta del cliente.

## Interfaz de proveedor

```ts
interface AiEnrichmentProvider {
  readonly name: string;
  analyzeEvents(events: EventAnalysisInput[]): Promise<ProviderBatchResult>;
}
```

Definida en `src/domain/ai-enrichment/types.ts`. Groq es una implementacion; sustituirlo por otro proveedor no toca dominio ni aplicacion (solo inyectar otra implementacion en `runEnrichmentJob`).

## Comportamiento del cliente

- Autenticacion server-side con `GROQ_API_KEY`; la clave nunca llega al navegador ni a los logs.
- Modelo configurable via `GROQ_MODEL` sin tocar codigo. Recomendado: `llama-3.3-70b-versatile`.
- Timeout por peticion: `GROQ_REQUEST_TIMEOUT_MS` (default 60s).
- Reintentos: backoff exponencial con jitter (1s, 2s, 4s...) solo para 429, 5xx y timeout, hasta `GROQ_MAX_RETRIES`. Respeta el header `Retry-After` cuando existe. 400/401/403/404/413/422 son fatales; 401/403 abortan el job completo.
- Concurrencia entre lotes limitada por `GROQ_MAX_CONCURRENCY` (default 1).
- Registra por peticion: modelo, tokens y latencia. No registra la API key ni el prompt completo.

## Structured Outputs

El cliente intenta primero `response_format: { type: "json_schema" }` con el JSON Schema derivado del schema Zod (`buildBatchResponseJsonSchema()`). Si el modelo configurado no lo soporta (Groq responde 400 mencionando `response_format`), degrada automaticamente a `{ type: "json_object" }` y lo recuerda para el resto del proceso. En ambos modos la validacion Zod corre siempre en nuestro lado; una respuesta que no valida nunca se guarda.

Importante: `llama-3.3-70b-versatile` (modelo por defecto) NO soporta `json_schema`, asi que en la practica corre en modo `json_object`. Por eso el JSON Schema y las reglas numericas (por ejemplo `confidence <= dataQualityScore`) tambien se incluyen en el texto del prompt (`buildBatchUserPrompt`): en `json_object` la API no impone estructura, y sin el schema en el prompt el modelo inventa nombres de campos. Si se cambia a un modelo con soporte nativo de `json_schema`, el mismo codigo lo usa sin cambios.

## Base URL

El SDK de Groq ya agrega la ruta `/openai/v1` a cada endpoint. Como `GROQ_BASE_URL` sigue la convencion estilo OpenAI (`https://api.groq.com/openai/v1`), el cliente normaliza ese valor (`normalizeGroqBaseUrl`) quitando el sufijo antes de pasarlo al SDK; de lo contrario la ruta se duplicaria (`/openai/v1/openai/v1/chat/completions`, error 404 `unknown_url`).

## Cambio de modelo

1. Editar `GROQ_MODEL` en el entorno.
2. Si el analisis debe regenerarse con el nuevo modelo, subir `GROQ_PROMPT_VERSION` (por ejemplo `event-analysis-v2`): el cambio de version invalida los hashes y dispara regeneracion controlada.

## Limites conocidos

- El tier gratuito de Groq impone limites de peticiones y tokens por minuto/dia: por eso el job usa lotes (`GROQ_BATCH_SIZE`) y concurrencia 1 por defecto.
- Los lotes rechazados por tamano (413) o con respuesta invalida se subdividen automaticamente hasta procesar eventos individuales.
- No todos los modelos de Groq soportan `json_schema`; el fallback a `json_object` cubre el resto.

## Pruebas

Groq esta siempre mockeado en `tests/` (cliente falso inyectado en el provider). Las pruebas no consumen la API real.
