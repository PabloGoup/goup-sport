import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";

loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to store calendar data.");
}

const adapter = new PrismaPg(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

const eventSchema = z.object({
  id: z.string().min(1).optional(),
  externalId: z.string().min(1).optional(),
  sport: z.enum(["football", "basketball", "tennis"]),
  league: z.string().min(1),
  leagueId: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  season: z.number().int().optional(),
  round: z.string().min(1).optional(),
  startsAt: z.string().datetime({ offset: true }),
  status: z.enum(["live", "today", "upcoming", "completed", "postponed"]).default("upcoming"),
  statusLabel: z.string().min(1).optional(),
  venue: z.string().min(1).default("Sede pendiente"),
  home: z.object({
    name: z.string().min(1),
    id: z.string().min(1).optional(),
    shortName: z.string().min(1).optional(),
    country: z.string().min(1).optional(),
    logoUrl: z.string().url().optional(),
    type: z.enum(["team", "player"]).optional(),
  }),
  away: z.object({
    name: z.string().min(1),
    id: z.string().min(1).optional(),
    shortName: z.string().min(1).optional(),
    country: z.string().min(1).optional(),
    logoUrl: z.string().url().optional(),
    type: z.enum(["team", "player"]).optional(),
  }),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const fileSchema = z.object({
  provider: z.string().min(1).default("GOUP Calendar"),
  sourceId: z.string().min(1).optional(),
  collectedAt: z.string().datetime({ offset: true }).optional(),
  events: z.array(eventSchema),
});

type CalendarEvent = z.infer<typeof eventSchema>;

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

function sportName(code: CalendarEvent["sport"]) {
  if (code === "football") return "Futbol";
  if (code === "basketball") return "Basketball";
  return "Tenis";
}

function defaultParticipantType(code: CalendarEvent["sport"]) {
  return code === "tennis" ? "player" : "team";
}

function eventId(event: CalendarEvent) {
  if (event.id) return event.id;

  return `calendar-${event.sport}-${slugify([
    event.league,
    event.round,
    event.home.name,
    event.away.name,
    event.startsAt,
  ].filter(Boolean).join("-"))}`;
}

function leagueId(event: CalendarEvent) {
  return event.leagueId ?? `calendar-league-${event.sport}-${slugify(`${event.country ?? "global"}-${event.league}-${event.season ?? "current"}`)}`;
}

function participantId(event: CalendarEvent, side: "home" | "away") {
  const participant = event[side];
  return participant.id ?? `calendar-${event.sport}-${defaultParticipantType(event.sport)}-${slugify(participant.name)}`;
}

function rawPayload(provider: string, metadata?: Record<string, unknown>): Prisma.InputJsonObject {
  return {
    provider,
    metadata: metadata ? (JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonObject) : {},
  };
}

async function ensureSport(code: CalendarEvent["sport"]) {
  await prisma.sport.upsert({
    where: { code },
    update: { name: sportName(code) },
    create: {
      id: `sport-${code}`,
      code,
      name: sportName(code),
    },
  });
}

async function main() {
  const file = readArg("file");
  if (!file) throw new Error("Use --file=path/to/calendar.json.");

  const filePath = path.resolve(process.cwd(), file);
  const parsed = fileSchema.parse(JSON.parse(await readFile(filePath, "utf8")));
  const collectedAt = parsed.collectedAt ? new Date(parsed.collectedAt) : new Date();
  const sourceId = parsed.sourceId ?? `calendar-file-${slugify(path.basename(filePath, path.extname(filePath)))}`;

  await prisma.$queryRaw`SELECT 1`;

  await prisma.dataSource.upsert({
    where: { id: sourceId },
    update: {
      provider: parsed.provider,
      collectedAt,
      normalizedVersion: "goup-calendar-file-normalizer-0.1.0",
      rawPayload: {
        file: path.relative(process.cwd(), filePath),
        events: parsed.events.length,
      },
    },
    create: {
      id: sourceId,
      provider: parsed.provider,
      collectedAt,
      normalizedVersion: "goup-calendar-file-normalizer-0.1.0",
      rawPayload: {
        file: path.relative(process.cwd(), filePath),
        events: parsed.events.length,
      },
    },
  });

  for (const event of parsed.events) {
    await ensureSport(event.sport);

    const currentLeagueId = leagueId(event);
    await prisma.league.upsert({
      where: { id: currentLeagueId },
      update: {
        name: event.league,
        country: event.country ?? null,
        externalId: event.leagueId ?? null,
        season: event.season ?? null,
      },
      create: {
        id: currentLeagueId,
        name: event.league,
        country: event.country ?? null,
        externalId: event.leagueId ?? null,
        season: event.season ?? null,
        sportId: `sport-${event.sport}`,
      },
    });

    for (const side of ["home", "away"] as const) {
      const participant = event[side];
      const id = participantId(event, side);
      const type = participant.type ?? defaultParticipantType(event.sport);

      await prisma.participant.upsert({
        where: { id },
        update: {
          type,
          name: participant.name,
          shortName: participant.shortName ?? shortName(participant.name),
          country: participant.country ?? event.country ?? null,
          logoUrl: participant.logoUrl ?? null,
        },
        create: {
          id,
          type,
          name: participant.name,
          shortName: participant.shortName ?? shortName(participant.name),
          slug: `${id}-${slugify(participant.name)}`,
          sportId: `sport-${event.sport}`,
          country: participant.country ?? event.country ?? null,
          logoUrl: participant.logoUrl ?? null,
          recentForm: [],
        },
      });
    }

    await prisma.event.upsert({
      where: { id: eventId(event) },
      update: {
        externalId: event.externalId ?? null,
        startsAt: new Date(event.startsAt),
        status: event.status,
        statusLabel: event.statusLabel ?? "Programado",
        round: event.round ?? null,
        season: event.season ?? null,
        venue: event.venue,
        rawPayload: rawPayload(parsed.provider, event.metadata),
        leagueId: currentLeagueId,
        homeId: participantId(event, "home"),
        awayId: participantId(event, "away"),
        dataSourceId: sourceId,
      },
      create: {
        id: eventId(event),
        externalId: event.externalId ?? null,
        sportId: `sport-${event.sport}`,
        leagueId: currentLeagueId,
        startsAt: new Date(event.startsAt),
        status: event.status,
        statusLabel: event.statusLabel ?? "Programado",
        round: event.round ?? null,
        season: event.season ?? null,
        homeId: participantId(event, "home"),
        awayId: participantId(event, "away"),
        venue: event.venue,
        confidence: 0,
        rawPayload: rawPayload(parsed.provider, event.metadata),
        dataSourceId: sourceId,
      },
    });
  }

  await prisma.providerIngestionLog.create({
    data: {
      id: `${sourceId}-${Date.now()}`,
      provider: parsed.provider,
      resource: "calendar-file",
      params: { file: path.relative(process.cwd(), filePath) },
      results: parsed.events.length,
      status: "stored",
    },
  });

  console.log(`[calendar] Stored ${parsed.events.length} events from ${path.relative(process.cwd(), filePath)}.`);
}

main()
  .catch(async (error) => {
    console.error(error);
    await prisma.providerIngestionLog
      .create({
        data: {
          id: `calendar-file-error-${Date.now()}`,
          provider: "GOUP Calendar",
          resource: "calendar-file",
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
