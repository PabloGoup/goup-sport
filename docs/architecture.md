# GOUP SPORT - Arquitectura Tecnica

## Principio Arquitectonico

GOUP SPORT debe construirse como una plataforma, no como un frontend aislado.

El frontend es un cliente. El backend, los datos, los modelos y la API son el producto real.

La arquitectura debe permitir:

- Soportar multiples deportes.
- Agregar proveedores de datos.
- Normalizar informacion heterogenea.
- Almacenar historicos.
- Ejecutar modelos predictivos versionados.
- Explicar resultados mediante IA.
- Exponer todo mediante una API versionada.
- Crear dashboards especializados sobre la misma base.

## Capas

La plataforma debe separar responsabilidades en estas capas:

1. Presentacion.
   - Next.js App Router.
   - Componentes visuales.
   - Navegacion mobile-first.
   - Cliente web de la API.

2. Aplicacion.
   - Casos de uso.
   - Orquestacion de consultas.
   - Validacion de filtros.
   - Adaptacion de datos para vistas y API.

3. Dominio.
   - Entidades deportivas.
   - Reglas de negocio.
   - Contratos de eventos, participantes, modelos y predicciones.
   - Logica multideporte.

4. Infraestructura.
   - Base de datos.
   - Repositorios.
   - Proveedores externos.
   - Jobs y collectors.
   - Cache.
   - Observabilidad.

5. Machine Learning.
   - Feature engineering.
   - Modelos predictivos.
   - Ensemble model.
   - Backtesting.
   - Metricas de precision.
   - Versionado.

6. IA Explicativa.
   - Traduccion de resultados del modelo a lenguaje humano.
   - Explicaciones.
   - Salvedades.
   - Resumen de factores.

## Pipeline De Datos

El flujo objetivo es:

Proveedor de datos

-> Collectors

-> Normalizadores

-> Base historica

-> Feature engineering

-> Modelos predictivos

-> Motor IA explicativo

-> API

-> Frontend

-> Aplicaciones futuras

## Proveedores Externos

## Roadmap De Datos

La estrategia de datos se implementara por fases para evitar acoplar el producto a un proveedor unico.

### Fase 1

- API-Football como fuente operacional principal para futbol.
- StatsBomb Open Data como fuente complementaria historica y analitica.

Objetivo:

- Nutrir eventos, equipos, competiciones y estadisticas disponibles de futbol.
- Construir dataset historico para feature engineering y validacion de modelos.
- Calcular primeras metricas GOUP sin depender de datos inventados.

### Fase 2

- API-Basketball o API-NBA como fuente operacional para basketball.

Objetivo:

- Incorporar juegos, equipos, jugadores y estadisticas reales de basketball.
- Crear features y scores especificos del deporte.

### Fase 3

- Datasets abiertos de tenis, inicialmente Jeff Sackmann y Tennis Abstract.

Objetivo:

- Incorporar partidos, jugadores, rankings y estadisticas historicas de tenis.
- Mantener tenis como modulo soportado sin forzar una integracion no validada con API-Sports.

Regla general:

- Las fuentes operacionales alimentan eventos actuales y actualizables.
- Los datasets abiertos alimentan historico, entrenamiento, backtesting y metricas complementarias.
- Ninguna pantalla debe mezclar fuentes sin mostrar trazabilidad interna suficiente en `DataSource`.

### API-Sports

API-Sports queda integrado como primer proveedor externo de datos deportivos.

Integracion inicial:

- Deporte: futbol.
- Base URL: `https://v3.football.api-sports.io`.
- Autenticacion server-side con header `x-apisports-key`.
- Variable requerida: `API_SPORTS_KEY`.
- Variable opcional: `API_SPORTS_FOOTBALL_BASE_URL`.
- Endpoint interno de preview: `GET /api/v1/providers/api-sports/football/fixtures`.

Filtros soportados por el endpoint interno:

- `date` en formato `YYYY-MM-DD`.
- `league`.
- `season`.
- `team`.
- `next`.
- `live`.

Endpoints de datos base que deben considerarse para siguientes ciclos:

- `fixtures`: calendario, estado, equipos, liga, venue y marcador.
- `fixtures/statistics`: estadisticas del equipo dentro de un partido.
- `fixtures/events`: eventos del partido.
- `fixtures/players`: estadisticas de jugadores dentro de un partido, cuando exista cobertura.
- `players`: estadisticas acumuladas por jugador, liga, equipo y temporada.
- `players/squads`: planteles.
- `teams/statistics`: estadisticas acumuladas por equipo, liga y temporada.

Reglas:

- Nunca exponer `API_SPORTS_KEY` en cliente.
- No llamar al proveedor automaticamente desde la home para no consumir cuota.
- Normalizar toda respuesta externa antes de usarla en la app.
- Guardar siempre fuente, fecha de recoleccion y version del normalizador.
- Ignorar endpoints de odds/apuestas para mantener el foco en Sports Intelligence.
- Tratar la cobertura avanzada como variable: no todas las ligas entregan estadisticas de jugadores, alineaciones o metricas con la misma profundidad.
- Las metricas GOUP deben derivarse de datos almacenados y trazables, no de llamadas en vivo desde el frontend.

### API-Basketball / API-NBA

Basketball debe integrarse como proveedor externo separado del cliente de futbol.

Uso esperado:

- Juegos, equipos, ligas y temporadas.
- Estadisticas por equipo y partido.
- Estadisticas por jugador y partido.
- Estadisticas de jugador por temporada, cuando el plan y la cobertura lo permitan.

La normalizacion debe mapear los datos a las mismas entidades base de GOUP SPORT, pero con features especificas de basketball:

- Puntos proyectados.
- Ritmo.
- Offensive Rating.
- Defensive Rating.
- Eficiencia de tiro.
- Rebotes.
- Asistencias.
- Perdidas.
- Clutch, cuando exista base suficiente.

### StatsBomb Open Data

StatsBomb Open Data es una fuente complementaria para futbol. No reemplaza API-Football como feed operacional de eventos actuales.

Uso recomendado:

- Dataset historico para investigacion, prototipos y feature engineering.
- Validacion de modelos GOUP con eventos detallados.
- Construccion de metricas avanzadas propias cuando el dataset tenga la granularidad necesaria.
- Backtesting de predicciones y formulas GOUP Score.

Restricciones:

- No reemplaza automaticamente al feed operativo de fixtures actuales.
- Deben revisarse licencia, atribucion y alcance de uso antes de usarlo en funcionalidades comerciales.
- Debe importarse mediante collector propio, guardando source, version de dataset y fecha de ingesta.

### Tenis

Tenis se mantiene como deporte objetivo del producto, pero no debe depender de API-Sports en esta etapa.

La estrategia sera un Tennis Collector propio.

Fuentes:

- ATP Tour como referencia para calendario, torneos, cuadros, resultados y rankings, sujeto a condiciones de uso.
- WTA Tour como referencia para calendario, torneos, resultados y rankings, sujeto a condiciones de uso.
- Jeff Sackmann como dataset abierto principal para ATP, WTA, Challenger, ITF, rankings historicos y resultados.
- Tennis Abstract como fuente a evaluar, sujeto a condiciones de uso.

Responsabilidades del collector:

- Descargar o leer fuentes autorizadas cuando exista archivo/feed permitido.
- Importar historico de Jeff Sackmann de forma idempotente.
- Detectar torneos nuevos y actualizar solo cambios.
- Normalizar torneo, ronda, superficie, fecha, jugadores, rankings y resultado al modelo GOUP.
- Mantener el frontend desacoplado de llamadas en tiempo real a sitios externos.

Reglas:

- No hacer scraping productivo sin revisar condiciones de uso.
- No inventar calendario ni ranking cuando no exista fuente.
- Guardar siempre `DataSource`, version del collector y raw payload o referencia de archivo.

## Persistencia

La persistencia objetivo sera Prisma + Postgres.

Postgres debe almacenar:

- Deportes.
- Competiciones.
- Equipos.
- Jugadores.
- Eventos.
- Fuentes de datos.
- Versiones de normalizadores.
- Features.
- Versiones de modelos.
- Predicciones.
- Factores.
- Salvedades.
- Noticias.
- Historial de cambios.

Los datos mock actuales son temporales y deben migrarse a seed idempotente cuando se implemente persistencia real.

## API

La API sera un producto independiente.

Debe ser:

- Versionada.
- Documentada.
- Autenticable.
- Preparada para rate limiting.
- Preparada para planes freemium, premium y enterprise.

La propia web debe consumir la misma logica que la API.

API v1 actual:

- `GET /api/v1/events`
- `GET /api/v1/events/[id]`
- `GET /api/v1/predictions`
- `GET /api/v1/predictions/[eventId]`
- `GET /api/v1/search?q=...`
- `GET /api/v1/providers/api-sports/football/fixtures`

Filtros actuales:

- `sport`
- `status`
- `sort`
- `minConfidence`

Errores actuales:

- `400 invalid_filter`
- `404 event_not_found`
- `404 prediction_not_found`

## Multideporte

El sistema inicial soporta:

- Futbol.
- Basketball.
- Tenis.

La arquitectura debe permitir nuevos deportes sin modificar el nucleo.

Para lograrlo:

- Las entidades base deben ser genericas.
- Las features especificas deben vivir por deporte.
- Los modelos deben versionarse por deporte.
- Los normalizadores deben estar desacoplados por proveedor.

## Modelos Matematicos E IA

Los modelos matematicos generan probabilidades, scores y niveles de confianza.

La IA explicativa no debe calcular probabilidades. Su rol es explicar los resultados generados por modelos matematicos.

Cada prediccion debe guardar:

- Fecha.
- Version.
- Modelo utilizado.
- Confianza.
- Probabilidad.
- Factores.
- Salvedades.
- Fuente.

## Trazabilidad

Cada dato debe poder responder:

- De donde viene.
- Cuando se obtuvo.
- Como fue normalizado.
- Que version del modelo lo uso.
- Que prediccion genero.
- Como evoluciono la prediccion en el tiempo.

## Fronteras Actuales Del Codigo

Estado actual:

- `src/domain/sports-intelligence`: contratos, datos demo y servicios de lectura.
- `src/components/sports-shell`: componentes visuales compartidos.
- `src/app`: rutas de frontend y API routes.

La base de Prisma + Postgres queda preparada mediante `prisma/schema.prisma`, `.env.example` y seed idempotente. La siguiente fase tecnica es migrar servicios de lectura a repositorios persistentes sin cambiar contratos publicos de UI/API.
