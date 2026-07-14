import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function readFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  // Import diferido: getGroqConfig valida el entorno despues de cargar .env.local.
  const { runEnrichmentJob } = await import("../src/application/ai-enrichment/enrichment-job");

  const dryRun = readFlag("dry-run");
  const force = readFlag("force");
  const retryFailed = readFlag("retry-failed");
  const eventId = readArg("event-id");
  const limitRaw = readArg("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  if (limitRaw && (!Number.isInteger(limit) || (limit as number) < 1)) {
    throw new Error("--limit debe ser un entero positivo.");
  }

  if (force && !dryRun) {
    console.warn(
      "[enrich] --force reprocesa analisis existentes y consume tokens. Usalo solo para depuracion puntual.",
    );
  }

  const summary = await runEnrichmentJob({
    trigger: dryRun ? "dry-run" : "manual",
    dryRun,
    eventId,
    limit,
    force,
    retryFailed,
  });

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
