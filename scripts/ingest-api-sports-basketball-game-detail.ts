import { loadEnvConfig } from "@next/env";
import { Prisma, PrismaClient, type Event } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  getBasketballGamePlayerStatistics,
  getBasketballGameTeamStatistics,
} from "../src/infrastructure/api-sports/client";

loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to store API-Sports basketball details.");
}

const adapter = new PrismaPg(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

type StoredEvent = Event;

function readArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function rawObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function slugifyMetric(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "");
}

function parseNumericMetric(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const normalized = value.trim().replace("%", "").replace(",", ".");
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function flattenNumericStats(
  value: unknown,
  prefix = "",
  output: Array<{ key: string; value: number }> = [],
) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const itemObject = rawObject(item);
      const label = itemObject.type ?? itemObject.name ?? itemObject.label ?? itemObject.key;
      const metricValue = itemObject.value ?? itemObject.total ?? itemObject.number;
      if (typeof label === "string") {
        const parsed = parseNumericMetric(metricValue);
        if (parsed !== null) output.push({ key: slugifyMetric(`${prefix}${label}`), value: parsed });
      } else {
        flattenNumericStats(item, prefix, output);
      }
    }
    return output;
  }

  const object = rawObject(value);
  for (const [key, entry] of Object.entries(object)) {
    if (["team", "game", "country", "league"].includes(key)) continue;
    const metricKey = slugifyMetric(`${prefix}${key}`);
    const parsed = parseNumericMetric(entry);
    if (parsed !== null) {
      output.push({ key: metricKey, value: parsed });
      continue;
    }
    if (entry && typeof entry === "object") {
      flattenNumericStats(entry, `${metricKey}_`, output);
    }
  }

  return output;
}

function teamExternalIdFromStatsItem(item: unknown) {
  const object = rawObject(item);
  const team = rawObject(object.team);
  const id = team.id;
  if (typeof id === "number" || typeof id === "string") return String(id);
  return null;
}

function teamStatsFromResponse(response: unknown[]) {
  return response.map((item) => {
    const object = rawObject(item);
    const statistics = object.statistics ?? object;
    return {
      teamExternalId: teamExternalIdFromStatsItem(item),
      metrics: flattenNumericStats(statistics),
    };
  });
}

function participantForExternalTeam(event: StoredEvent, externalTeamId: string | null) {
  if (!externalTeamId) return null;
  const payload = rawObject(event.rawPayload);
  const teams = rawObject(payload.teams);
  const home = rawObject(teams.home);
  const away = rawObject(teams.away);

  if (String(home.id ?? "") === externalTeamId) return event.homeId;
  if (String(away.id ?? "") === externalTeamId) return event.awayId;
  return null;
}

function hasStoredBasketballDetails(event: StoredEvent) {
  const payload = rawObject(event.rawPayload);
  return Boolean(payload.apiSportsBasketballDetails);
}

async function findTargetEvents() {
  const game = readArg("game");
  const limit = Number(readArg("limit") ?? 3);
  const force = hasFlag("force");
  const statuses = (readArg("status") ?? "live,completed")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (game) {
    return prisma.event.findMany({
      where: {
        sportId: "sport-basketball",
        OR: [{ externalId: game }, { id: game }],
      },
      orderBy: { startsAt: "asc" },
    });
  }

  const events = await prisma.event.findMany({
    where: {
      sportId: "sport-basketball",
      dataSource: { provider: "API-Sports Basketball" },
      status: { in: statuses as Array<"live" | "today" | "upcoming" | "completed" | "postponed"> },
      externalId: { not: null },
    },
    orderBy: [{ status: "asc" }, { startsAt: "asc" }],
    take: Math.max(limit * 3, limit),
  });

  return events.filter((event) => force || !hasStoredBasketballDetails(event)).slice(0, limit);
}

async function storeTeamMetrics(input: {
  event: StoredEvent;
  teamStatistics: unknown[];
}) {
  const rows = teamStatsFromResponse(input.teamStatistics);
  let stored = 0;

  for (const row of rows) {
    const participantId = participantForExternalTeam(input.event, row.teamExternalId);
    if (!participantId) continue;

    for (const metric of row.metrics) {
      await prisma.teamMatchMetric.upsert({
        where: {
          eventId_participantId_metricKey_source_version: {
            eventId: input.event.id,
            participantId,
            metricKey: metric.key,
            source: "API-Sports Basketball",
            version: "api-sports-basketball-detail-0.1.0",
          },
        },
        update: {
          metricValue: metric.value,
          sampleSize: 1,
          metadata: toInputJson({ externalTeamId: row.teamExternalId }),
        },
        create: {
          id: `api-basketball-team-metric-${input.event.id}-${participantId}-${metric.key}`,
          eventId: input.event.id,
          participantId,
          source: "API-Sports Basketball",
          version: "api-sports-basketball-detail-0.1.0",
          metricKey: metric.key,
          metricValue: metric.value,
          sampleSize: 1,
          metadata: toInputJson({ externalTeamId: row.teamExternalId }),
        },
      });
      stored += 1;
    }
  }

  return stored;
}

async function ingestEvent(event: StoredEvent, includePlayers: boolean) {
  if (!event.externalId) throw new Error(`Event ${event.id} has no externalId.`);

  const [teamStatistics, playerStatistics] = await Promise.all([
    getBasketballGameTeamStatistics({ id: event.externalId }),
    includePlayers
      ? getBasketballGamePlayerStatistics({ id: event.externalId })
      : Promise.resolve(null),
  ]);

  const currentRawPayload = rawObject(event.rawPayload);
  const storedMetrics = await storeTeamMetrics({
    event,
    teamStatistics: Array.isArray(teamStatistics.response) ? teamStatistics.response : [],
  });

  await prisma.event.update({
    where: { id: event.id },
    data: {
      rawPayload: toInputJson({
        ...currentRawPayload,
        apiSportsBasketballDetails: {
          storedAt: new Date().toISOString(),
          game: event.externalId,
          teamStatistics: teamStatistics.response,
          playerStatistics: playerStatistics?.response ?? null,
          meta: {
            teamStatisticsResults: teamStatistics.results,
            playerStatisticsResults: playerStatistics?.results ?? 0,
            storedTeamMetrics: storedMetrics,
          },
        },
      }),
    },
  });

  await prisma.providerIngestionLog.create({
    data: {
      id: `api-sports-basketball-game-detail-${event.externalId}-${Date.now()}`,
      provider: "API-Sports Basketball",
      resource: "game-detail",
      params: { game: event.externalId, includePlayers },
      results: teamStatistics.results + (playerStatistics?.results ?? 0),
      status: "stored",
    },
  });

  return {
    eventId: event.id,
    externalId: event.externalId,
    teamStatistics: teamStatistics.results,
    playerStatistics: playerStatistics?.results ?? 0,
    storedMetrics,
  };
}

async function main() {
  const includePlayers = readArg("include-players") !== "false";
  const dryRun = hasFlag("dry-run");

  await prisma.$queryRaw`SELECT 1`;

  const events = await findTargetEvents();
  const estimatedRequests = events.length * (includePlayers ? 2 : 1);

  console.log(
    `[api-sports:basketball:detail] Selected ${events.length} game(s). Estimated provider requests: ${estimatedRequests}.`,
  );

  for (const event of events) {
    console.log(
      `- ${event.externalId} ${event.id} ${event.status} ${event.startsAt.toISOString()}`,
    );
  }

  if (dryRun) return;

  for (const event of events) {
    const result = await ingestEvent(event, includePlayers);
    console.log(
      `[api-sports:basketball:detail] Stored ${result.eventId}: teamStats=${result.teamStatistics}, playerStats=${result.playerStatistics}, metrics=${result.storedMetrics}.`,
    );
  }
}

main()
  .catch(async (error) => {
    console.error(error);
    await prisma.providerIngestionLog
      .create({
        data: {
          id: `api-sports-basketball-game-detail-error-${Date.now()}`,
          provider: "API-Sports Basketball",
          resource: "game-detail",
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
