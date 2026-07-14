import { loadEnvConfig } from "@next/env";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  getFootballFixtureEvents,
  getFootballFixtureLineups,
  getFootballFixturePlayers,
  getFootballFixtureStatistics,
} from "../src/infrastructure/api-sports/client";

loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to store API-Sports fixture details.");
}

const adapter = new PrismaPg(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function readArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const fixture = readArg("fixture");
  if (!fixture || !/^\d+$/.test(fixture)) {
    throw new Error("Use --fixture=NUMERIC_API_SPORTS_FIXTURE_ID.");
  }

  await prisma.$queryRaw`SELECT 1`;

  const event = await prisma.event.findFirst({
    where: {
      OR: [
        { externalId: fixture },
        { id: `apisports-football-fixture-${fixture}` },
      ],
    },
  });

  if (!event) {
    throw new Error(`Fixture ${fixture} is not stored in the database yet.`);
  }

  console.log(`[api-sports] Detail requests for fixture=${fixture}`);

  const [statistics, events, lineups, players] = await Promise.all([
    getFootballFixtureStatistics({ fixture }),
    getFootballFixtureEvents({ fixture }),
    getFootballFixtureLineups({ fixture }),
    getFootballFixturePlayers({ fixture }),
  ]);

  const currentRawPayload =
    event.rawPayload && typeof event.rawPayload === "object" && !Array.isArray(event.rawPayload)
      ? event.rawPayload
      : {};

  await prisma.event.update({
    where: { id: event.id },
    data: {
      rawPayload: toInputJson({
        ...currentRawPayload,
        apiSportsDetails: {
          storedAt: new Date().toISOString(),
          fixture,
          statistics: statistics.response,
          events: events.response,
          lineups: lineups.response,
          players: players.response,
          meta: {
            statisticsResults: statistics.results,
            eventsResults: events.results,
            lineupsResults: lineups.results,
            playersResults: players.results,
          },
        },
      }),
    },
  });

  await prisma.providerIngestionLog.create({
    data: {
      id: `api-sports-football-fixture-detail-${fixture}-${Date.now()}`,
      provider: "API-Sports Football",
      resource: "fixture-detail",
      params: { fixture },
      results:
        statistics.results + events.results + lineups.results + players.results,
      status: "stored",
    },
  });

  console.log(
    `[api-sports] Stored fixture detail: statistics=${statistics.results}, events=${events.results}, lineups=${lineups.results}, players=${players.results}.`,
  );
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
