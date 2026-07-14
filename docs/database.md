# Base De Datos Local

GOUP SPORT usa Prisma con PostgreSQL. Para desarrollo local, el proyecto queda preparado con una base `goup_sport` en `localhost:5433`.

## Opcion Recomendada: Docker Desktop

1. Instalar y abrir Docker Desktop para macOS.
2. Levantar Postgres:

```bash
npm run db:up
```

3. Sincronizar Prisma:

```bash
set -a; source .env.local; set +a; npm run db:push
```

4. Cargar datos demo:

```bash
set -a; source .env.local; set +a; npm run db:seed
```

5. Ingerir una consulta real de API-Sports y guardarla en BD:

```bash
set -a; source .env.local; set +a; npm run ingest:api-sports -- --date=2026-07-13
```

## Alternativa: PostgreSQL Por Homebrew

Si no quieres usar Docker:

```bash
brew install postgresql@16
brew services start postgresql@16
createdb goup_sport
```

Luego ajusta `.env.local` a tu puerto local de PostgreSQL. Si usas el puerto por defecto de Homebrew:

```env
DATABASE_URL="postgresql://TU_USUARIO_MAC@localhost:5432/goup_sport?schema=public"
```

Despues ejecuta:

```bash
set -a; source .env.local; set +a; npm run db:push
set -a; source .env.local; set +a; npm run db:seed
```

## URL Local Actual Del Proyecto

El `.env.local` del proyecto apunta a:

```env
DATABASE_URL="postgresql://goup_sport:goup_sport_dev@localhost:5433/goup_sport?schema=public"
```

Esa URL corresponde al `docker-compose.yml` incluido en el repo.

## Politica De Requests API-Sports

El script `ingest:api-sports` valida la conexion a la base antes de llamar API-Sports. Si la BD no responde, falla antes de consumir cuota.

Reglas operativas:

- No llamar API-Sports desde componentes de frontend.
- No consultar el proveedor en cada render de home, eventos o detalle.
- Toda consulta aprobada debe guardarse en Postgres con `DataSource`, `rawPayload`, fecha de recoleccion y version de normalizador.
- Reusar siempre los datos almacenados antes de hacer una nueva consulta.
- Proteger especialmente endpoints detallados como `fixtures/statistics`, `fixtures/players`, `players`, `players/squads` y `teams/statistics`.
- Si una competicion no entrega estadisticas de jugadores o equipos, guardar el estado de cobertura y mostrarlo en UI como dato no disponible.

## Fuentes Complementarias

StatsBomb Open Data puede alimentar la base sin consumir cuota diaria de API-Sports.

Rol dentro del producto:

- Complemento historico y analitico de futbol.
- Fuente para features, formulas GOUP Score, backtesting y prototipos.
- No reemplaza API-Football como fuente operacional principal de fixtures actuales.

Uso recomendado:

- Cargar datasets historicos para investigacion y prototipos.
- Calcular features propias de futbol.
- Entrenar o validar formulas GOUP Score.
- Enriquecer pantallas de analisis cuando el uso sea compatible con la licencia del dataset.

### Estrategia De Cobertura Futbol

GOUP SPORT no debe depender de una unica fuente para futbol. La estrategia vigente queda documentada en `data/football-coverage-plan.json`:

- **StatsBomb Open Data**: profundidad historica, eventos, xG, features y backtesting cuando la competicion existe en el catalogo abierto.
- **OpenFootball**: amplitud de calendario/resultados para ligas y competiciones verificadas.
- **API-Football**: cache operacional para huecos actuales, ligas sudamericanas y competiciones donde no exista fuente abierta suficiente.
- **Calendar files manuales**: fallback temporal para fixtures criticos mientras se valida una fuente autorizada.

Cobertura OpenFootball importada actualmente:

- Premier League 2025/26.
- La Liga 2025/26.
- Bundesliga 2025/26.
- Serie A 2025/26.
- Champions League 2025/26.
- World Cup 2026.

Sudamerica requiere fuente complementaria: StatsBomb solo cubre parcialmente Copa America 2024 y algunas temporadas historicas de Argentina. Para Libertadores, Sudamericana, Brasil, Chile, Colombia y Uruguay se debe usar API-Football cacheado, dataset autorizado o archivo calendario trazable.

Antes de integrarlo en producto comercial se debe validar:

- Licencia.
- Atribucion requerida.
- Alcance de uso permitido.
- Version del dataset.
- Trazabilidad por competicion, temporada y partido.

## Roadmap De Fuentes

Fase 1:

- API-Football.
- StatsBomb Open Data.

Fase 2:

- API-Basketball o API-NBA.

Comando preparado:

```bash
npm run ingest:api-sports:basketball -- --date=2026-07-13
```

Fase 3:

- Jeff Sackmann para datasets abiertos de tenis.
- Tennis Abstract, sujeto a validacion de condiciones de uso.

Comandos preparados:

```bash
git clone https://github.com/JeffSackmann/tennis_atp.git data-providers/tennis_atp
npm run ingest:tennis:jeff-sackmann -- --tour=atp --year=2025 --limit=100
```

Tenis no debe depender de API-Sports en esta fase. La estrategia sera construir un Tennis Collector propio que use fuentes autorizadas y datasets abiertos.

Fuentes objetivo:

- ATP Tour como referencia para calendario, torneos, cuadros, resultados y rankings, sujeto a condiciones de uso.
- WTA Tour como referencia para calendario, resultados y rankings, sujeto a condiciones de uso.
- Jeff Sackmann como dataset abierto principal para ATP, WTA, Challenger, ITF, rankings historicos y resultados.
- Tennis Abstract como fuente a evaluar, sujeto a condiciones de uso.

Responsabilidades del Tennis Collector:

- Importar resultados historicos de Jeff Sackmann.
- Importar rankings historicos cuando se agregue el parser correspondiente.
- Detectar nuevos torneos y actualizar solo cambios.
- Normalizar calendario, torneo, ronda, superficie, jugadores y resultado al modelo interno.
- Mantener el frontend desacoplado de consultas en tiempo real a sitios externos.

Los eventos visibles en home y centro de eventos deben proyectarse como maximo a 7 dias.
