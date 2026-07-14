# Variables de Entorno

Plantilla completa en `.env.example`. Valores reales en `.env.local` (nunca commiteado).

## Base

| Variable | Requerida | Descripcion |
|---|---|---|
| `DATABASE_URL` | Si | Conexion PostgreSQL (Prisma). |
| `API_SPORTS_KEY` | Para ingesta | Clave API-Sports, solo server-side. |
| `API_SPORTS_FOOTBALL_BASE_URL` | No | Default `https://v3.football.api-sports.io`. |
| `API_SPORTS_BASKETBALL_BASE_URL` | No | Default `https://v1.basketball.api-sports.io`. |

## Enriquecimiento IA (Groq)

Validadas en `src/infrastructure/ai/groq/groq-config.ts`. Si `GROQ_ENRICHMENT_ENABLED=true` y falta `GROQ_API_KEY`, la aplicacion falla al iniciar el job con un mensaje claro.

| Variable | Default | Descripcion |
|---|---|---|
| `GROQ_API_KEY` | — | Clave de Groq. Solo backend. Nunca usar `NEXT_PUBLIC_GROQ_API_KEY`. |
| `GROQ_BASE_URL` | `https://api.groq.com/openai/v1` | Endpoint OpenAI-compatible de Groq. |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Modelo a usar; cambiable sin tocar codigo. |
| `GROQ_ENRICHMENT_ENABLED` | `false` | Interruptor global. En `false` solo funciona `--dry-run`. |
| `GROQ_BATCH_SIZE` | `15` | Eventos por peticion a Groq (1–50). |
| `GROQ_MAX_RETRIES` | `3` | Reintentos para 429/5xx/timeout. |
| `GROQ_REQUEST_TIMEOUT_MS` | `60000` | Timeout por peticion. |
| `GROQ_MAX_CONCURRENCY` | `1` | Lotes en paralelo (1–8). |
| `GROQ_PROMPT_VERSION` | `event-analysis-v1` | Version del prompt; subirla invalida hashes y regenera. |
| `AI_ENRICHMENT_WINDOW_DAYS` | `14` | Ventana de eventos futuros a analizar (1–90). |
| `CRON_SECRET` | — | Secreto Bearer del endpoint interno de jobs. Sin el, el endpoint rechaza todo. |

## Reglas de seguridad

- Ninguna clave puede usar prefijo `NEXT_PUBLIC_`: eso la incluiria en el bundle del navegador.
- Los modulos que leen `GROQ_API_KEY` viven en `src/infrastructure/` y `src/application/` y solo se importan desde route handlers, server components y scripts; nunca desde componentes cliente.
- Verificacion rapida tras un build: `grep -r "GROQ_API_KEY" .next/static/` no debe devolver resultados.
