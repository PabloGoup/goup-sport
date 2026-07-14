import { unstable_cache } from "next/cache";
import { getPrisma } from "@/lib/prisma";
import type { EventInsight, Sport } from "@/domain/sports-intelligence/types";
import {
  getFootballRecentForm,
  getFootballRecentResults,
  recentFormProvidersForEvent,
} from "./football-history-context";

type StoredProviderEvent = Awaited<ReturnType<typeof readStoredProviderEventsUncached>>[number];

function toIsoDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapStoredEvent(event: StoredProviderEvent): EventInsight {
  return {
    id: event.id,
    sport: event.sport.code,
    league: event.league.name,
    leagueId: event.league.externalId ?? event.league.id,
    country: event.league.country ?? undefined,
    season: event.season ?? event.league.season ?? undefined,
    round: event.round ?? undefined,
    startsAt: toIsoDate(event.startsAt),
    status: event.status === "completed" || event.status === "postponed" ? "today" : event.status,
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
    modelVersion: "external-data-only",
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

async function readStoredProviderEventsUncached(filters: { sport?: Sport; projectedOnly?: boolean } = {}) {
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
      sport: filters.sport ? { code: filters.sport } : undefined,
      dataSource: {
        provider: {
          in: ["API-Sports Football", "API-Sports Basketball"],
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

const readStoredProviderEventsCached = unstable_cache(
  async (sport: Sport | undefined, projectedOnly: boolean) =>
    readStoredProviderEventsUncached({ sport, projectedOnly }),
  ["stored-provider-events"],
  {
    revalidate: 300,
    tags: ["sports-events"],
  },
);

export async function listStoredProviderEvents(filters: { sport?: Sport } = {}) {
  try {
    const events = await readStoredProviderEventsCached(filters.sport, true).catch(() =>
      readStoredProviderEventsUncached({ sport: filters.sport, projectedOnly: true }),
    );
    const mapped = events.map(mapStoredEvent);
    return Promise.all(
      mapped.map(async (event) => {
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
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[sports-intelligence] Failed to read stored provider events.", error);
    }
    return [];
  }
}

export async function listStoredFootballEvents() {
  return listStoredProviderEvents({ sport: "football" });
}

const readStoredProviderEventByIdCached = unstable_cache(
  async (id: string) => {
    const prisma = getPrisma();
    return prisma.event.findFirst({
      where: {
        id,
        dataSource: {
          provider: {
            in: ["API-Sports Football", "API-Sports Basketball"],
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
  },
  ["stored-provider-event-by-id"],
  {
    revalidate: 300,
    tags: ["sports-events"],
  },
);

export async function getStoredProviderEventById(id: string) {
  try {
    const storedEvent = await readStoredProviderEventByIdCached(id).catch(async () => {
      const prisma = getPrisma();
      return prisma.event.findFirst({
        where: {
          id,
          dataSource: {
            provider: {
              in: ["API-Sports Football", "API-Sports Basketball"],
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
    });
    if (!storedEvent) return null;
    const event = mapStoredEvent(storedEvent);
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
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[sports-intelligence] Failed to read stored provider event.", error);
    }
    return null;
  }
}

export async function getStoredFootballEventById(id: string) {
  const event = await getStoredProviderEventById(id);
  return event?.sport === "football" ? event : null;
}
