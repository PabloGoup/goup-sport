import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to store Football-Data.co.uk data.");
}

const adapter = new PrismaPg(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

const PROVIDER = "Football-Data.co.uk";
const NORMALIZER = "football-data-uk-normalizer-0.1.0";
const BASE = "https://www.football-data.co.uk/mmz4281";

// Ligas europeas con estadisticas detalladas (tiros, corners, faltas, tarjetas).
const DEFAULT_LEAGUES = ["E0", "SP1", "I1", "D1", "F1"];
const LEAGUE_NAMES: Record<string, { name: string; country: string }> = {
  E0: { name: "Premier League", country: "England" },
  SP1: { name: "La Liga", country: "Spain" },
  I1: { name: "Serie A", country: "Italy" },
  D1: { name: "Bundesliga", country: "Germany" },
  F1: { name: "Ligue 1", country: "France" },
  E1: { name: "Championship", country: "England" },
  N1: { name: "Eredivisie", country: "Netherlands" },
  P1: { name: "Primeira Liga", country: "Portugal" },
  B1: { name: "Jupiler League", country: "Belgium" },
  SC0: { name: "Scottish Premiership", country: "Scotland" },
};
const DEFAULT_SEASONS = ["2526", "2425", "2324"];

// Metricas por equipo que persistimos (nombre canonico -> par de columnas H/A).
const STAT_COLUMNS: Array<{ key: string; home: string; away: string }> = [
  { key: "shots", home: "HS", away: "AS" },
  { key: "shots_on_target", home: "HST", away: "AST" },
  { key: "corners", home: "HC", away: "AC" },
  { key: "fouls", home: "HF", away: "AF" },
  { key: "yellow_cards", home: "HY", away: "AY" },
  { key: "red_cards", home: "HR", away: "AR" },
];

function readArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function shortName(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 3).map((p) => p[0]).join("").toUpperCase();
}

/** Parser CSV simple con soporte de comillas (Football-Data no anida comas complejas). */
function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const parseLine = (line: string) => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === "," && !inQuotes) {
        cells.push(current);
        current = "";
      } else current += ch;
    }
    cells.push(current);
    return cells;
  };
  const header = parseLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = parseLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = (cells[i] ?? "").trim()));
    return row;
  });
}

/** Fecha Football-Data: DD/MM/YY o DD/MM/YYYY, hora opcional HH:MM. */
function parseDate(dateStr: string, timeStr?: string): Date | null {
  const m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += year < 50 ? 2000 : 1900;
  const [hh, mm] = (timeStr ?? "00:00").split(":").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hh || 0, mm || 0));
  return Number.isNaN(date.getTime()) ? null : date;
}

async function ensureFootballSport() {
  await prisma.sport.upsert({
    where: { id: "sport-football" },
    update: { name: "Futbol" },
    create: { id: "sport-football", code: "football", name: "Futbol" },
  });
}

async function ingestLeagueSeason(
  leagueCode: string,
  season: string,
  sourceId: string,
  dryRun: boolean,
): Promise<{ events: number; metrics: number }> {
  const url = `${BASE}/${season}/${leagueCode}.csv`;
  const response = await fetch(url);
  if (!response.ok) {
    console.warn(`[football-data] ${leagueCode} ${season}: HTTP ${response.status}`);
    return { events: 0, metrics: 0 };
  }
  const rows = parseCsv(await response.text());
  const meta = LEAGUE_NAMES[leagueCode] ?? { name: leagueCode, country: "Europe" };
  const leagueId = `football-data-${leagueCode}`;
  const seasonYear = 2000 + Number(season.slice(0, 2));

  let eventCount = 0;
  let metricCount = 0;

  if (!dryRun) {
    await prisma.league.upsert({
      where: { id: leagueId },
      update: { name: meta.name, country: meta.country, externalId: leagueCode, season: seasonYear },
      create: { id: leagueId, name: meta.name, country: meta.country, externalId: leagueCode, season: seasonYear, sportId: "sport-football" },
    });
  }

  for (const row of rows) {
    const home = row.HomeTeam;
    const away = row.AwayTeam;
    const startsAt = parseDate(row.Date, row.Time);
    const homeGoals = row.FTHG !== "" ? Number(row.FTHG) : null;
    const awayGoals = row.FTAG !== "" ? Number(row.FTAG) : null;
    if (!home || !away || !startsAt || homeGoals === null || awayGoals === null) continue;

    eventCount += 1;
    if (dryRun) continue;

    const homeId = `football-data-team-${slugify(home)}`;
    const awayId = `football-data-team-${slugify(away)}`;
    const eventId = `football-data-${leagueCode}-${season}-${slugify(home)}-${slugify(away)}-${startsAt.toISOString().slice(0, 10)}`;

    for (const team of [{ id: homeId, name: home }, { id: awayId, name: away }]) {
      await prisma.participant.upsert({
        where: { id: team.id },
        update: { name: team.name },
        create: {
          id: team.id,
          type: "team",
          name: team.name,
          shortName: shortName(team.name),
          slug: `football-data-${slugify(team.name)}`,
          sportId: "sport-football",
          country: meta.country,
          recentForm: [],
        },
      });
    }

    await prisma.event.upsert({
      where: { id: eventId },
      update: {
        startsAt,
        status: "completed",
        season: seasonYear,
        venue: `${meta.name}`,
        rawPayload: {
          provider: PROVIDER,
          goals: { home: homeGoals, away: awayGoals },
          halfTime: { home: row.HTHG ? Number(row.HTHG) : null, away: row.HTAG ? Number(row.HTAG) : null },
        },
        leagueId,
        homeId,
        awayId,
        dataSourceId: sourceId,
      },
      create: {
        id: eventId,
        externalId: eventId,
        sportId: "sport-football",
        leagueId,
        startsAt,
        status: "completed",
        statusLabel: "Match Finished",
        season: seasonYear,
        homeId,
        awayId,
        venue: `${meta.name}`,
        confidence: 0,
        rawPayload: {
          provider: PROVIDER,
          goals: { home: homeGoals, away: awayGoals },
          halfTime: { home: row.HTHG ? Number(row.HTHG) : null, away: row.HTAG ? Number(row.HTAG) : null },
        },
        dataSourceId: sourceId,
      },
    });

    // Estadisticas por equipo -> TeamMatchMetric (alimenta el modelo de stats).
    for (const stat of STAT_COLUMNS) {
      for (const side of [
        { participantId: homeId, col: stat.home },
        { participantId: awayId, col: stat.away },
      ]) {
        const raw = row[side.col];
        if (raw === undefined || raw === "") continue;
        const value = Number(raw);
        if (Number.isNaN(value)) continue;
        await prisma.teamMatchMetric.upsert({
          where: {
            eventId_participantId_metricKey_source_version: {
              eventId,
              participantId: side.participantId,
              metricKey: stat.key,
              source: PROVIDER,
              version: NORMALIZER,
            },
          },
          update: { metricValue: value },
          create: {
            id: `fduk-${eventId}-${side.participantId}-${stat.key}`,
            eventId,
            participantId: side.participantId,
            source: PROVIDER,
            version: NORMALIZER,
            metricKey: stat.key,
            metricValue: value,
          },
        });
        metricCount += 1;
      }
    }
  }

  console.log(`[football-data] ${leagueCode} ${season}: ${eventCount} partidos, ${metricCount} metricas`);
  return { events: eventCount, metrics: metricCount };
}

async function main() {
  const leagues = (readArg("leagues") ?? DEFAULT_LEAGUES.join(",")).split(",").map((v) => v.trim()).filter(Boolean);
  const seasons = (readArg("seasons") ?? DEFAULT_SEASONS.join(",")).split(",").map((v) => v.trim()).filter(Boolean);
  const dryRun = hasFlag("dry-run");

  await prisma.$queryRaw`SELECT 1`;
  if (!dryRun) await ensureFootballSport();

  const sourceId = "football-data-uk";
  if (!dryRun) {
    await prisma.dataSource.upsert({
      where: { id: sourceId },
      update: { provider: PROVIDER, collectedAt: new Date(), normalizedVersion: NORMALIZER },
      create: { id: sourceId, provider: PROVIDER, collectedAt: new Date(), normalizedVersion: NORMALIZER },
    });
  }

  let totalEvents = 0;
  let totalMetrics = 0;
  for (const league of leagues) {
    for (const season of seasons) {
      const { events, metrics } = await ingestLeagueSeason(league, season, sourceId, dryRun);
      totalEvents += events;
      totalMetrics += metrics;
    }
  }

  console.log(`[football-data] Listo. ${totalEvents} partidos, ${totalMetrics} metricas${dryRun ? " (dry-run)" : ""}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
