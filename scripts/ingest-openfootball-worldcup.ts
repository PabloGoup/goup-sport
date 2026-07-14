import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to store OpenFootball data.");
}

const sourceUrl = "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";
const provider = "OpenFootball";
const sourceId = "openfootball-worldcup-2026";
const sportId = "sport-football";
const leagueId = "openfootball-world-cup-2026";

const adapter = new PrismaPg(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

type OpenFootballGoal = {
  name: string;
  minute?: string;
};

type OpenFootballMatch = {
  round: string;
  num?: number;
  date: string;
  time: string;
  team1: string;
  team2: string;
  ground?: string;
  score?: {
    ft?: [number, number];
    et?: [number, number];
    p?: [number, number];
    ht?: [number, number];
  };
  goals1?: OpenFootballGoal[];
  goals2?: OpenFootballGoal[];
};

type OpenFootballWorldCup = {
  name: string;
  matches: OpenFootballMatch[];
};

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

function startsAt(match: OpenFootballMatch) {
  const timeMatch = match.time.match(/^(\d{1,2}):(\d{2})\s+UTC([+-]\d{1,2})$/);
  if (!timeMatch) return new Date(`${match.date}T12:00:00Z`);

  const [, hour, minute, offset] = timeMatch;
  const offsetNumber = Number(offset);
  const normalizedOffset = `${offsetNumber >= 0 ? "+" : "-"}${String(Math.abs(offsetNumber)).padStart(2, "0")}:00`;
  return new Date(`${match.date}T${hour.padStart(2, "0")}:${minute}:00${normalizedOffset}`);
}

function finalScore(match: OpenFootballMatch) {
  return match.score?.p ?? match.score?.et ?? match.score?.ft ?? null;
}

function teamId(name: string) {
  return `openfootball-football-team-${slugify(name)}`;
}

function matchStableKey(match: OpenFootballMatch) {
  return match.num ? String(match.num) : slugify(`${match.date}-${match.team1}-${match.team2}`);
}

function matchEventId(match: OpenFootballMatch) {
  return `openfootball-worldcup-2026-match-${matchStableKey(match)}`;
}

async function ensureBase(raw: OpenFootballWorldCup) {
  const collectedAt = new Date();

  await prisma.sport.upsert({
    where: { id: sportId },
    update: { name: "Futbol" },
    create: {
      id: sportId,
      code: "football",
      name: "Futbol",
    },
  });

  await prisma.league.upsert({
    where: { id: leagueId },
    update: {
      name: "World Cup",
      country: "World",
      externalId: "fifa-world-cup-2026",
      season: 2026,
    },
    create: {
      id: leagueId,
      name: "World Cup",
      country: "World",
      externalId: "fifa-world-cup-2026",
      season: 2026,
      sportId,
    },
  });

  await prisma.dataSource.upsert({
    where: { id: sourceId },
    update: {
      provider,
      collectedAt,
      normalizedVersion: "openfootball-worldcup-normalizer-0.1.0",
      rawPayload: {
        name: raw.name,
        sourceUrl,
        matches: raw.matches.length,
      },
    },
    create: {
      id: sourceId,
      provider,
      collectedAt,
      normalizedVersion: "openfootball-worldcup-normalizer-0.1.0",
      rawPayload: {
        name: raw.name,
        sourceUrl,
        matches: raw.matches.length,
      },
    },
  });
}

async function upsertTeam(name: string) {
  await prisma.participant.upsert({
    where: { id: teamId(name) },
    update: {
      name,
      shortName: shortName(name),
      country: name,
    },
    create: {
      id: teamId(name),
      type: "team",
      name,
      shortName: shortName(name),
      slug: `openfootball-${slugify(name)}`,
      sportId,
      country: name,
      recentForm: [],
    },
  });
}

async function main() {
  await prisma.$queryRaw`SELECT 1`;

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`OpenFootball request failed: ${response.status}`);
  }

  const raw = (await response.json()) as OpenFootballWorldCup;
  await ensureBase(raw);

  let stored = 0;

  for (const match of raw.matches) {
    if (/^[WL]\d+$/i.test(match.team1) || /^[WL]\d+$/i.test(match.team2)) continue;

    await upsertTeam(match.team1);
    await upsertTeam(match.team2);

    const score = finalScore(match);
    const status = score ? "completed" : "upcoming";

    const id = matchEventId(match);
    const externalId = match.num ? String(match.num) : `openfootball-${matchStableKey(match)}`;

    await prisma.event.upsert({
      where: { id },
      update: {
        externalId,
        startsAt: startsAt(match),
        status,
        statusLabel: score ? "Match Finished" : "Programado",
        round: match.round,
        season: 2026,
        homeId: teamId(match.team1),
        awayId: teamId(match.team2),
        venue: match.ground ?? "Sede pendiente",
        rawPayload: {
          provider,
          sourceUrl,
          match,
          goals: {
            home: score?.[0] ?? null,
            away: score?.[1] ?? null,
          },
        },
        dataSourceId: sourceId,
      },
      create: {
        id,
        externalId,
        sportId,
        leagueId,
        startsAt: startsAt(match),
        status,
        statusLabel: score ? "Match Finished" : "Programado",
        round: match.round,
        season: 2026,
        homeId: teamId(match.team1),
        awayId: teamId(match.team2),
        venue: match.ground ?? "Sede pendiente",
        confidence: 0,
        rawPayload: {
          provider,
          sourceUrl,
          match,
          goals: {
            home: score?.[0] ?? null,
            away: score?.[1] ?? null,
          },
        },
        dataSourceId: sourceId,
      },
    });

    stored += 1;
  }

  await prisma.event.deleteMany({
    where: {
      id: {
        in: [
          "calendar-football-worldcup-2026-france-spain",
          "calendar-football-worldcup-2026-england-argentina",
        ],
      },
      dataSourceId: "goup-calendar-example",
    },
  });

  await prisma.providerIngestionLog.create({
    data: {
      id: `${sourceId}-${Date.now()}`,
      provider,
      resource: "worldcup-2026",
      params: { sourceUrl },
      results: stored,
      status: "stored",
    },
  });

  console.log(`[openfootball] Stored ${stored} World Cup 2026 matches.`);
}

main()
  .catch(async (error) => {
    console.error(error);
    await prisma.providerIngestionLog
      .create({
        data: {
          id: `${sourceId}-error-${Date.now()}`,
          provider,
          resource: "worldcup-2026",
          params: { sourceUrl },
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
