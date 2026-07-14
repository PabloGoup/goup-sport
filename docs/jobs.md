# Jobs

## ai:enrich-events (semanal)

Enriquece eventos pendientes con analisis generativo via Groq. Detalle funcional en `docs/ai-enrichment.md`.

### Entradas

- CLI: `npm run ai:enrich-events` con flags `--dry-run`, `--event-id=`, `--limit=`, `--retry-failed`, `--force`.
- HTTP: `POST /api/internal/jobs/enrich-events` con header `Authorization: Bearer $CRON_SECRET`.
  - `401` sin secreto o con secreto invalido (comparacion timing-safe).
  - `503` si `GROQ_ENRICHMENT_ENABLED` no es `true`.
  - `200` con el resumen del job.

### Resumen devuelto

```json
{
  "jobId": "…",
  "startedAt": "…",
  "finishedAt": "…",
  "selected": 300,
  "completed": 286,
  "failed": 8,
  "skipped": 6,
  "requests": 20,
  "promptTokens": 0,
  "completionTokens": 0,
  "totalTokens": 0,
  "dryRun": false,
  "batches": 20
}
```

Cada corrida queda ademas persistida en la tabla `EnrichmentJobRun`.

## Programacion semanal

El nucleo (`runEnrichmentJob`) no esta acoplado a ningun proveedor de cron. Opciones:

### Recomendada: GitHub Actions

```yaml
# .github/workflows/ai-enrich-events.yml
name: ai-enrich-events
on:
  schedule:
    - cron: "0 9 * * 1"   # lunes 09:00 UTC
  workflow_dispatch: {}
jobs:
  enrich:
    runs-on: ubuntu-latest
    steps:
      - name: Invocar job semanal
        run: |
          curl --fail -X POST "$APP_URL/api/internal/jobs/enrich-events" \
            -H "Authorization: Bearer $CRON_SECRET"
        env:
          APP_URL: ${{ secrets.APP_URL }}
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
```

### Alternativa: Vercel Cron (si la app se despliega en Vercel)

```json
// vercel.json
{
  "crons": [{ "path": "/api/internal/jobs/enrich-events", "schedule": "0 9 * * 1" }]
}
```

Vercel Cron invoca por GET sin header propio; si se usa esta via, configurar `CRON_SECRET` y adaptar la verificacion al header `x-vercel-cron`, o preferir GitHub Actions. Considerar tambien el limite de duracion de funciones del plan (el endpoint declara `maxDuration = 300`).

Tambien es compatible con Supabase Cron o AWS EventBridge apuntando al mismo endpoint con el mismo header.

## Otros jobs existentes

Los scripts de ingesta (`npm run ingest:*`) siguen siendo manuales. El job de enriquecimiento asume que la ingesta ya corrio; si se desea encadenar, ejecutar primero la ingesta y despues `ai:enrich-events`.

### Basketball: detalle selectivo de partidos

`npm run ingest:api-sports:basketball` guarda el calendario y marcador base. Para nutrir partidos con estadisticas de equipo y jugadores existe un ingestor selectivo:

```bash
npm run ingest:api-sports:basketball -- --dry-run --from=2026-07-14 --days=7
npm run ingest:api-sports:basketball -- --from=2026-07-14 --days=7
npm run ingest:api-sports:basketball:detail -- --dry-run
npm run ingest:api-sports:basketball:detail -- --limit=1
npm run ingest:api-sports:basketball:detail -- --game=NUMERIC_API_SPORTS_GAME_ID
```

Reglas operativas:

- La ingesta semanal de calendario consume 1 request por dia. `--days` acepta 1 a 7 para no superar una ventana controlada del plan free.
- Para uso diario, ejecutar `npm run ingest:api-sports:basketball -- --date=YYYY-MM-DD`.
- Por defecto selecciona partidos `live` y `completed` almacenados en la base.
- Por defecto usa `--limit=3`.
- Estima las requests antes de ejecutar.
- Con `--include-players=false` solo consulta estadisticas de equipos.
- Con `--force` vuelve a consultar eventos que ya tienen detalle guardado.
- Cada partido consume 1 request para estadisticas de equipos y 1 request adicional si se incluyen jugadores.

Los datos crudos se guardan en `Event.rawPayload.apiSportsBasketballDetails`. Las metricas numericas de equipo tambien se normalizan en `TeamMatchMetric` para alimentar pantallas, comparaciones y enriquecimiento IA sin depender de llamadas en tiempo real.

### Football: cobertura sudamericana cacheada

`npm run cache:api-football:coverage` usa `data/api-football-coverage.json` para consultar solo ligas prioritarias de API-Football y persistir fixtures en Postgres. Esta capa cubre los huecos que no resuelven StatsBomb/OpenFootball, especialmente Sudamerica.

Uso seguro:

```bash
npm run cache:api-football:coverage -- --dry-run
npm run cache:api-football:coverage -- --dry-run --priority=1
npm run cache:api-football:coverage -- --dry-run --only=chile-primera-division,conmebol-libertadores
```

Ejecucion real:

```bash
npm run cache:api-football:coverage -- --priority=1
npm run cache:api-football:coverage -- --from=2026-07-14 --days=7 --priority=1
```

Reglas operativas:

- Por defecto usa ventana de 7 dias.
- `--days` esta limitado por el manifiesto a 7 dias.
- Cada liga ejecutada consume 1 request de API-Football.
- El job salta ligas cacheadas dentro de `--ttl-hours=24` salvo que se use `--force`.
- `--priority=1` cubre Libertadores, Sudamericana, Brasil, Argentina y Chile.
- `--priority=2` agrega Colombia y Uruguay.
- Siempre ejecutar `--dry-run` antes de una corrida real para confirmar requests planificadas.
