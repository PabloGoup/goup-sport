import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to store StatsBomb Open Data.");
}

const adapter = new PrismaPg(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

type StatsBombCompetition = {
  competition_id: number;
  season_id: number;
  country_name: string;
  competition_name: string;
  competition_gender: string;
  season_name: string;
  match_updated?: string;
  match_available?: string;
};

type StatsBombTeam = {
  home_team_id?: number;
  away_team_id?: number;
  home_team_name?: string;
  away_team_name?: string;
  country?: { name?: string };
};

type StatsBombMatch = {
  match_id: number;
  match_date: string;
  kick_off?: string | null;
  competition?: { competition_id?: number; competition_name?: string };
  season?: { season_id?: number; season_name?: string };
  home_team: StatsBombTeam;
  away_team: StatsBombTeam;
  home_score?: number | null;
  away_score?: number | null;
  match_status?: string;
  match_status_360?: string;
  stadium?: { name?: string; country?: { name?: string } };
  competition_stage?: { name?: string };
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
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function readJson<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

async function readJsonIfRequested<T>(filePath: string, includeRaw: boolean): Promise<T | null> {
  if (!includeRaw || !existsSync(filePath)) return null;
  return readJson<T>(filePath);
}

function fileInfo(filePath: string) {
  if (!existsSync(filePath)) {
    return {
      exists: false,
      bytes: 0,
    };
  }

  return {
    exists: true,
    bytes: statSync(filePath).size,
  };
}

function parseMatchDate(match: StatsBombMatch) {
  const kickOff = match.kick_off?.split(".")[0] ?? "00:00:00";
  return new Date(`${match.match_date}T${kickOff}Z`);
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

async function upsertTeam(teamId: number, name: string, country?: string) {
  await prisma.participant.upsert({
    where: { id: `statsbomb-football-team-${teamId}` },
    update: {
      name,
      shortName: shortName(name),
      country: country ?? null,
    },
    create: {
      id: `statsbomb-football-team-${teamId}`,
      type: "team",
      name,
      shortName: shortName(name),
      slug: `statsbomb-team-${teamId}-${slugify(name)}`,
      sportId: "sport-football",
      country: country ?? null,
      recentForm: [],
    },
  });
}

function assertNumber(value: string | undefined, label: string) {
  if (!value) throw new Error(`Provide --${label}=ID.`);
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`--${label} must be an integer.`);
  return parsed;
}

async function main() {
  const competitionId = assertNumber(readArg("competition"), "competition");
  const seasonId = assertNumber(readArg("season"), "season");
  const limit = readArg("limit") ? Number(readArg("limit")) : undefined;
  const includeRaw = readArg("include-raw") === "true";
  const { repoRoot, dataRoot } = repoDataPath();

  if (!existsSync(dataRoot)) {
    throw new Error(
      `StatsBomb Open Data not found at ${repoRoot}. Clone it first: git clone https://github.com/statsbomb/open-data.git data-providers/statsbomb-open-data`,
    );
  }

  await prisma.$queryRaw`SELECT 1`;
  await ensureFootballSport();

  const competitionsPath = path.join(dataRoot, "competitions.json");
  const matchesPath = path.join(dataRoot, "matches", String(competitionId), `${seasonId}.json`);
  const competitions = await readJson<StatsBombCompetition[]>(competitionsPath);
  const competition = competitions.find(
    (item) => item.competition_id === competitionId && item.season_id === seasonId,
  );

  if (!competition) {
    throw new Error(`Competition ${competitionId} season ${seasonId} was not found in competitions.json.`);
  }

  if (!existsSync(matchesPath)) {
    throw new Error(`Matches file not found: ${matchesPath}`);
  }

  const matches = await readJson<StatsBombMatch[]>(matchesPath);
  const selectedMatches = Number.isInteger(limit) ? matches.slice(0, limit) : matches;
  const collectedAt = new Date();
  const sourceId = `statsbomb-open-data-${competitionId}-${seasonId}`;
  const leagueId = `league-football-statsbomb-${competitionId}-${seasonId}`;

  await prisma.dataSource.upsert({
    where: { id: sourceId },
    update: {
      provider: "StatsBomb Open Data",
      collectedAt,
      normalizedVersion: "statsbomb-open-data-normalizer-0.1.0",
      rawPayload: toJson({ competition, sourceRepo: "https://github.com/statsbomb/open-data" }),
    },
    create: {
      id: sourceId,
      provider: "StatsBomb Open Data",
      collectedAt,
      normalizedVersion: "statsbomb-open-data-normalizer-0.1.0",
      rawPayload: toJson({ competition, sourceRepo: "https://github.com/statsbomb/open-data" }),
    },
  });

  await prisma.league.upsert({
    where: { id: leagueId },
    update: {
      name: competition.competition_name,
      country: competition.country_name,
      externalId: String(competition.competition_id),
      season: competition.season_id,
    },
    create: {
      id: leagueId,
      name: competition.competition_name,
      country: competition.country_name,
      externalId: String(competition.competition_id),
      season: competition.season_id,
      sportId: "sport-football",
    },
  });

  let stored = 0;

  for (const match of selectedMatches) {
    const homeId = match.home_team.home_team_id;
    const awayId = match.away_team.away_team_id;
    const homeName = match.home_team.home_team_name;
    const awayName = match.away_team.away_team_name;

    if (!homeId || !awayId || !homeName || !awayName) {
      console.warn(`[statsbomb] Skipping match ${match.match_id}: missing team data.`);
      continue;
    }

    const eventsPath = path.join(dataRoot, "events", `${match.match_id}.json`);
    const lineupsPath = path.join(dataRoot, "lineups", `${match.match_id}.json`);
    const threeSixtyPath = path.join(dataRoot, "three-sixty", `${match.match_id}.json`);

    const [events, lineups, threeSixty] = await Promise.all([
      readJsonIfRequested<unknown[]>(eventsPath, includeRaw),
      readJsonIfRequested<unknown[]>(lineupsPath, includeRaw),
      readJsonIfRequested<unknown[]>(threeSixtyPath, includeRaw),
    ]);
    const coverage = {
      events: fileInfo(eventsPath),
      lineups: fileInfo(lineupsPath),
      threeSixty: fileInfo(threeSixtyPath),
      rawEmbedded: includeRaw,
    };

    await upsertTeam(homeId, homeName, match.home_team.country?.name);
    await upsertTeam(awayId, awayName, match.away_team.country?.name);

    await prisma.event.upsert({
      where: { id: `statsbomb-match-${match.match_id}` },
      update: {
        externalId: String(match.match_id),
        startsAt: parseMatchDate(match),
        status: "completed",
        statusLabel: match.match_status ?? "available",
        round: match.competition_stage?.name ?? null,
        season: competition.season_id,
        homeId: `statsbomb-football-team-${homeId}`,
        awayId: `statsbomb-football-team-${awayId}`,
        venue: match.stadium?.name ?? "Venue unavailable",
        confidence: 0,
        rawPayload: toJson({
          match,
          coverage,
          events: includeRaw ? events : undefined,
          lineups: includeRaw ? lineups : undefined,
          threeSixty: includeRaw ? threeSixty : undefined,
        }),
        dataSourceId: sourceId,
      },
      create: {
        id: `statsbomb-match-${match.match_id}`,
        externalId: String(match.match_id),
        sportId: "sport-football",
        leagueId,
        startsAt: parseMatchDate(match),
        status: "completed",
        statusLabel: match.match_status ?? "available",
        round: match.competition_stage?.name ?? null,
        season: competition.season_id,
        homeId: `statsbomb-football-team-${homeId}`,
        awayId: `statsbomb-football-team-${awayId}`,
        venue: match.stadium?.name ?? "Venue unavailable",
        confidence: 0,
        rawPayload: toJson({
          match,
          coverage,
          events: includeRaw ? events : undefined,
          lineups: includeRaw ? lineups : undefined,
          threeSixty: includeRaw ? threeSixty : undefined,
        }),
        dataSourceId: sourceId,
      },
    });

    stored += 1;
    console.log(
      `[statsbomb] Stored ${match.match_id}: ${homeName} vs ${awayName} (${coverage.events.exists ? "events" : "no events"}, ${coverage.lineups.exists ? "lineups" : "no lineups"}, ${coverage.threeSixty.exists ? "360" : "no 360"}, raw=${includeRaw ? "embedded" : "metadata-only"})`,
    );
  }

  await prisma.providerIngestionLog.create({
    data: {
      id: `statsbomb-open-data-${competitionId}-${seasonId}-${Date.now()}`,
      provider: "StatsBomb Open Data",
      resource: "matches/events/lineups",
      params: { competition: competitionId, season: seasonId, limit: limit ?? null, includeRaw },
      results: stored,
      status: "stored",
    },
  });

  console.log(`[statsbomb] Stored ${stored}/${selectedMatches.length} matches from ${competition.competition_name} ${competition.season_name}.`);
}

main()
  .catch(async (error) => {
    console.error(error);
    await prisma.providerIngestionLog
      .create({
        data: {
          id: `statsbomb-open-data-error-${Date.now()}`,
          provider: "StatsBomb Open Data",
          resource: "matches/events/lineups",
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
