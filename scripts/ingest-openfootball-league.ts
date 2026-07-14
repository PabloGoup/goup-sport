import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to store OpenFootball data.");
}

const provider = "OpenFootball";
const sportId = "sport-football";
const adapter = new PrismaPg(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

type OpenFootballScore = [number, number] | {
  ft?: [number, number];
  et?: [number, number];
  p?: [number, number];
  ht?: [number, number];
};

type OpenFootballMatch = {
  round: string;
  num?: number;
  date: string;
  time?: string;
  team1: string;
  team2: string;
  score?: OpenFootballScore;
  ground?: string;
};

type OpenFootballLeague = {
  name: string;
  matches: OpenFootballMatch[];
};

const monthNumbers: Record<string, number> = {
  Jan: 1,
  January: 1,
  Feb: 2,
  February: 2,
  Mar: 3,
  March: 3,
  Apr: 4,
  April: 4,
  May: 5,
  Jun: 6,
  June: 6,
  Jul: 7,
  July: 7,
  Aug: 8,
  August: 8,
  Sep: 9,
  Sept: 9,
  September: 9,
  Oct: 10,
  October: 10,
  Nov: 11,
  November: 11,
  Dec: 12,
  December: 12,
};

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
    .replace(/\b(fc|afc|cf|sc|ac|club)\b/gi, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function parseScore(score?: OpenFootballScore) {
  if (!score) return null;
  if (Array.isArray(score)) return score;
  return score.p ?? score.et ?? score.ft ?? null;
}

function parseScoreText(value: string): [number, number] | undefined {
  const match = value.match(/\b(\d+)-(\d+)(?:\s+\(\d+-\d+\))?\s*$/);
  if (!match) return undefined;
  return [Number(match[1]), Number(match[2])];
}

function normalizeDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseOpenFootballText(content: string, fallbackName: string, fallbackSeason?: number): OpenFootballLeague {
  const lines = content.split(/\r?\n/);
  const title = lines.find((line) => line.startsWith("="))?.replace(/^=\s*/, "").trim() || fallbackName;
  const dateRange = lines.find((line) => line.startsWith("# Date"));
  const rangeYear = dateRange?.match(/\b(19|20)\d{2}\b/)?.[0];
  let currentYear = fallbackSeason ?? (rangeYear ? Number(rangeYear) : new Date().getUTCFullYear());
  let currentMonth = 1;
  let currentDate = "";
  let currentRound = "Regular Season";
  const matches: OpenFootballMatch[] = [];

  for (const line of lines) {
    const trimmed = line.trimEnd();
    const roundMatch = trimmed.match(/^▪\s+(.+)$/);
    if (roundMatch) {
      currentRound = roundMatch[1].trim();
      continue;
    }

    const dateMatch = trimmed.trim().match(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Z][a-z]+)\s+(\d{1,2})(?:\s+((?:19|20)\d{2}))?$/);
    if (dateMatch) {
      const month = monthNumbers[dateMatch[1]];
      const explicitYear = dateMatch[3] ? Number(dateMatch[3]) : undefined;
      if (explicitYear) currentYear = explicitYear;
      if (month) {
        if (!explicitYear && currentMonth > 10 && month < 3) currentYear += 1;
        currentMonth = month;
        currentDate = normalizeDate(currentYear, month, Number(dateMatch[2]));
      }
      continue;
    }

    if (!currentDate) continue;

    const matchLine = trimmed.trim();
    if (!matchLine || matchLine.startsWith("#") || matchLine.startsWith("=")) continue;

    const withVersus = matchLine.match(/^(?:(\d{1,2}:\d{2})\s+)?(.+?)\s+v\s+(.+?)(?:\s+(\d+-\d+(?:\s+\(\d+-\d+\))?))?$/);
    if (withVersus) {
      const [, time, team1, team2, scoreText] = withVersus;
      matches.push({
        round: currentRound,
        date: currentDate,
        time,
        team1: team1.trim(),
        team2: team2.trim(),
        score: parseScoreText(scoreText ?? ""),
      });
      continue;
    }

    const withInlineScore = matchLine.match(/^(?:(\d{1,2}:\d{2})(?:\s+UTC[+-]\d+)?\s+)?(.+?)\s+(\d+-\d+(?:\s+\(\d+-\d+\))?)\s+(.+?)(?:\s+@\s+(.+))?$/);
    if (withInlineScore) {
      const [, time, team1, scoreText, team2, ground] = withInlineScore;
      matches.push({
        round: currentRound,
        date: currentDate,
        time,
        team1: team1.trim(),
        team2: team2.trim(),
        score: parseScoreText(scoreText),
        ground: ground?.trim(),
      });
    }
  }

  return { name: title, matches };
}

function startsAt(match: OpenFootballMatch) {
  if (!match.time) return new Date(`${match.date}T12:00:00Z`);
  return new Date(`${match.date}T${match.time.padStart(5, "0")}:00Z`);
}

function teamId(sourceKey: string, name: string) {
  return `openfootball-${sourceKey}-team-${slugify(name)}`;
}

function matchKey(match: OpenFootballMatch) {
  return match.num ? String(match.num) : slugify(`${match.date}-${match.team1}-${match.team2}`);
}

async function ensureBase(params: {
  sourceId: string;
  leagueId: string;
  sourceUrl: string;
  leagueName: string;
  country?: string;
  season?: number;
  matchCount: number;
}) {
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
    where: { id: params.leagueId },
    update: {
      name: params.leagueName,
      country: params.country ?? null,
      externalId: params.sourceId,
      season: params.season ?? null,
    },
    create: {
      id: params.leagueId,
      name: params.leagueName,
      country: params.country ?? null,
      externalId: params.sourceId,
      season: params.season ?? null,
      sportId,
    },
  });

  await prisma.dataSource.upsert({
    where: { id: params.sourceId },
    update: {
      provider,
      collectedAt,
      normalizedVersion: "openfootball-league-normalizer-0.1.0",
      rawPayload: {
        sourceUrl: params.sourceUrl,
        league: params.leagueName,
        matches: params.matchCount,
      },
    },
    create: {
      id: params.sourceId,
      provider,
      collectedAt,
      normalizedVersion: "openfootball-league-normalizer-0.1.0",
      rawPayload: {
        sourceUrl: params.sourceUrl,
        league: params.leagueName,
        matches: params.matchCount,
      },
    },
  });
}

async function upsertTeam(sourceKey: string, name: string, country?: string) {
  await prisma.participant.upsert({
    where: { id: teamId(sourceKey, name) },
    update: {
      name,
      shortName: shortName(name),
      country: country ?? null,
    },
    create: {
      id: teamId(sourceKey, name),
      type: "team",
      name,
      shortName: shortName(name),
      slug: `openfootball-${sourceKey}-${slugify(name)}`,
      sportId,
      country: country ?? null,
      recentForm: [],
    },
  });
}

async function main() {
  const sourceUrl = readArg("url");
  if (!sourceUrl) throw new Error("Use --url=https://openfootball.github.io/...");

  const country = readArg("country");
  const season = readArg("season") ? Number(readArg("season")) : undefined;
  const leagueNameArg = readArg("league");
  const sourceKey = readArg("key") ?? slugify(sourceUrl.replace(/^https?:\/\//, ""));
  const sourceId = `openfootball-${sourceKey}`;
  const leagueId = `league-openfootball-${sourceKey}`;

  await prisma.$queryRaw`SELECT 1`;

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`OpenFootball request failed: ${response.status} ${sourceUrl}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const raw = sourceUrl.endsWith(".txt") || !contentType.includes("json")
    ? parseOpenFootballText(await response.text(), leagueNameArg ?? sourceKey, season)
    : ((await response.json()) as OpenFootballLeague);
  const leagueName = leagueNameArg ?? raw.name;

  await ensureBase({
    sourceId,
    leagueId,
    sourceUrl,
    leagueName,
    country,
    season,
    matchCount: raw.matches.length,
  });

  let stored = 0;

  for (const match of raw.matches) {
    await upsertTeam(sourceKey, match.team1, country);
    await upsertTeam(sourceKey, match.team2, country);

    const score = parseScore(match.score);
    const id = `openfootball-${sourceKey}-match-${matchKey(match)}`;

    await prisma.event.upsert({
      where: { id },
      update: {
        externalId: matchKey(match),
        startsAt: startsAt(match),
        status: score ? "completed" : "upcoming",
        statusLabel: score ? "Match Finished" : "Programado",
        round: match.round,
        season: season ?? null,
        homeId: teamId(sourceKey, match.team1),
        awayId: teamId(sourceKey, match.team2),
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
        externalId: matchKey(match),
        sportId,
        leagueId,
        startsAt: startsAt(match),
        status: score ? "completed" : "upcoming",
        statusLabel: score ? "Match Finished" : "Programado",
        round: match.round,
        season: season ?? null,
        homeId: teamId(sourceKey, match.team1),
        awayId: teamId(sourceKey, match.team2),
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

  await prisma.providerIngestionLog.create({
    data: {
      id: `${sourceId}-${Date.now()}`,
      provider,
      resource: "league-json",
      params: { sourceUrl, league: leagueName, country: country ?? null, season: season ?? null },
      results: stored,
      status: "stored",
    },
  });

  console.log(`[openfootball] Stored ${stored} matches from ${leagueName}.`);
}

main()
  .catch(async (error) => {
    console.error(error);
    await prisma.providerIngestionLog
      .create({
        data: {
          id: `openfootball-league-error-${Date.now()}`,
          provider,
          resource: "league-json",
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
