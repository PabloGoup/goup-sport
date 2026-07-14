import { readFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

loadEnvConfig(process.cwd());

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to store TheSportsDB data.");
}

const adapter = new PrismaPg(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

const PROVIDER = "TheSportsDB";
const NORMALIZER = "thesportsdb-football-normalizer-0.1.0";
// Key de prueba publica y gratuita de TheSportsDB. Sin registro.
const API_KEY = process.env.THESPORTSDB_KEY ?? "3";
const BASE = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`;

// Fallback si no hay manifiesto: competiciones chilenas.
const FALLBACK_LEAGUES = ["5858", "4627", "5378"];

/** Lee todos los IDs de liga del manifiesto data/thesportsdb-leagues.json. */
function leaguesFromManifest(): string[] {
  try {
    const file = path.join(process.cwd(), "data", "thesportsdb-leagues.json");
    const parsed = JSON.parse(readFileSync(file, "utf8")) as { leagues?: Array<{ id?: string }> };
    const ids = (parsed.leagues ?? []).map((l) => l.id).filter((id): id is string => Boolean(id));
    return ids.length > 0 ? ids : FALLBACK_LEAGUES;
  } catch {
    return FALLBACK_LEAGUES;
  }
}

type TsdbEvent = {
  idEvent: string;
  dateEvent: string | null;
  strTime: string | null;
  strTimestamp: string | null;
  strHomeTeam: string | null;
  idHomeTeam: string | null;
  strHomeTeamBadge?: string | null;
  strAwayTeam: string | null;
  idAwayTeam: string | null;
  strAwayTeamBadge?: string | null;
  strLeague: string | null;
  idLeague: string | null;
  strSeason: string | null;
  strVenue: string | null;
  strStatus: string | null;
  strCountry?: string | null;
  intHomeScore: string | null;
  intAwayScore: string | null;
};

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
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN", "Match Finished"]);

function mapStatus(event: TsdbEvent, startsAt: Date): { status: string; completed: boolean } {
  const finished =
    (event.strStatus && FINISHED_STATUSES.has(event.strStatus)) ||
    (event.intHomeScore !== null && event.intAwayScore !== null && startsAt.getTime() < Date.now());
  if (finished) return { status: "completed", completed: true };

  const now = Date.now();
  const sameDay = new Date(startsAt).toDateString() === new Date(now).toDateString();
  if (startsAt.getTime() < now && !finished) return { status: "live", completed: false };
  return { status: sameDay ? "today" : "upcoming", completed: false };
}

async function fetchWithRetry(url: string, attempts = 3): Promise<TsdbEvent[] | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.status === 429) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      if (!response.ok) return null;
      const json = (await response.json()) as { events?: TsdbEvent[] | null };
      return json.events ?? [];
    } catch {
      await sleep(1500 * (attempt + 1));
    }
  }
  return null;
}

async function fetchLeagueEvents(leagueId: string): Promise<TsdbEvent[]> {
  const results: TsdbEvent[] = [];
  for (const endpoint of ["eventsnextleague", "eventspastleague"]) {
    const events = await fetchWithRetry(`${BASE}/${endpoint}.php?id=${leagueId}`);
    if (events) results.push(...events);
    // Pausa entre llamadas para respetar el rate limit de la key gratuita.
    await sleep(400);
  }
  return results;
}

async function ensureFootballSport() {
  await prisma.sport.upsert({
    where: { id: "sport-football" },
    update: { name: "Futbol" },
    create: { id: "sport-football", code: "football", name: "Futbol" },
  });
}

async function upsertEvent(event: TsdbEvent, sourceId: string, dryRun: boolean) {
  if (!event.strHomeTeam || !event.strAwayTeam || !event.idHomeTeam || !event.idAwayTeam) return "skip";
  const rawStamp = event.strTimestamp ?? (event.dateEvent ? `${event.dateEvent}T${event.strTime ?? "00:00:00"}` : null);
  if (!rawStamp) return "skip";
  // Los timestamps de TheSportsDB vienen en UTC; si no traen zona, la forzamos.
  const startsAtRaw = /[zZ]|[+-]\d{2}:?\d{2}$/.test(rawStamp) ? rawStamp : `${rawStamp}Z`;
  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) return "skip";

  const { status, completed } = mapStatus(event, startsAt);
  const leagueId = `thesportsdb-league-${event.idLeague}`;
  const homeId = `thesportsdb-team-${event.idHomeTeam}`;
  const awayId = `thesportsdb-team-${event.idAwayTeam}`;
  const eventId = `thesportsdb-event-${event.idEvent}`;

  const homeScore = event.intHomeScore !== null ? Number(event.intHomeScore) : null;
  const awayScore = event.intAwayScore !== null ? Number(event.intAwayScore) : null;

  if (dryRun) {
    console.log(
      `[thesportsdb] (dry) ${status.padEnd(8)} ${startsAt.toISOString().slice(0, 10)} ${event.strHomeTeam} vs ${event.strAwayTeam}`,
    );
    return status === "completed" ? "completed" : "upcoming";
  }

  await prisma.league.upsert({
    where: { id: leagueId },
    update: { name: event.strLeague ?? "Liga", country: event.strCountry ?? "Chile", externalId: event.idLeague, season: event.strSeason ? Number(event.strSeason) : null },
    create: {
      id: leagueId,
      name: event.strLeague ?? "Liga",
      country: event.strCountry ?? "Chile",
      externalId: event.idLeague,
      season: event.strSeason ? Number(event.strSeason) : null,
      sportId: "sport-football",
    },
  });

  for (const team of [
    { id: homeId, name: event.strHomeTeam, extId: event.idHomeTeam, logoUrl: event.strHomeTeamBadge },
    { id: awayId, name: event.strAwayTeam, extId: event.idAwayTeam, logoUrl: event.strAwayTeamBadge },
  ]) {
    await prisma.participant.upsert({
      where: { id: team.id },
      update: { name: team.name!, shortName: shortName(team.name!), logoUrl: team.logoUrl ?? null },
      create: {
        id: team.id,
        type: "team",
        name: team.name!,
        shortName: shortName(team.name!),
        slug: `thesportsdb-${team.extId}-${slugify(team.name!)}`,
        sportId: "sport-football",
        country: event.strCountry ?? "Chile",
        logoUrl: team.logoUrl ?? null,
        recentForm: [],
      },
    });
  }

  const rawPayload = {
    provider: PROVIDER,
    idEvent: event.idEvent,
    league: event.strLeague,
    season: event.strSeason,
    venue: event.strVenue,
    status: event.strStatus,
    // Formato leido por el motor de prediccion (scoresFromPayload).
    goals: { home: homeScore, away: awayScore },
    match: { home_score: homeScore, away_score: awayScore },
  };

  await prisma.event.upsert({
    where: { id: eventId },
    update: {
      externalId: event.idEvent,
      startsAt,
      status: status as never,
      statusLabel: event.strStatus,
      season: event.strSeason ? Number(event.strSeason) : null,
      venue: event.strVenue ?? "Sede pendiente",
      rawPayload,
      leagueId,
      homeId,
      awayId,
      dataSourceId: sourceId,
    },
    create: {
      id: eventId,
      externalId: event.idEvent,
      sportId: "sport-football",
      leagueId,
      startsAt,
      status: status as never,
      statusLabel: event.strStatus,
      season: event.strSeason ? Number(event.strSeason) : null,
      homeId,
      awayId,
      venue: event.strVenue ?? "Sede pendiente",
      confidence: 0,
      rawPayload,
      dataSourceId: sourceId,
    },
  });

  return completed ? "completed" : "upcoming";
}

async function main() {
  const leaguesArg = readArg("leagues");
  const leagues = leaguesArg
    ? leaguesArg.split(",").map((v) => v.trim()).filter(Boolean)
    : leaguesFromManifest();
  const dryRun = hasFlag("dry-run");
  console.log(`[thesportsdb] ${leagues.length} ligas a procesar${leaguesArg ? " (override)" : " (manifiesto)"}`);

  await prisma.$queryRaw`SELECT 1`;
  if (!dryRun) await ensureFootballSport();

  const collectedAt = new Date();
  const sourceId = `thesportsdb-football-${leagues.join("-")}`;
  if (!dryRun) {
    await prisma.dataSource.upsert({
      where: { id: sourceId },
      update: { provider: PROVIDER, collectedAt, normalizedVersion: NORMALIZER },
      create: { id: sourceId, provider: PROVIDER, collectedAt, normalizedVersion: NORMALIZER },
    });
  }

  let upcoming = 0;
  let completed = 0;
  for (const leagueId of leagues) {
    const events = await fetchLeagueEvents(leagueId);
    console.log(`[thesportsdb] liga ${leagueId}: ${events.length} eventos`);
    for (const event of events) {
      const result = await upsertEvent(event, sourceId, dryRun);
      if (result === "completed") completed += 1;
      else if (result === "upcoming") upcoming += 1;
    }
  }

  if (!dryRun) {
    await prisma.providerIngestionLog.create({
      data: {
        id: `thesportsdb-football-${leagues.join("-")}-${Date.now()}`,
        provider: PROVIDER,
        resource: "eventsnextleague+eventspastleague",
        params: { leagues },
        results: upcoming + completed,
        status: "stored",
      },
    });
  }

  console.log(`[thesportsdb] Listo. Proximos: ${upcoming} · Completados: ${completed}${dryRun ? " (dry-run, sin guardar)" : ""}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
