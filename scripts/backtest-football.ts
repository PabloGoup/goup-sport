import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function readArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const { runFootballBacktest } = await import("../src/application/prediction/backtest");
  const window = readArg("window") ? Number(readArg("window")) : undefined;
  const minHistory = readArg("min-history") ? Number(readArg("min-history")) : undefined;

  console.log("[backtest] Corriendo validacion walk-forward de futbol...");
  const r = await runFootballBacktest({ window, minHistory });

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const f = (n: number) => n.toFixed(4);

  console.log(`\nPartidos totales: ${r.totalMatches} · evaluados: ${r.evaluated}\n`);
  console.log("Modelo            Accuracy   Brier↓    LogLoss↓");
  const row = (name: string, s: { accuracy: number; brier: number; logLoss: number }) =>
    console.log(`${name.padEnd(16)}  ${pct(s.accuracy).padStart(7)}   ${f(s.brier)}   ${f(s.logLoss)}`);
  row("Ensemble", r.ensemble);
  row("Poisson+DC", r.poisson);
  row("Elo", r.elo);
  row("Base: local", r.baselineHome);
  row("Base: frecuencia", r.baselineRate);

  console.log("\nCalibracion (prob. favorito → acierto real):");
  for (const b of r.calibration) {
    if (b.count === 0) continue;
    console.log(`  ${b.range.padEnd(8)} predicho ${pct(b.predicted)} · real ${pct(b.observed)} (n=${b.count})`);
  }

  console.log(
    `\nResumen: el ensemble ${r.ensemble.logLoss < r.baselineRate.logLoss ? "SUPERA" : "NO supera"} a la linea base de frecuencia (log-loss ${f(r.ensemble.logLoss)} vs ${f(r.baselineRate.logLoss)}).`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
