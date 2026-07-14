# GOUP SPORT - Design System Y UX

## Direccion Visual

GOUP SPORT debe sentirse como una plataforma deportiva premium de alto trafico.

La referencia visual es una experiencia moderna, rapida y densa en informacion, no un dashboard administrativo.

Principios visuales:

- Energia deportiva.
- Navegacion rapida.
- Alto contraste.
- Acciones visibles.
- Datos organizados en cards.
- Jerarquia clara.
- Mobile-first.

La plataforma puede inspirarse en patrones de navegacion de plataformas deportivas modernas, sin copiar interfaces, assets ni lenguaje de apuestas.

## Identidad Visual Inicial

La direccion actual usa:

- Header naranja dominante.
- Fondo gris claro para area operativa.
- Cards blancas.
- Acento naranja para accion, confianza y seleccion.
- Sidebar deportiva.
- Centro de eventos.
- Panel derecho de insight.

El objetivo es que el usuario sienta que esta en una plataforma deportiva internacional, no en una herramienta interna.

## Layout Base

Desktop:

- Header superior naranja con marca y navegacion principal.
- Barra secundaria con breadcrumb, control de deportes y busqueda.
- Sidebar izquierda para deportes, favoritos y competiciones.
- Area central para eventos, rankings y contenido principal.
- Panel derecho para insight, modelo o resumen contextual.

Mobile:

- Header compacto.
- Navegacion horizontal por chips.
- Sidebar oculta.
- Panel derecho convertido en seccion apilada.
- Cards con altura controlada.
- Botones tactiles amplios.

## Patrones Por Deporte

Las pantallas de detalle deben adaptar su estructura al deporte. La referencia de plataformas como SofaScore es util por su densidad, jerarquia y rapidez, pero GOUP SPORT debe mantener identidad propia, color, componentes y lenguaje de inteligencia deportiva.

### Futbol

El detalle de partido debe priorizar:

- Encabezado con competicion, fase, fecha, hora, sede, escudos y estado.
- Marcador o estado del partido.
- Prediccion GOUP y confianza cuando exista modelo.
- Tabs principales: Resumen, Alineaciones, Estadisticas, Historial, Modelos, Noticias.
- Vista de cancha para alineaciones cuando haya datos.
- Rating o GOUP Player Score por jugador.
- Comparacion de equipos mediante barras y radar.
- Timeline de eventos: goles, tarjetas, sustituciones, penales y VAR cuando exista dato.
- Tabla de estadisticas de equipo: posesion, tiros, tiros al arco, corners, faltas, tarjetas, pases y recuperaciones.

Jerarquia:

- Nivel 1: quien juega, estado, marcador/proyeccion y ventaja del modelo.
- Nivel 2: alineaciones, ratings, estadisticas del partido.
- Nivel 3: H2H, factores, versiones del modelo, noticias y trazabilidad.

### Basketball

El detalle de partido debe priorizar:

- Encabezado con equipos, marcador por periodo, estado, liga, arena y hora.
- Tabs principales: Box score, Estadisticas, H2H, Modelos, Noticias.
- Tabla de jugadores con MIN, PTS, REB, AST, STL, BLK, PF, TOV, OREB, DREB, FG, 3P y FT.
- Resumen por cuarto o periodo.
- Comparacion de eficiencia ofensiva y defensiva.
- Run chart o momentum cuando haya datos suficientes.
- Tarjetas de lideres: puntos, rebotes, asistencias, eficiencia.

Jerarquia:

- Nivel 1: marcador/estado, periodo, tiempo restante y equipos.
- Nivel 2: box score y lideres del partido.
- Nivel 3: tendencias, H2H, modelo GOUP y trazabilidad.

### Tenis

El detalle de partido o jugador debe priorizar:

- Encabezado con jugadores, ranking, pais, torneo, ronda, superficie, fecha y hora.
- Estado del partido o resultado por sets.
- Tabs principales: Partido, Estadisticas, H2H, Draw, Ranking, Modelos.
- Comparacion H2H por superficie.
- Tarjetas de ultimo partido y proximo partido en perfil de jugador.
- Estadisticas de servicio y devolucion cuando existan.
- Rendimiento por superficie: clay, grass, hard, indoor hard.
- Rankings y tendencia historica cuando el collector tenga datos.

Jerarquia:

- Nivel 1: jugador vs jugador, torneo, superficie, hora/resultado.
- Nivel 2: H2H, ranking, forma reciente y ultimos/proximos partidos.
- Nivel 3: estadisticas de servicio/devolucion, draw, historial y modelo GOUP.

Reglas comunes:

- Las tabs evitan paginas interminables.
- Las tablas deben ser densas pero legibles.
- En mobile, las tablas se transforman en cards o scroll horizontal controlado.
- Si una fuente no entrega un dato, mostrar estado de cobertura insuficiente.
- Nunca inventar estadisticas para llenar una pantalla.

## Componentes Principales

### Event Card

Debe mostrar:

- Deporte.
- Competicion.
- Participantes.
- Fecha/estado.
- Confianza.
- Accion hacia detalle.
- Favorito.

Reglas:

- Toda card debe ser clickeable.
- La accion principal debe ser evidente.
- En mobile no debe desbordar horizontalmente.

### Prediction Card

Debe mostrar:

- Resultado interpretado.
- Evento asociado.
- Confianza.
- Factores principales.
- Link a detalle.

Reglas:

- No mostrar predicciones como recomendacion de apuesta.
- Siempre incluir contexto explicativo.

### Confidence Bar

Debe mostrar nivel de confianza de forma visual.

Reglas:

- El color no debe implicar certeza absoluta.
- Debe acompañarse de porcentaje.
- En estados de baja confianza debe activar mensajes de incertidumbre.

### Search

Debe permitir descubrir:

- Eventos.
- Equipos.
- Jugadores.
- Ligas.
- Deportes.
- Predicciones.
- Noticias.

Reglas:

- Debe funcionar rapido.
- Debe mostrar resultados accionables.
- En mobile debe ocupar poco espacio y abrir resultados legibles.

### Filters

Filtros iniciales:

- Deporte.
- Estado.
- Confianza.
- Orden.

Reglas:

- Deben ser visibles como chips.
- Deben ser faciles de tocar en mobile.
- Siempre debe existir forma de volver a "Todos".

### Favorite Button

Permite guardar eventos localmente.

Reglas:

- Debe funcionar sin cuenta.
- Debe poder migrarse luego a usuario autenticado.
- Debe tener estado visual claro.

### Comparison Table

Debe permitir comparar predicciones o entidades.

Reglas:

- En desktop puede usar tabla horizontal.
- En mobile debe permitir scroll controlado o cards comparativas.
- Debe priorizar metricas clave.

### Model Explanation Panel

Debe mostrar:

- Explicacion principal.
- Factores positivos.
- Factores negativos.
- Salvedades.
- Fuente.
- Version del modelo.

Reglas:

- Debe ser claro para usuarios no tecnicos.
- Debe permitir auditoria para usuarios avanzados.

## Estados De UI

Cada modulo debe contemplar:

- Loading.
- Empty.
- Error.
- No prediction.
- No results.
- Partial data.

Los estados vacios deben explicar que falta y cual es la siguiente accion posible.

## Reglas UX

- El usuario debe recorrer la app con pocos clics.
- Las cards principales deben ser accionables.
- Los datos visuales deben tener prioridad sobre textos largos.
- El texto debe explicar el modelo con lenguaje claro.
- Evitar lenguaje de apuestas.
- Evitar conceptos como "apostar", "cupon", "casino" o "cuota" en producto final.
- Si se muestran probabilidades, deben presentarse como analisis deportivo.

## Accesibilidad Y Mobile

- Los objetivos tactiles deben ser amplios.
- El texto debe mantener contraste suficiente.
- No debe existir overflow horizontal accidental.
- Los chips deben ser scrolleables cuando no quepan.
- El contenido principal debe ser legible en pantallas pequenas.
- Los estados interactivos deben ser visibles.
