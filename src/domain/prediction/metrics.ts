/**
 * Metricas de calibracion para predicciones 1X2 (tres resultados).
 * Se usan en el backtesting para medir cuan bien acierta el modelo.
 */

export type Outcome = "home" | "draw" | "away";
export type Prob1x2 = { homeWin: number; draw: number; awayWin: number };

export type Prediction = { probs: Prob1x2; actual: Outcome };

function probOf(probs: Prob1x2, outcome: Outcome): number {
  return outcome === "home" ? probs.homeWin : outcome === "draw" ? probs.draw : probs.awayWin;
}

function argmax(probs: Prob1x2): Outcome {
  if (probs.homeWin >= probs.draw && probs.homeWin >= probs.awayWin) return "home";
  return probs.awayWin >= probs.draw ? "away" : "draw";
}

/** Fraccion de aciertos: el resultado mas probable coincide con el real. */
export function accuracy(predictions: Prediction[]): number {
  if (predictions.length === 0) return 0;
  const hits = predictions.filter((p) => argmax(p.probs) === p.actual).length;
  return hits / predictions.length;
}

/**
 * Brier score multiclase (0 = perfecto, mayor = peor). Media de la suma de
 * cuadrados entre probabilidad predicha y el vector one-hot del resultado.
 */
export function brierScore(predictions: Prediction[]): number {
  if (predictions.length === 0) return 0;
  let total = 0;
  for (const { probs, actual } of predictions) {
    const oh = {
      homeWin: actual === "home" ? 1 : 0,
      draw: actual === "draw" ? 1 : 0,
      awayWin: actual === "away" ? 1 : 0,
    };
    total +=
      (probs.homeWin - oh.homeWin) ** 2 +
      (probs.draw - oh.draw) ** 2 +
      (probs.awayWin - oh.awayWin) ** 2;
  }
  return total / predictions.length;
}

/** Log-loss (menor = mejor). Penaliza fuerte asignar poca prob al resultado real. */
export function logLoss(predictions: Prediction[]): number {
  if (predictions.length === 0) return 0;
  const EPS = 1e-12;
  let total = 0;
  for (const { probs, actual } of predictions) {
    const p = Math.min(1 - EPS, Math.max(EPS, probOf(probs, actual)));
    total += -Math.log(p);
  }
  return total / predictions.length;
}

/** Frecuencias base de cada resultado en el set (para el modelo de referencia). */
export function baseRates(predictions: Prediction[]): Prob1x2 {
  const n = predictions.length || 1;
  const home = predictions.filter((p) => p.actual === "home").length / n;
  const draw = predictions.filter((p) => p.actual === "draw").length / n;
  const away = predictions.filter((p) => p.actual === "away").length / n;
  return { homeWin: home, draw, awayWin: away };
}

export type CalibrationBin = { range: string; predicted: number; observed: number; count: number };

/**
 * Curva de calibracion: agrupa por la probabilidad del favorito y compara la
 * probabilidad media predicha con la frecuencia real de acierto en cada bin.
 * Un modelo bien calibrado tiene predicted ~= observed.
 */
export function calibrationCurve(predictions: Prediction[], bins = 5): CalibrationBin[] {
  const buckets: Array<{ predSum: number; hits: number; count: number }> = Array.from(
    { length: bins },
    () => ({ predSum: 0, hits: 0, count: 0 }),
  );
  for (const { probs, actual } of predictions) {
    const fav = argmax(probs);
    const favProb = probOf(probs, fav);
    const idx = Math.min(bins - 1, Math.floor(favProb * bins));
    buckets[idx].predSum += favProb;
    buckets[idx].hits += fav === actual ? 1 : 0;
    buckets[idx].count += 1;
  }
  return buckets.map((b, i) => ({
    range: `${((i / bins) * 100).toFixed(0)}-${(((i + 1) / bins) * 100).toFixed(0)}%`,
    predicted: b.count ? b.predSum / b.count : 0,
    observed: b.count ? b.hits / b.count : 0,
    count: b.count,
  }));
}

export function summarize(predictions: Prediction[]) {
  return {
    n: predictions.length,
    accuracy: accuracy(predictions),
    brier: brierScore(predictions),
    logLoss: logLoss(predictions),
  };
}
