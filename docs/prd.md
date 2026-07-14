# GOUP SPORT - PRD Funcional

## Objetivo Del Producto

Construir una plataforma de inteligencia deportiva que permita explorar eventos, equipos, jugadores, modelos predictivos y comparaciones mediante datos trazables y explicaciones claras.

El producto debe sentirse como una plataforma deportiva premium, no como un dashboard administrativo ni una casa de apuestas.

## Home

La pagina principal debe actuar como centro de descubrimiento.

Debe mostrar:

- Eventos destacados.
- Eventos en vivo.
- Eventos proximos.
- Eventos del dia.
- Competiciones.
- Predicciones destacadas.
- Ranking IA.
- Noticias.
- Comparaciones populares.
- Accesos rapidos a eventos, modelos, API y dashboards.

Reglas:

- Todo bloque principal debe tener accion clara.
- El usuario debe poder navegar sin escribir.
- La informacion critica debe aparecer en el primer viewport.
- Mobile debe priorizar chips horizontales, cards compactas y scroll controlado.

## Pagina De Evento

Cada evento debe funcionar como un centro completo de informacion.

Debe incluir:

- Resumen del evento.
- Participantes.
- Competicion.
- Fecha y estado.
- Prediccion principal.
- Probabilidades.
- Nivel de confianza.
- Explicacion del modelo.
- Factores positivos.
- Factores negativos.
- Nivel de incertidumbre.
- Comparacion entre participantes.
- Historial.
- Forma reciente.
- Jugadores destacados.
- Graficos.
- Noticias relacionadas.
- Fuente de datos.
- Version del modelo.
- Versiones anteriores de la prediccion.

Reglas:

- Toda prediccion debe explicar por que.
- Toda prediccion debe tener version.
- Todo dato debe tener fuente.
- Si no hay prediccion, mostrar un estado claro.
- Si hay incertidumbre alta, debe ser visible.

## Pagina De Equipo

Cada equipo debe tener una ficha propia.

Debe incluir:

- Informacion general.
- Escudo.
- Competicion.
- Ranking.
- Forma reciente.
- Attack Score.
- Defense Score.
- Momentum.
- Squad Depth.
- Plantilla.
- Ultimos partidos.
- Proximos encuentros.
- Comparaciones.
- Historial.
- Graficos.
- Evolucion.
- Noticias.
- Predicciones futuras.

## Pagina De Jugador

Cada jugador debe tener una ficha individual.

Debe incluir:

- Foto.
- Equipo.
- Posicion.
- Edad.
- Nacionalidad.
- Estadisticas.
- Forma reciente.
- Historial.
- Comparaciones.
- Rendimiento reciente.
- Participacion ofensiva.
- Participacion defensiva.
- Predicciones individuales.
- Proyeccion para proximos encuentros.

## Comparadores

La comparacion sera uno de los pilares del producto.

El usuario debe poder comparar:

- Equipo vs equipo.
- Jugador vs jugador.
- Temporada vs temporada.
- Competicion vs competicion.

Los comparadores deben usar visualizaciones, no solo tablas.

Visualizaciones esperadas:

- Barras.
- Radar charts.
- Line charts.
- Progress bars.
- Tablas profesionales.
- Timelines.
- Heatmaps futuros.
- Mapas de rendimiento futuros.

## Modelos Predictivos

El sistema usara multiples modelos. No debe depender de un unico algoritmo.

Cada deporte tendra modelos especializados.

Los resultados finales se obtendran mediante un enfoque tipo ensemble.

Cada prediccion debe almacenar:

- Fecha de generacion.
- Version.
- Modelo utilizado.
- Nivel de confianza.
- Probabilidad.
- Factores.
- Salvedades.
- Fuente de datos.

La IA no calcula probabilidades. La IA explica los resultados generados por modelos matematicos.

## Noticias Como Contexto

Las noticias no son solo contenido editorial. Deben servir como contexto para el modelo.

Ejemplo:

Una lesion importante puede aparecer como factor explicativo o como salvedad en la prediccion.

## Proveedores De Datos

La plataforma debe poder nutrirse de proveedores externos sin acoplar el producto a un unico vendor.

Roadmap de integracion:

Fase 1:

- API-Football como fuente principal de futbol.
- StatsBomb Open Data como complemento historico y analitico.

Fase 2:

- API-Basketball o API-NBA.

Fase 3:

- Datasets abiertos de tenis, inicialmente Jeff Sackmann y Tennis Abstract.

Primer proveedor operativo integrado:

- API-Sports para futbol.

Uso esperado:

- Consultar fixtures.
- Normalizar equipos, ligas, fechas, estados y venues.
- Consultar estadisticas de partido cuando exista cobertura.
- Consultar estadisticas de jugadores por partido cuando exista cobertura.
- Consultar estadisticas acumuladas por jugador, equipo, liga y temporada cuando el plan lo permita.
- Consultar planteles para construir fichas de equipo y jugador.
- Mantener trazabilidad del proveedor.
- Evitar consumir endpoints de odds/apuestas.
- Usar los datos como insumo de inteligencia deportiva, no como recomendacion de juego.

Proveedores siguientes:

- API-Basketball o API-NBA para juegos, equipos y estadisticas de basketball.
- StatsBomb Open Data como dataset complementario para investigacion, prototipos, backtesting y feature engineering de futbol.
- Jeff Sackmann y Tennis Abstract como base inicial para datasets abiertos de tenis.

Regla de jerarquia:

- API-Football alimenta la operacion principal de futbol.
- StatsBomb Open Data complementa con historico, granularidad de eventos y validacion de modelos.
- API-Basketball se incorpora en una segunda fase, despues de estabilizar futbol.
- Tenis se incorpora en tercera fase con datasets abiertos y cobertura validada.

Regla de cobertura:

No se debe asumir que todos los proveedores entregan la misma profundidad en todas las ligas o temporadas. Cada pantalla debe tener estados claros para:

- Sin estadisticas de equipo.
- Sin estadisticas de jugador.
- Sin alineaciones.
- Sin historial suficiente.
- Sin modelo calculado.

## Metricas GOUP Calculadas

GOUP SPORT debe construir inteligencia propia a partir de datos base.

Ejemplos:

- Forma reciente: rendimiento ponderado de ultimos partidos.
- Precision de remate: tiros al arco dividido por tiros totales.
- Efectividad de remate: goles dividido por tiros totales.
- GOUP Attack Score: combinacion normalizada de goles, tiros, tiros al arco, creacion, forma y dificultad de rivales.
- GOUP Defense Score: combinacion normalizada de goles concedidos, tiros concedidos, recuperaciones, disciplina y calidad de rivales.
- GOUP Player Score: rendimiento reciente, rendimiento de temporada, impacto, consistencia, calidad de rivales y disponibilidad.

Reglas:

- Toda metrica GOUP debe declarar formula, version y fuentes usadas.
- Las formulas pueden cambiar por deporte y posicion.
- Un arquero, un delantero, un base de basketball y un tenista no deben compartir el mismo calculo de score.
- Si el dato base no existe, la UI debe mostrar cobertura insuficiente en lugar de inventar estadisticas.

## Freemium Y Premium

Usuarios gratuitos:

- Estadisticas basicas.
- Predicciones generales.
- Eventos.
- Equipos.
- Jugadores.
- Comparaciones simples.

Usuarios premium:

- Predicciones avanzadas.
- Comparadores ilimitados.
- Analisis profundo.
- Historial completo.
- Dashboards.
- Exportacion de datos.
- Alertas.
- Modelos avanzados.
- API.

## Reglas De Negocio

- Ningun texto debe recomendar apostar.
- Ningun flujo debe permitir apostar.
- Ningun modulo debe vender cuotas.
- Toda prediccion debe explicar por que.
- Toda prediccion debe tener version.
- Todo dato debe tener fuente.
- Todo modelo debe ser medible.
- Toda prediccion debe poder auditarse historicamente.

## Estado Actual Implementado

La app actual ya incluye:

- Home visual tipo plataforma deportiva.
- Rutas de eventos.
- Detalle de evento.
- Ranking de modelos.
- Detalle de prediccion.
- Busqueda global.
- Favoritos locales.
- API v1 inicial.

Los siguientes ciclos deben expandir esta base hacia persistencia real, fichas de equipos/jugadores y visualizaciones mas avanzadas.
