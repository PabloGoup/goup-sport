import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to store tennis open data.");
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

function parseCsv(content: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [headers = [], ...data] = rows;
  return data.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function dateFromTournamentDate(value: string) {
  if (!/^\d{8}$/.test(value)) return new Date(`${new Date().getFullYear()}-01-01T00:00:00Z`);
  return new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00Z`);
}

async function ensureTennisSport() {
  await prisma.sport.upsert({
    where: { id: "sport-tennis" },
    update: { name: "Tenis" },
    create: {
      id: "sport-tennis",
      code: "tennis",
      name: "Tenis",
    },
  });
}

async function upsertPlayer(id: string, name: string, country?: string) {
  await prisma.participant.upsert({
    where: { id },
    update: {
      name,
      shortName: shortName(name),
      country: country || null,
      nationality: country || null,
    },
    create: {
      id,
      type: "player",
      name,
      shortName: shortName(name),
      slug: `${slugify(id)}-${slugify(name)}`,
      sportId: "sport-tennis",
      country: country || null,
      nationality: country || null,
      recentForm: [],
    },
  });
}

async function main() {
  const tour = readArg("tour") ?? "atp";
  const year = readArg("year") ?? String(new Date().getFullYear());
  const limit = readArg("limit") ? Number(readArg("limit")) : undefined;
  const repo = readArg("repo") ?? `data-providers/tennis_${tour}`;
  const file = readArg("file") ?? `${tour}_matches_${year}.csv`;
  const csvPath = path.resolve(process.cwd(), repo, file);

  if (!["atp", "wta"].includes(tour)) {
    throw new Error("Use --tour=atp or --tour=wta.");
  }

  if (!existsSync(csvPath)) {
    throw new Error(
      `Jeff Sackmann CSV not found at ${csvPath}. Clone the repo first, for example: git clone https://github.com/JeffSackmann/tennis_atp.git data-providers/tennis_atp`,
    );
  }

  await prisma.$queryRaw`SELECT 1`;
  await ensureTennisSport();

  const content = await readFile(csvPath, "utf8");
  const rows = parseCsv(content);
  const selectedRows = Number.isInteger(limit) ? rows.slice(0, limit) : rows;
  const sourceId = `jeff-sackmann-${tour}-matches-${year}`;

  await prisma.dataSource.upsert({
    where: { id: sourceId },
    update: {
      provider: "Jeff Sackmann Tennis Data",
      collectedAt: new Date(),
      normalizedVersion: "jeff-sackmann-tennis-normalizer-0.1.0",
      rawPayload: { repo, file, rows: rows.length },
    },
    create: {
      id: sourceId,
      provider: "Jeff Sackmann Tennis Data",
      collectedAt: new Date(),
      normalizedVersion: "jeff-sackmann-tennis-normalizer-0.1.0",
      rawPayload: { repo, file, rows: rows.length },
    },
  });

  let stored = 0;

  for (const row of selectedRows) {
    const matchId = row.match_id || `${tour}-${year}-${row.tourney_id}-${row.match_num}`;
    const leagueId = `league-tennis-jeff-${slugify(row.tourney_id || row.tourney_name || "unknown")}`;
    const leagueName = row.tourney_name || "Tennis Open Data";
    const winnerName = row.winner_name;
    const loserName = row.loser_name;
    const winnerId = row.winner_id ? `jeff-tennis-player-${row.winner_id}` : `jeff-tennis-player-${slugify(winnerName)}`;
    const loserId = row.loser_id ? `jeff-tennis-player-${row.loser_id}` : `jeff-tennis-player-${slugify(loserName)}`;

    if (!winnerName || !loserName) continue;

    await prisma.league.upsert({
      where: { id: leagueId },
      update: {
        name: leagueName,
        country: row.tourney_level || null,
        externalId: row.tourney_id || null,
        season: Number(year),
      },
      create: {
        id: leagueId,
        name: leagueName,
        country: row.tourney_level || null,
        externalId: row.tourney_id || null,
        season: Number(year),
        sportId: "sport-tennis",
      },
    });

    await upsertPlayer(winnerId, winnerName, row.winner_ioc);
    await upsertPlayer(loserId, loserName, row.loser_ioc);

    await prisma.event.upsert({
      where: { id: `jeff-tennis-match-${matchId}` },
      update: {
        externalId: matchId,
        startsAt: dateFromTournamentDate(row.tourney_date),
        status: "completed",
        statusLabel: "Historical",
        round: row.round || null,
        season: Number(year),
        homeId: winnerId,
        awayId: loserId,
        venue: row.surface || "Surface unavailable",
        confidence: 0,
        rawPayload: row,
        leagueId,
        dataSourceId: sourceId,
      },
      create: {
        id: `jeff-tennis-match-${matchId}`,
        externalId: matchId,
        sportId: "sport-tennis",
        leagueId,
        startsAt: dateFromTournamentDate(row.tourney_date),
        status: "completed",
        statusLabel: "Historical",
        round: row.round || null,
        season: Number(year),
        homeId: winnerId,
        awayId: loserId,
        venue: row.surface || "Surface unavailable",
        confidence: 0,
        rawPayload: row,
        dataSourceId: sourceId,
      },
    });

    stored += 1;
  }

  await prisma.providerIngestionLog.create({
    data: {
      id: `jeff-sackmann-${tour}-${year}-${Date.now()}`,
      provider: "Jeff Sackmann Tennis Data",
      resource: "matches",
      params: { tour, year, repo, file, limit: limit ?? null },
      results: stored,
      status: "stored",
    },
  });

  console.log(`[tennis:jeff-sackmann] Stored ${stored}/${selectedRows.length} ${tour.toUpperCase()} matches from ${year}.`);
}

main()
  .catch(async (error) => {
    console.error(error);
    await prisma.providerIngestionLog
      .create({
        data: {
          id: `jeff-sackmann-error-${Date.now()}`,
          provider: "Jeff Sackmann Tennis Data",
          resource: "matches",
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
