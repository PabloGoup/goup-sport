# Enriquecimiento IA de Eventos

## Que es

Sistema automatico que enriquece eventos deportivos almacenados en PostgreSQL con analisis generativo producido por Groq. El frontend nunca llama a Groq: consume analisis ya persistidos en la tabla `EventAnalysis`.

Groq no es fuente de datos deportivos. Solo trabaja con el input que GOUP SPORT construye desde su propia base. Cuando faltan datos, el analisis debe declararlo como incertidumbre o limitacion, y mientras no exista un modelo predictivo propio validado todo resultado estimado se marca como `EXPERIMENTAL_AI` (experimental, baja confianza).

## Arquitectura

```
Collectors (scripts/ingest-*)          [existentes, sin cambios]
        v
PostgreSQL (Event, TeamAggregateMetric, Prediction)
        v
Feature Builder            src/application/ai-enrichment/feature-builder*.ts
        v
Event Selector             src/application/ai-enrichment/event-selector.ts
        v
Enrichment Job             src/application/ai-enrichment/enrichment-job.ts
        v
AiEnrichmentProvider       src/domain/ai-enrichment/types.ts (interfaz)
        v
GroqEnrichmentProvider     src/infrastructure/ai/groq/
        v
Validacion (Zod)           src/domain/ai-enrichment/output-schema.ts
        v
EventAnalysis (PostgreSQL)
        v
API v1                     GET /api/v1/events/{id}/analysis (+/history)
        v
Frontend                   src/components/sports-shell/ai-analysis.tsx
```

Capas separadas: el dominio define contratos y prompts; la aplicacion orquesta seleccion, lotes y persistencia; la infraestructura habla con Groq. Nada de Groq vive en componentes React ni en modelos Prisma.

## Flujo semanal

1. `recoverOrphanedProcessing`: filas `PROCESSING` con mas de 30 minutos vuelven a `PENDING`.
2. `selectEventsForAnalysis`: eventos dentro de la ventana (`AI_ENRICHMENT_WINDOW_DAYS`, default 14 dias) que necesitan analisis: sin analisis vigente, `FAILED` con reintentos disponibles, o `inputHash` cambiado (el anterior pasa a `STALE`).
3. Reserva atomica por fila (`PENDING -> PROCESSING`); dos workers no procesan el mismo evento.
4. Eventos sin senal analizable (sin forma reciente ni metricas en ambos participantes) se marcan `SKIPPED` sin llamar a Groq.
5. Lotes de `GROQ_BATCH_SIZE` (default 15) con concurrencia `GROQ_MAX_CONCURRENCY` (default 1).
6. Validacion Zod + reglas de lote (IDs, duplicados, sumas de probabilidad, coherencia confianza/calidad).
7. Persistencia por evento: el fallo de uno no invalida al resto del lote.
8. Resumen del job en `EnrichmentJobRun`.

## Estados

| Estado | Significado |
|---|---|
| PENDING | En cola para el proximo ciclo |
| PROCESSING | Reservado por un worker |
| COMPLETED | Respuesta validada y guardada |
| FAILED | Error de proveedor, validacion o persistencia (reintentable) |
| STALE | El input cambio; ya no es vigente (se conserva como historial) |
| SKIPPED | Datos insuficientes para un analisis confiable |

Los analisis nunca se sobrescriben: cada `inputHash` nuevo crea una fila nueva y el historial queda auditable en `GET /api/v1/events/{id}/analysis/history`.

## Idempotencia

`inputHash = sha256(json canonico del input + promptVersion)`. El input incluye `featureVersion` y `predictionVersion` en `meta`, por lo que cualquier cambio de datos, prompt, feature builder o modelo predictivo invalida el analisis anterior. La restriccion `@@unique([eventId, inputHash, promptVersion])` garantiza en base de datos que el mismo trabajo no se repite: ejecutar el cron dos veces seguidas no genera llamadas nuevas.

## Regeneracion selectiva

`markEventAnalysisStale(prisma, eventId, reason)` (en `event-selector.ts`) marca los `COMPLETED` de un evento como `STALE` registrando el motivo (cambio de fecha, alineacion confirmada, etc.). El proximo ciclo lo regenera. Ademas, cualquier cambio en los datos que alimentan el feature builder cambia el hash y dispara regeneracion automatica en el siguiente ciclo semanal, sin regeneraciones frecuentes fuera de control.

## Ejecucion manual y dry-run

```bash
npm run ai:enrich-events                       # job completo (requiere GROQ_ENRICHMENT_ENABLED=true)
npm run ai:enrich-events -- --dry-run          # seleccion, hashes, lotes y tokens estimados; no llama a Groq ni guarda
npm run ai:enrich-events -- --event-id=<id>    # un evento puntual
npm run ai:enrich-events -- --limit=20         # limita la seleccion
npm run ai:enrich-events -- --retry-failed     # reintenta solo FAILED
npm run ai:enrich-events -- --force            # PELIGROSO: reprocesa analisis existentes y consume tokens
```

`--force` esta pensado solo para depuracion puntual (idealmente combinado con `--event-id`). Documentado aqui para evitar costos accidentales.

## Recuperacion ante fallos

- Errores transitorios (429/5xx/timeout): reintento con backoff exponencial y `Retry-After` (ver `docs/groq-integration.md`).
- Respuesta invalida: reintento con prompt de correccion, luego division del lote hasta procesar eventos individualmente.
- `FAILED` con `attemptCount < 3` vuelve a ser elegible el proximo ciclo; `--retry-failed` fuerza el reintento manual.
- `PROCESSING` huerfano se recupera automaticamente al inicio de cada job.
- El resumen y los errores del job quedan en `EnrichmentJobRun`.

## Monitoreo

Cada fila `EventAnalysis` guarda modelo, tokens, latencia, intentos, `errorCode` y `promptVersion`. Cada corrida guarda totales en `EnrichmentJobRun` (seleccionados, completados, fallidos, omitidos, requests y tokens), suficiente para calcular porcentaje de exito, tokens por evento y costo estimado. Nunca se registran secretos.
