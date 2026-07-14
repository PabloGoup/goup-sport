# Mantenimiento y enriquecimiento de datos

Cómo GOUP SPORT mantiene su base actualizada y la va nutriendo en el tiempo, separando lo que es **gratis y automático** de lo que requiere **presupuesto de datos**.

## Principio: capas por cadencia y por costo

No todos los datos se consiguen igual. La estrategia es en capas: lo barato y frecuente corre solo; lo caro se decide como negocio.

```
Calendario + marcador + goles   → GRATIS, diario (TheSportsDB)          → alimenta el modelo
Tiros/córners/tarjetas (Europa) → GRATIS, semanal (Football-Data.co.uk) → alimenta Nivel B
Histórico 2022-2024 cualquier   → GRATIS, puntual (API-Football, cuota) → bootstrap por liga
Evento a evento (xG, pases)     → GRATIS, competiciones selectas (StatsBomb)
Detalle actual ligas menores    → DE PAGO (API-Football Pro, Opta, Sofascore)
```

## Qué dato viene de dónde (por lo que pediste)

| Dato | ¿Gratis y actualizable? | Fuente |
|---|---|---|
| **Goles / marcador** | ✅ Diario, todas las ligas | TheSportsDB |
| **Goleadores + minuto** | 🟡 Solo donde el dataset lo trae | OpenFootball, StatsBomb |
| **Tiros / remates al arco** | 🟡 Solo ligas europeas | Football-Data.co.uk (semanal) |
| **Córners** | 🟡 Solo ligas europeas | Football-Data.co.uk |
| **Tarjetas / faltas** | 🟡 Solo ligas europeas | Football-Data.co.uk |
| **Cambios (sustituciones)** | ❌ No gratis para ligas actuales | API-Football (2022-24) / StatsBomb / pago |
| **Posesión / pases** | 🟡 2022-24 (cuota) o StatsBomb | API-Football / StatsBomb |

**Traducción honesta:** los **goles** se mantienen frescos gratis en todas las ligas (y con eso el modelo predice). Los **detalles de partido** (tiros, córners, tarjetas) se mantienen frescos gratis **solo en ligas europeas**. Para el detalle actual de ligas sudamericanas/menores hace falta un plan de pago.

## El ciclo automático (lo que corre solo)

### Diario — `.github/workflows/data-refresh.yml`
1. `ingest:thesportsdb` → nuevos fixtures + resultados recientes (goles).
2. `ai:enrich-events` → regenera análisis IA solo de lo nuevo o cambiado (idempotente).

Efecto: cada partido jugado entra al día siguiente, las fuerzas de los equipos se recalculan y las predicciones se refrescan. **El sistema se auto-mejora**: más partidos completados = mejor modelo + más eventos pasan a ser predecibles.

### Semanal — `.github/workflows/stats-refresh.yml`
1. `ingest:football-data` → re-descarga los CSV europeos (tiros/córners/tarjetas de la temporada en curso).
2. `ingest:thesportsdb:basketball` → refresca ligas de básquet.

Football-Data.co.uk actualiza sus CSV varias veces por semana; una pasada semanal mantiene el Nivel B europeo al día.

## Por qué no se duplica ni se corrompe

- Todo ingestor hace **upsert idempotente** por id estable → re-correr actualiza lo cambiado sin duplicar.
- La tabla `DataSource` guarda **proveedor + versión de normalizador + fecha** de cada dato → trazabilidad total. Si una fuente resulta dudosa, se identifica y se quita.
- El ciclo de vida del evento (`upcoming → live → completed`) lo maneja el status; al completarse llega el marcador final y alimenta el modelo.

## Bootstrap incremental (nutrir "en el camino")

Cuando aparece una liga nueva en el calendario sin historia:
1. `npm run ingest:api-sports -- --league=<id> --season=2024` → trae su historia 2024 gratis.
2. Si los nombres no calzan entre proveedores, se agrega una línea a `data/team-aliases.json`.
3. La próxima corrida del cron ya predice y enriquece esos eventos.

## Cuándo conviene pagar datos

El límite gratuito es claro: **detalle de partido (tiros/córners/tarjetas/cambios) para ligas actuales fuera de Europa**. Cuando el producto lo exija comercialmente, un plan de API-Football Pro (o Sofascore/Opta) desbloquea eso — es decisión de negocio, no técnica. La arquitectura ya está lista para incorporarlo (solo cambia la fuente en un ingestor).
