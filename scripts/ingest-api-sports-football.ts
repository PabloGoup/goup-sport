import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getFootballFixtures } from "../src/infrastructure/api-sports/client";
import { normalizeFootballFixture } from "../src/infrastructure/api-sports/normalizers";

loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to store API-Sports data.");
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

function ingestionKey(params: {
  date?: string;
  from?: string;
  to?: string;
  league?: string;
  season?: string;
  team?: string;
  next?: string;
  live?: string;
}) {
  return [
    params.date ? `date-${params.date}` : null,
    params.from ? `from-${params.from}` : null,
    params.to ? `to-${params.to}` : null,
    params.league ? `league-${params.league}` : null,
    params.season ? `season-${params.season}` : null,
    params.team ? `team-${params.team}` : null,
    params.next ? `next-${params.next}` : null,
    params.live ? `live-${params.live}` : null,
  ]
    .filter(Boolean)
    .join("-");
}

async function ensureFootballSport() {
  await prisma.sport.upsert({
    where: { id: "sport-football" },
    update: { name: "Futbol" },
    create: {
      id: "sport-football",
      code: "football",
      name: "Futbol",
    },
  });
}

async function main() {
  const requestedDate = readArg("date");
  const from = readArg("from");
  const to = readArg("to");
  const league = readArg("league");
  const season = readArg("season");
  const team = readArg("team");
  const next = readArg("next");
  const live = readArg("live");
  const date = requestedDate ?? (!league && !from && !to && !next && !live ? todayDate() : undefined);

  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Use --date=YYYY-MM-DD.");
  }

  if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to))) {
    throw new Error("Use --from=YYYY-MM-DD and --to=YYYY-MM-DD.");
  }

  if ((from && !to) || (!from && to)) {
    throw new Error("Use --from=YYYY-MM-DD and --to=YYYY-MM-DD together.");
  }

  if (next && !/^\d+$/.test(next)) {
    throw new Error("Use --next with a positive number.");
  }

  if (!date && !from && !to && !league && !team && !next && !live) {
    throw new Error("Provide --date=YYYY-MM-DD, --from=YYYY-MM-DD --to=YYYY-MM-DD, --next=50, or a bounded filter like --league=1 --season=2026.");
  }

  await prisma.$queryRaw`SELECT 1`;

  console.log(
    `[api-sports] One request: fixtures ${JSON.stringify({ date, from, to, league, season, team, next, live })}`,
  );
  const raw = await getFootballFixtures({ date, from, to, league, season, team, next, live });
  const collectedAt = new Date();

  await ensureFootballSport();

  const sourceId = `api-sports-football-fixtures-${ingestionKey({ date, from, to, league, season, team, next, live })}`;
  await prisma.dataSource.upsert({
    where: { id: sourceId },
    update: {
      provider: "API-Sports Football",
      collectedAt,
      normalizedVersion: "api-sports-football-normalizer-0.1.0",
      rawPayload: {
        get: raw.get,
        parameters: raw.parameters,
        results: raw.results,
        paging: raw.paging,
      },
    },
    create: {
      id: sourceId,
      provider: "API-Sports Football",
      collectedAt,
      normalizedVersion: "api-sports-football-normalizer-0.1.0",
      rawPayload: {
        get: raw.get,
        parameters: raw.parameters,
        results: raw.results,
        paging: raw.paging,
      },
    },
  });

  for (const fixture of raw.response) {
    const normalized = normalizeFootballFixture(fixture);
    const leagueId = `league-football-api-${fixture.league.id}`;
    const homeId = normalized.home.id;
    const awayId = normalized.away.id;

    await prisma.league.upsert({
      where: { id: leagueId },
      update: {
        name: fixture.league.name,
        country: fixture.league.country ?? null,
        externalId: String(fixture.league.id),
        season: fixture.league.season,
      },
      create: {
        id: leagueId,
        name: fixture.league.name,
        country: fixture.league.country ?? null,
        externalId: String(fixture.league.id),
        season: fixture.league.season,
        sportId: "sport-football",
      },
    });

    for (const team of [fixture.teams.home, fixture.teams.away]) {
      await prisma.participant.upsert({
        where: { id: `apisports-football-team-${team.id}` },
        update: {
          name: team.name,
          shortName: shortName(team.name),
          country: fixture.league.country ?? null,
          logoUrl: team.logo ?? null,
        },
        create: {
          id: `apisports-football-team-${team.id}`,
          type: "team",
          name: team.name,
          shortName: shortName(team.name),
          slug: `api-sports-${team.id}-${slugify(team.name)}`,
          sportId: "sport-football",
          country: fixture.league.country ?? null,
          logoUrl: team.logo ?? null,
          recentForm: [],
        },
      });
    }

    await prisma.event.upsert({
      where: { id: normalized.id },
      update: {
        externalId: String(fixture.fixture.id),
        startsAt: new Date(fixture.fixture.date),
        status: normalized.status,
        statusLabel: fixture.fixture.status.long,
        round: fixture.league.round ?? null,
        season: fixture.league.season,
        venue: normalized.venue,
        confidence: 0,
        rawPayload: fixture,
        leagueId,
        homeId,
        awayId,
        dataSourceId: sourceId,
      },
      create: {
        id: normalized.id,
        externalId: String(fixture.fixture.id),
        sportId: "sport-football",
        leagueId,
        startsAt: new Date(fixture.fixture.date),
        status: normalized.status,
        statusLabel: fixture.fixture.status.long,
        round: fixture.league.round ?? null,
        season: fixture.league.season,
        homeId,
        awayId,
        venue: normalized.venue,
        confidence: 0,
        rawPayload: fixture,
        dataSourceId: sourceId,
      },
    });
  }

  await prisma.providerIngestionLog.create({
    data: {
      id: `api-sports-football-fixtures-${ingestionKey({ date, from, to, league, season, team, next, live })}-${Date.now()}`,
      provider: "API-Sports Football",
      resource: "fixtures",
      params: { date, from, to, league, season, team, next, live },
      results: raw.results,
      status: "stored",
    },
  });

  console.log(`[api-sports] Stored ${raw.response.length} fixtures in database.`);
}

main()
  .catch(async (error) => {
    console.error(error);
    await prisma.providerIngestionLog
      .create({
        data: {
          id: `api-sports-football-fixtures-error-${Date.now()}`,
          provider: "API-Sports Football",
          resource: "fixtures",
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
