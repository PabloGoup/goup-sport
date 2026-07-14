import { unstable_cache } from "next/cache";
import { getPrisma } from "@/lib/prisma";
import type { EventInsight, Sport } from "@/domain/sports-intelligence/types";
import {
  getFootballRecentForm,
  getFootballRecentResults,
  recentFormProvidersForEvent,
} from "./football-history-context";
import { getTennisRecentForm, getTennisRecentResults } from "./tennis-history-context";

const calendarProviders = ["GOUP Calendar", "OpenFootball"];

type StoredCalendarEvent = Awaited<ReturnType<typeof readStoredCalendarEvents>>[number];

function toIsoDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapStatus(status: string): EventInsight["status"] {
  if (status === "live" || status === "today" || status === "upcoming") return status;
  return "today";
}

function mapStoredEvent(event: StoredCalendarEvent): EventInsight {
  return {
    id: event.id,
    sport: event.sport.code,
    league: event.league.name,
    leagueId: event.league.externalId ?? event.league.id,
    country: event.league.country ?? undefined,
    season: event.season ?? event.league.season ?? undefined,
    round: event.round ?? undefined,
    startsAt: toIsoDate(event.startsAt),
    status: mapStatus(event.status),
    statusLabel: event.statusLabel ?? undefined,
    home: {
      id: event.home.id,
      name: event.home.name,
      shortName: event.home.shortName,
      form: event.home.recentForm,
      logoUrl: event.home.logoUrl ?? undefined,
      country: event.home.country ?? undefined,
    },
    away: {
      id: event.away.id,
      name: event.away.name,
      shortName: event.away.shortName,
      form: event.away.recentForm,
      logoUrl: event.away.logoUrl ?? undefined,
      country: event.away.country ?? undefined,
    },
    venue: event.venue,
    confidence: event.confidence,
    modelVersion: "calendar-data-only",
    source: {
      id: event.dataSource.id,
      provider: event.dataSource.provider,
      collectedAt: toIsoDate(event.dataSource.collectedAt),
      normalizedVersion: event.dataSource.normalizedVersion,
    },
    rawPayload: event.rawPayload,
  };
}

function projectionWindow(days = 7) {
  const now = Date.now();
  return {
    gte: new Date(now - 6 * 60 * 60 * 1000),
    lte: new Date(now + days * 24 * 60 * 60 * 1000),
  };
}

async function readStoredCalendarEvents(filters: { sport?: Sport; projectedOnly?: boolean } = {}) {
  const prisma = getPrisma();

  return prisma.event.findMany({
    where: {
      ...(filters.projectedOnly
        ? {
            startsAt: projectionWindow(),
            status: {
              in: ["live", "today", "upcoming"],
            },
          }
        : {}),
      sport: filters.sport
        ? {
            code: filters.sport,
          }
        : undefined,
      dataSource: {
        provider: {
          in: calendarProviders,
        },
      },
    },
    include: {
      sport: true,
      league: true,
      home: true,
      away: true,
      dataSource: true,
    },
    orderBy: {
      startsAt: "asc",
    },
    take: 200,
  });
}

const readStoredCalendarEventsCached = unstable_cache(
  async (sport: Sport | undefined, projectedOnly: boolean) =>
    readStoredCalendarEvents({ sport, projectedOnly }),
  ["stored-calendar-events"],
  {
    revalidate: 300,
    tags: ["sports-events"],
  },
);

export async function listStoredCalendarEvents(filters: { sport?: Sport } = {}) {
  try {
    const events = await readStoredCalendarEventsCached(filters.sport, true).catch(() =>
      readStoredCalendarEvents({ ...filters, projectedOnly: true }),
    );
    const mapped = events.map(mapStoredEvent);
    return Promise.all(
      mapped.map(async (event) => {
        if (event.sport === "tennis") {
          const [homeForm, awayForm, homeResults, awayResults] = await Promise.all([
            getTennisRecentForm(event.home.name),
            getTennisRecentForm(event.away.name),
            getTennisRecentResults(event.home.name),
            getTennisRecentResults(event.away.name),
          ]);

          return {
            ...event,
            home: {
              ...event.home,
              form: homeForm.length > 0 ? homeForm : event.home.form,
              recentResults: homeResults,
            },
            away: {
              ...event.away,
              form: awayForm.length > 0 ? awayForm : event.away.form,
              recentResults: awayResults,
            },
          };
        }

        if (event.sport !== "football") return event;

        const providers = recentFormProvidersForEvent(event);
        const [homeForm, awayForm, homeResults, awayResults] = await Promise.all([
          getFootballRecentForm(event.home.name, { providers }),
          getFootballRecentForm(event.away.name, { providers }),
          getFootballRecentResults(event.home.name, { providers }),
          getFootballRecentResults(event.away.name, { providers }),
        ]);

        return {
          ...event,
          home: {
            ...event.home,
            form: homeForm.length > 0 ? homeForm : event.home.form,
            recentResults: homeResults,
          },
          away: {
            ...event.away,
            form: awayForm.length > 0 ? awayForm : event.away.form,
            recentResults: awayResults,
          },
        };
      }),
    );
  } catch {
    return [];
  }
}

export async function getStoredCalendarEventById(id: string) {
  try {
    const prisma = getPrisma();
    const event = await prisma.event.findFirst({
      where: {
        id,
        dataSource: {
          provider: {
            in: calendarProviders,
          },
        },
      },
      include: {
        sport: true,
        league: true,
        home: true,
        away: true,
        dataSource: true,
      },
    });

    if (!event) return null;

    const mapped = mapStoredEvent(event);
    if (mapped.sport === "tennis") {
      const [homeForm, awayForm, homeResults, awayResults] = await Promise.all([
        getTennisRecentForm(mapped.home.name),
        getTennisRecentForm(mapped.away.name),
        getTennisRecentResults(mapped.home.name),
        getTennisRecentResults(mapped.away.name),
      ]);

      return {
        ...mapped,
        home: {
          ...mapped.home,
          form: homeForm.length > 0 ? homeForm : mapped.home.form,
          recentResults: homeResults,
        },
        away: {
          ...mapped.away,
          form: awayForm.length > 0 ? awayForm : mapped.away.form,
          recentResults: awayResults,
        },
      };
    }

    if (mapped.sport !== "football") return mapped;

    const providers = recentFormProvidersForEvent(mapped);
    const [homeForm, awayForm, homeResults, awayResults] = await Promise.all([
      getFootballRecentForm(mapped.home.name, { providers }),
      getFootballRecentForm(mapped.away.name, { providers }),
      getFootballRecentResults(mapped.home.name, { providers }),
      getFootballRecentResults(mapped.away.name, { providers }),
    ]);

    return {
      ...mapped,
      home: {
        ...mapped.home,
        form: homeForm.length > 0 ? homeForm : mapped.home.form,
        recentResults: homeResults,
      },
      away: {
        ...mapped.away,
        form: awayForm.length > 0 ? awayForm : mapped.away.form,
        recentResults: awayResults,
      },
    };
  } catch {
    return null;
  }
}
