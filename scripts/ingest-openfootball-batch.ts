import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const sourceSchema = z.object({
  key: z.string().min(1),
  enabled: z.boolean().default(true),
  league: z.string().min(1),
  country: z.string().min(1).optional(),
  season: z.number().int().optional(),
  url: z.string().url(),
  notes: z.string().optional(),
});

const manifestSchema = z.object({
  version: z.number().int(),
  sources: z.array(sourceSchema),
});

function readArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function run(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
      shell: false,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function main() {
  const file = readArg("file") ?? "data/openfootball-sources.json";
  const only = readArg("only")
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const dryRun = readArg("dry-run") === "true";
  const manifestPath = path.resolve(process.cwd(), file);
  const manifest = manifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")));
  const sources = manifest.sources.filter((source) => {
    if (!source.enabled) return false;
    if (only?.length) return only.includes(source.key);
    return true;
  });

  console.log(`[openfootball:batch] Manifest ${file} v${manifest.version}, sources=${sources.length}`);

  for (const source of sources) {
    const args = [
      "run",
      "ingest:openfootball:league",
      "--",
      `--url=${source.url}`,
      `--key=${source.key}`,
      `--league=${source.league}`,
    ];

    if (source.country) args.push(`--country=${source.country}`);
    if (source.season) args.push(`--season=${source.season}`);

    console.log(`[openfootball:batch] ${source.key}: ${source.league} (${source.url})`);

    if (!dryRun) {
      await run("npm", args);
    }
  }

  console.log("[openfootball:batch] Completed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
