# Backtesting del modelo de fútbol

## Qué es

Validación **walk-forward** (sin fuga de datos) del motor predictivo de fútbol. Recorre los partidos completados en orden cronológico y predice cada uno usando **solo los anteriores** (Elo incremental + fuerzas Poisson por ventana), luego compara con el resultado real.

```bash
npm run backtest:football
npm run backtest:football -- --window=1200 --min-history=300
```

## Métricas

- **Accuracy**: % de veces que el resultado más probable acertó.
- **Brier score** (menor = mejor): error cuadrático medio de las probabilidades vs el resultado real.
- **Log-loss** (menor = mejor): penaliza asignar poca probabilidad al resultado que ocurrió.
- **Curva de calibración**: compara la probabilidad predicha del favorito con la frecuencia real de acierto por tramos.
- Se compara contra dos líneas base: "siempre gana local" y "frecuencia histórica de resultados".

Implementación en `src/domain/prediction/metrics.ts` (puro, testeado) y `src/application/prediction/backtest.ts`.

## Resultado de referencia (4.464 partidos, 4.028 evaluados)

| Modelo | Accuracy | Brier | Log-loss |
|---|---|---|---|
| **Ensemble (Poisson+DC + Elo)** | **47.5%** | **0.627** | **1.043** |
| Poisson + Dixon-Coles | 47.0% | 0.631 | 1.051 |
| Elo | 47.4% | 0.630 | 1.049 |
| Base: siempre local | 45.8% | 1.084 | 14.98 |
| Base: frecuencia histórica | 45.8% | 0.643 | 1.065 |

**Conclusiones:**

1. El **ensemble es el mejor** modelo en las tres métricas y **supera a las líneas base** — aporta valor predictivo real, no es azar.
2. El margen sobre la base de frecuencia es **modesto** (log-loss 1.043 vs 1.065). Es lo **realista** para fútbol con datos gratuitos (solo goles + Elo, sin xG por partido, lesiones ni mercado). Modelos profesionales llegan a ~50-53%.
3. **Calibración**: el modelo está bien calibrado en el rango común (hasta ~60% de probabilidad), donde predicho ≈ real. Por encima de 60% tiende a ser **sobreconfiado** (a 80-100% predice 83.6% pero acierta 71.4%).

## Implicancia en la confianza

El backtest **justifica empíricamente el techo de confianza de 0.6**: el modelo está bien calibrado hasta ~60% pero se vuelve sobreconfiado por encima. No se debe presentar confianza mayor sin validación adicional. Mantener el modelo marcado como **experimental** hasta incorporar señales más ricas (xG, forma por jugador, mercado).

## Cómo mejorarlo (roadmap)

- Ponderar más los partidos de la temporada actual (ya hay recencia; se puede afinar).
- Incorporar xG por partido cuando exista dato gratuito (StatsBomb, ligas cubiertas).
- Ajustar la mezcla del ensemble por peso óptimo (hoy es promedio simple) según su desempeño en el backtest.
