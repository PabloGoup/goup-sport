import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to extract StatsBomb features.");
}

const adapter = new PrismaPg(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });
const featureVersion = "statsbomb-football-features-0.1.0";
const source = "StatsBomb Open Data";

type StatsBombEvent = {
  type?: { name?: string };
  team?: { name?: string };
  shot?: {
    outcome?: { name?: string };
    statsbomb_xg?: number;
  };
  pass?: {
    outcome?: { name?: string };
  };
  carry?: unknown;
  pressure?: unknown;
  dribble?: {
    outcome?: { name?: string };
  };
};

type MetricAccumulator = Record<string, number>;

function readArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function repoDataPath() {
  const explicitRepo = readArg("repo");
  const repoRoot = explicitRepo
    ? path.resolve(process.cwd(), explicitRepo)
    : path.resolve(process.cwd(), "data-providers/statsbomb-open-data");

  return {
    repoRoot,
    dataRoot: path.join(repoRoot, "data"),
  };
}

async function readJson<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

function addMetric(metrics: MetricAccumulator, key: string, value = 1) {
  metrics[key] = (metrics[key] ?? 0) + value;
}

function rounded(value: number) {
  return Math.round(value * 1000) / 1000;
}

function extractTeamMetrics(events: StatsBombEvent[]) {
  const byTeam = new Map<string, MetricAccumulator>();

  for (const item of events) {
    const teamName = item.team?.name;
    const type = item.type?.name;
    if (!teamName || !type) continue;

    const metrics = byTeam.get(teamName) ?? {};
    addMetric(metrics, "events_total");

    if (type === "Shot") {
      addMetric(metrics, "shots_total");
      addMetric(metrics, "xg_total", item.shot?.statsbomb_xg ?? 0);
      if (item.shot?.outcome?.name === "Goal") addMetric(metrics, "goals_from_shots");
      if (["Goal", "Saved", "Saved to Post"].includes(item.shot?.outcome?.name ?? "")) {
        addMetric(metrics, "shots_on_target");
      }
    }

    if (type === "Pass") {
      addMetric(metrics, "passes_total");
      if (!item.pass?.outcome?.name) addMetric(metrics, "passes_completed");
    }

    if (type === "Carry") addMetric(metrics, "carries_total");
    if (type === "Pressure") addMetric(metrics, "pressures_total");
    if (type === "Ball Recovery") addMetric(metrics, "ball_recoveries");
    if (type === "Interception") addMetric(metrics, "interceptions");
    if (type === "Duel") addMetric(metrics, "duels_total");
    if (type === "Dribble") {
      addMetric(metrics, "dribbles_total");
      if (item.dribble?.outcome?.name === "Complete") addMetric(metrics, "dribbles_completed");
    }

    byTeam.set(teamName, metrics);
  }

  return byTeam;
}

function derivedMetrics(metrics: MetricAccumulator) {
  const shots = metrics.shots_total ?? 0;
  const passes = metrics.passes_total ?? 0;
  const dribbles = metrics.dribbles_total ?? 0;

  return {
    ...metrics,
    xg_per_shot: shots > 0 ? (metrics.xg_total ?? 0) / shots : 0,
    shot_accuracy: shots > 0 ? (metrics.shots_on_target ?? 0) / shots : 0,
    pass_completion: passes > 0 ? (metrics.passes_completed ?? 0) / passes : 0,
    dribble_completion: dribbles > 0 ? (metrics.dribbles_completed ?? 0) / dribbles : 0,
  };
}

async function main() {
  const competition = readArg("competition");
  const season = readArg("season");
  const limit = readArg("limit") ? Number(readArg("limit")) : undefined;
  const { repoRoot, dataRoot } = repoDataPath();

  if (!existsSync(dataRoot)) {
    throw new Error(`StatsBomb Open Data not found at ${repoRoot}.`);
  }

  await prisma.$queryRaw`SELECT 1`;

  const events = await prisma.event.findMany({
    where: {
      dataSource: { provider: "StatsBomb Open Data" },
      ...(competition || season
        ? {
            dataSourceId: `statsbomb-open-data-${competition ?? ""}-${season ?? ""}`,
          }
        : {}),
    },
    include: {
      home: true,
      away: true,
      sport: true,
    },
    orderBy: { startsAt: "asc" },
    take: Number.isInteger(limit) ? limit : undefined,
  });

  const aggregate = new Map<string, { participantId: string; sportId: string; values: Record<string, number[]> }>();
  let processed = 0;
  let metricRows = 0;

  for (const event of events) {
    if (!event.externalId) continue;

    const statsPath = path.join(dataRoot, "events", `${event.externalId}.json`);
    if (!existsSync(statsPath)) {
      console.warn(`[features:statsbomb] Missing events file for ${event.externalId}`);
      continue;
    }

    const rawEvents = await readJson<StatsBombEvent[]>(statsPath);
    const metricsByTeam = extractTeamMetrics(rawEvents);

    for (const participant of [event.home, event.away]) {
      const rawMetrics = metricsByTeam.get(participant.name);
      if (!rawMetrics) continue;

      const metrics = derivedMetrics(rawMetrics);
      const aggregateEntry = aggregate.get(participant.id) ?? {
        participantId: participant.id,
        sportId: event.sportId,
        values: {},
      };

      for (const [metricKey, metricValue] of Object.entries(metrics)) {
        const value = rounded(metricValue);
        await prisma.teamMatchMetric.upsert({
          where: {
            eventId_participantId_metricKey_source_version: {
              eventId: event.id,
              participantId: participant.id,
              metricKey,
              source,
              version: featureVersion,
            },
          },
          update: {
            metricValue: value,
            sampleSize: rawEvents.length,
            metadata: { eventExternalId: event.externalId },
          },
          create: {
            id: `statsbomb-team-match-${event.id}-${participant.id}-${metricKey}`,
            eventId: event.id,
            participantId: participant.id,
            source,
            version: featureVersion,
            metricKey,
            metricValue: value,
            sampleSize: rawEvents.length,
            metadata: { eventExternalId: event.externalId },
          },
        });

        aggregateEntry.values[metricKey] = aggregateEntry.values[metricKey] ?? [];
        aggregateEntry.values[metricKey].push(value);
        metricRows += 1;
      }

      aggregate.set(participant.id, aggregateEntry);
    }

    processed += 1;
    console.log(`[features:statsbomb] Extracted ${event.externalId}: ${event.home.name} vs ${event.away.name}`);
  }

  let aggregateRows = 0;

  for (const entry of aggregate.values()) {
    for (const [metricKey, values] of Object.entries(entry.values)) {
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;

      await prisma.teamAggregateMetric.upsert({
        where: {
          participantId_scope_metricKey_source_version: {
            participantId: entry.participantId,
            scope: "statsbomb-imported-matches",
            metricKey,
            source,
            version: featureVersion,
          },
        },
        update: {
          metricValue: rounded(average),
          sampleSize: values.length,
          metadata: { aggregation: "average" },
        },
        create: {
          id: `statsbomb-team-aggregate-${entry.participantId}-${metricKey}`,
          participantId: entry.participantId,
          sportId: entry.sportId,
          source,
          version: featureVersion,
          scope: "statsbomb-imported-matches",
          metricKey,
          metricValue: rounded(average),
          sampleSize: values.length,
          metadata: { aggregation: "average" },
        },
      });

      aggregateRows += 1;
    }
  }

  await prisma.providerIngestionLog.create({
    data: {
      id: `statsbomb-football-features-${Date.now()}`,
      provider: "StatsBomb Open Data",
      resource: "football-features",
      params: { competition, season, limit: limit ?? null, featureVersion },
      results: processed,
      status: "stored",
    },
  });

  console.log(`[features:statsbomb] Processed ${processed} matches, ${metricRows} match metrics, ${aggregateRows} aggregate metrics.`);
}

main()
  .catch(async (error) => {
    console.error(error);
    await prisma.providerIngestionLog
      .create({
        data: {
          id: `statsbomb-football-features-error-${Date.now()}`,
          provider: "StatsBomb Open Data",
          resource: "football-features",
          params: {},
          results: 0,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      })
      .catch(() => undefined);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
