import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getBasketballGames } from "../src/infrastructure/api-sports/client";
import { normalizeBasketballGame } from "../src/infrastructure/api-sports/basketball-normalizers";

loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to store API-Sports basketball data.");
}

const adapter = new PrismaPg(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

function readArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function shortName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function todayDate() {
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

function ingestionKey(params: {
  date?: string;
  league?: string;
  season?: string;
  team?: string;
  live?: string;
}) {
  return [
    params.date ? `date-${params.date}` : null,
    params.league ? `league-${params.league}` : null,
    params.season ? `season-${params.season}` : null,
    params.team ? `team-${params.team}` : null,
    params.live ? `live-${params.live}` : null,
  ]
    .filter(Boolean)
    .join("-");
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

async function ensureBasketballSport() {
  await prisma.sport.upsert({
    where: { id: "sport-basketball" },
    update: { name: "Basketball" },
    create: {
      id: "sport-basketball",
      code: "basketball",
      name: "Basketball",
    },
  });
}

async function ingestBasketballGames(params: {
  date?: string;
  league?: string;
  season?: string;
  team?: string;
  live?: string;
}) {
  const { date, league, season, team, live } = params;
  console.log(
    `[api-sports:basketball] One request: games ${JSON.stringify({ date, league, season, team, live })}`,
  );
  const raw = await getBasketballGames({ date, league, season, team, live });
  const collectedAt = new Date();

  await ensureBasketballSport();

  const sourceId = `api-sports-basketball-games-${ingestionKey({ date, league, season, team, live })}`;
  await prisma.dataSource.upsert({
    where: { id: sourceId },
    update: {
      provider: "API-Sports Basketball",
      collectedAt,
      normalizedVersion: "api-sports-basketball-normalizer-0.1.0",
      rawPayload: {
        get: raw.get,
        parameters: raw.parameters,
        results: raw.results,
        paging: raw.paging,
      },
    },
    create: {
      id: sourceId,
      provider: "API-Sports Basketball",
      collectedAt,
      normalizedVersion: "api-sports-basketball-normalizer-0.1.0",
      rawPayload: {
        get: raw.get,
        parameters: raw.parameters,
        results: raw.results,
        paging: raw.paging,
      },
    },
  });

  for (const game of raw.response) {
    const normalized = normalizeBasketballGame(game);
    const persistedStatus = game.status.short === "FT" ? "completed" : normalized.status;
    const leagueId = `league-basketball-api-${game.league.id}`;
    const seasonNumber = Number(game.league.season);

    await prisma.league.upsert({
      where: { id: leagueId },
      update: {
        name: game.league.name,
        country: game.country.name ?? null,
        externalId: String(game.league.id),
        season: Number.isNaN(seasonNumber) ? null : seasonNumber,
        logoUrl: game.league.logo ?? null,
      },
      create: {
        id: leagueId,
        name: game.league.name,
        country: game.country.name ?? null,
        externalId: String(game.league.id),
        season: Number.isNaN(seasonNumber) ? null : seasonNumber,
        logoUrl: game.league.logo ?? null,
        sportId: "sport-basketball",
      },
    });

    for (const teamItem of [game.teams.home, game.teams.away]) {
      await prisma.participant.upsert({
        where: { id: `apisports-basketball-team-${teamItem.id}` },
        update: {
          name: teamItem.name,
          shortName: shortName(teamItem.name),
          country: game.country.name ?? null,
          logoUrl: teamItem.logo ?? null,
        },
        create: {
          id: `apisports-basketball-team-${teamItem.id}`,
          type: "team",
          name: teamItem.name,
          shortName: shortName(teamItem.name),
          slug: `api-sports-basketball-${teamItem.id}-${slugify(teamItem.name)}`,
          sportId: "sport-basketball",
          country: game.country.name ?? null,
          logoUrl: teamItem.logo ?? null,
          recentForm: [],
        },
      });
    }

    await prisma.event.upsert({
      where: { id: normalized.id },
      update: {
        externalId: String(game.id),
        startsAt: new Date(normalized.startsAt),
        status: persistedStatus,
        statusLabel: game.status.long,
        round: normalized.round ?? null,
        season: normalized.season ?? null,
        venue: normalized.venue,
        confidence: 0,
        rawPayload: game,
        leagueId,
        homeId: normalized.home.id,
        awayId: normalized.away.id,
        dataSourceId: sourceId,
      },
      create: {
        id: normalized.id,
        externalId: String(game.id),
        sportId: "sport-basketball",
        leagueId,
        startsAt: new Date(normalized.startsAt),
        status: persistedStatus,
        statusLabel: game.status.long,
        round: normalized.round ?? null,
        season: normalized.season ?? null,
        homeId: normalized.home.id,
        awayId: normalized.away.id,
        venue: normalized.venue,
        confidence: 0,
        rawPayload: game,
        dataSourceId: sourceId,
      },
    });
  }

  await prisma.providerIngestionLog.create({
    data: {
      id: `api-sports-basketball-games-${ingestionKey({ date, league, season, team, live })}-${Date.now()}`,
      provider: "API-Sports Basketball",
      resource: "games",
      params: { date, league, season, team, live },
      results: raw.results,
      status: "stored",
    },
  });

  console.log(`[api-sports:basketball] Stored ${raw.response.length} games in database.`);
}

async function main() {
  const requestedDate = readArg("date");
  const from = readArg("from");
  const days = Number(readArg("days") ?? 1);
  const league = readArg("league");
  const season = readArg("season");
  const team = readArg("team");
  const live = readArg("live");
  const dryRun = hasFlag("dry-run");
  const date = requestedDate ?? (!from && !league && !team && !live ? todayDate() : undefined);

  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Use --date=YYYY-MM-DD.");
  }
  if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    throw new Error("Use --from=YYYY-MM-DD.");
  }
  if (!Number.isInteger(days) || days < 1 || days > 7) {
    throw new Error("Use --days=1..7. Keep weekly ingestion bounded for the free quota.");
  }
  if (from && (league || team || live)) {
    throw new Error("Use --from/--days only for calendar windows. Do not combine with league, team or live.");
  }

  const plannedDates = from ? Array.from({ length: days }, (_, index) => addDays(from, index)) : [];
  const estimatedRequests = plannedDates.length || 1;

  if (!date && !from && !league && !team && !live) {
    throw new Error("Provide --date=YYYY-MM-DD, --from=YYYY-MM-DD --days=N, or a bounded filter like --league=12 --season=2025.");
  }

  console.log(
    `[api-sports:basketball] Planned requests=${estimatedRequests} ${plannedDates.length ? JSON.stringify(plannedDates) : ""}`,
  );
  if (dryRun) return;

  await prisma.$queryRaw`SELECT 1`;

  if (plannedDates.length > 0) {
    for (const item of plannedDates) {
      await ingestBasketballGames({ date: item });
    }
    return;
  }

  await ingestBasketballGames({ date, league, season, team, live });
}

main()
  .catch(async (error) => {
    console.error(error);
    await prisma.providerIngestionLog
      .create({
        data: {
          id: `api-sports-basketball-games-error-${Date.now()}`,
          provider: "API-Sports Basketball",
          resource: "games",
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
