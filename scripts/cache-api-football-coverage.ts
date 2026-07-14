import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";

loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to cache API-Football coverage.");
}

const sourceSchema = z.object({
  key: z.string().min(1),
  enabled: z.boolean().default(true),
  tier: z.string().min(1),
  league: z.string().min(1),
  country: z.string().min(1),
  apiFootballLeagueId: z.number().int().positive(),
  season: z.number().int().positive(),
  priority: z.number().int().positive().default(1),
  notes: z.string().optional(),
});

const manifestSchema = z.object({
  version: z.number().int(),
  defaultWindowDays: z.number().int().positive().default(7),
  maxWindowDays: z.number().int().positive().default(7),
  defaultTtlHours: z.number().int().positive().default(24),
  sources: z.array(sourceSchema),
});

type Source = z.infer<typeof sourceSchema>;

const adapter = new PrismaPg(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

function readArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function localDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function sourceParams(source: Source, from: string, to: string) {
  return {
    from,
    to,
    league: String(source.apiFootballLeagueId),
    season: String(source.season),
  };
}

async function recentlyStored(source: Source, from: string, to: string, ttlHours: number) {
  const since = new Date(Date.now() - ttlHours * 60 * 60 * 1000);
  const log = await prisma.providerIngestionLog.findFirst({
    where: {
      provider: "API-Sports Football",
      resource: "fixtures",
      status: "stored",
      requestedAt: { gte: since },
      params: {
        equals: sourceParams(source, from, to),
      },
    },
    orderBy: { requestedAt: "desc" },
    select: { requestedAt: true, results: true },
  });

  return log;
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
  const manifestPath = path.resolve(process.cwd(), readArg("file") ?? "data/api-football-coverage.json");
  const manifest = manifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")));
  const dryRun = hasFlag("dry-run") || readArg("dry-run") === "true";
  const force = hasFlag("force") || readArg("force") === "true";
  const from = readArg("from") ?? localDate();
  const requestedDays = Number(readArg("days") ?? manifest.defaultWindowDays);
  const days = Math.min(requestedDays, manifest.maxWindowDays);
  const to = readArg("to") ?? addDays(from, days - 1);
  const ttlHours = Number(readArg("ttl-hours") ?? manifest.defaultTtlHours);
  const maxPriority = readArg("priority") ? Number(readArg("priority")) : undefined;
  const only = readArg("only")
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error("Use --from=YYYY-MM-DD and --to=YYYY-MM-DD.");
  }
  if (!Number.isInteger(days) || days < 1 || days > manifest.maxWindowDays) {
    throw new Error(`Use --days=1..${manifest.maxWindowDays}.`);
  }
  if (!Number.isInteger(ttlHours) || ttlHours < 1) {
    throw new Error("Use --ttl-hours with a positive integer.");
  }

  const sources = manifest.sources
    .filter((source) => source.enabled)
    .filter((source) => !only?.length || only.includes(source.key))
    .filter((source) => !maxPriority || source.priority <= maxPriority)
    .sort((a, b) => a.priority - b.priority || a.key.localeCompare(b.key));

  await prisma.$queryRaw`SELECT 1`;

  const plan = [];
  for (const source of sources) {
    const cached = force ? null : await recentlyStored(source, from, to, ttlHours);
    plan.push({
      source,
      cached,
      shouldRun: force || !cached,
    });
  }

  const plannedRequests = plan.filter((item) => item.shouldRun).length;
  console.log(
    `[api-football:coverage] Manifest ${manifestPath} v${manifest.version}; window=${from}..${to}; sources=${sources.length}; plannedRequests=${plannedRequests}; dryRun=${dryRun}`,
  );

  for (const item of plan) {
    const status = item.shouldRun
      ? "REQUEST"
      : `SKIP cached=${item.cached?.requestedAt.toISOString()} results=${item.cached?.results}`;
    console.log(
      `[api-football:coverage] ${status} ${item.source.key} league=${item.source.apiFootballLeagueId} season=${item.source.season} ${item.source.league}`,
    );
  }

  if (dryRun) return;

  for (const item of plan) {
    if (!item.shouldRun) continue;

    await run("npm", [
      "run",
      "ingest:api-sports",
      "--",
      `--from=${from}`,
      `--to=${to}`,
      `--league=${item.source.apiFootballLeagueId}`,
      `--season=${item.source.season}`,
    ]);
  }

  console.log("[api-football:coverage] Completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
