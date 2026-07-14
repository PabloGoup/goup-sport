import Link from "next/link";
import { isEventSort, isProjectedVisibleEvent, listEvents } from "@/domain/sports-intelligence/service";
import type { EventInsight, SearchResult } from "@/domain/sports-intelligence/types";
import { EventCard, PageShell, SectionHeader, sportLabels } from "@/components/sports-shell/ui";
import { isEventStatus, isSport } from "@/domain/sports-intelligence/service";
import { listStoredProviderEvents } from "@/application/sports-intelligence/stored-events";
import { listStoredCalendarEvents } from "@/application/sports-intelligence/stored-calendar-events";
import { mergeUniqueEvents } from "@/application/sports-intelligence/real-events";

const statusLabels = {
  today: "Hoy",
  upcoming: "Proximos",
  live: "En vivo",
} as const;

const featuredCompetitionFilters = [
  { label: "Mundial 2026", country: "World", league: "World Cup" },
  { label: "Amistosos internacionales", country: "World", league: "Friendlies" },
  { label: "Clubes amistosos", country: "World", league: "Friendlies Clubs" },
];

function sortEventCards<T extends { startsAt: string; confidence: number; status: string }>(
  events: T[],
  sort?: string,
) {
  return [...events].sort((a, b) => {
    if (sort === "confidence") return b.confidence - a.confidence;
    if (sort === "today") {
      if (a.status === "today" && b.status !== "today") return -1;
      if (b.status === "today" && a.status !== "today") return 1;
    }
    return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
  });
}

function buildEventSearchResults(events: EventInsight[]): SearchResult[] {
  return events.slice(0, 80).map((event) => ({
    id: event.id,
    type: "event",
    title: `${event.home.name} vs ${event.away.name}`,
    subtitle: [event.league, event.country, event.statusLabel ?? event.status].filter(Boolean).join(" · "),
    href: `/eventos/${event.id}`,
    sport: event.sport,
  }));
}

type EventsPageProps = {
  searchParams: Promise<{
    sport?: string;
    status?: string;
    sort?: string;
    minConfidence?: string;
    country?: string;
    league?: string;
  }>;
};

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const filters = await searchParams;
  const sport = isSport(filters.sport) ? filters.sport : undefined;
  const status = isEventStatus(filters.status) ? filters.status : undefined;
  const sort = isEventSort(filters.sort) ? filters.sort : undefined;
  const minConfidence =
    filters.minConfidence && !Number.isNaN(Number(filters.minConfidence))
      ? Number(filters.minConfidence)
      : undefined;
  const country = filters.country;
  const league = filters.league;
  const [storedEvents, calendarEvents] = await Promise.all([
    listStoredProviderEvents({ sport }),
    listStoredCalendarEvents({ sport }),
  ]);
  const persistedEvents = mergeUniqueEvents(calendarEvents, storedEvents);
  const fallbackEvents = listEvents({ sport, status, sort, minConfidence });
  const allEvents = (persistedEvents.length > 0 ? persistedEvents : fallbackEvents).filter((event) =>
    isProjectedVisibleEvent(event, 7),
  );
  const availablePersistedEvents = mergeUniqueEvents(
    await listStoredCalendarEvents(),
    await listStoredProviderEvents(),
  );
  const availableEvents = (availablePersistedEvents.length > 0 ? availablePersistedEvents : listEvents()).filter((event) =>
    isProjectedVisibleEvent(event, 7),
  );
  const countries = Array.from(new Set(availableEvents.map((event) => event.country).filter(Boolean))).sort();
  const leagues = Array.from(
    new Set(
      availableEvents
        .filter((event) => !country || event.country === country)
        .map((event) => event.league),
    ),
  ).sort();
  const events = sortEventCards(allEvents.filter((event) => {
    if (sport && event.sport !== sport) return false;
    if (status && event.status !== status) return false;
    if (country && event.country !== country) return false;
    if (league && event.league !== league) return false;
    if (minConfidence && event.confidence > 0 && event.confidence < minConfidence) return false;
    return true;
  }), sort);
  const queryFor = (nextFilters: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = {
      sport,
      status,
      sort,
      minConfidence: filters.minConfidence,
      country,
      league,
      ...nextFilters,
    };

    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }

    const query = params.toString();
    return query ? `/eventos?${query}` : "/eventos";
  };

  return (
    <PageShell active="/eventos" searchResults={buildEventSearchResults(availableEvents)}>
      <div className="p-3 sm:p-5">
        <SectionHeader
          eyebrow="Eventos"
          title="Centro de partidos"
          description="Eventos destacados, calendario próximo y fichas de inteligencia deportiva en una sola vista."
        />

        <div className="mb-4 rounded-xl border border-[#dfe1e8] bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ff5a00]">
                Segmentacion
              </p>
              <p className="mt-1 text-sm font-semibold text-[#6f717c]">
                Separacion por deporte, estado, pais y liga. API-Sports queda bajo consulta manual para proteger cuota.
              </p>
            </div>
            <Link
              href="/api-producto"
              className="hidden rounded-md bg-[#26262d] px-3 py-2 text-xs font-black text-white sm:block"
            >
              Ver API
            </Link>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 text-sm font-black">
          <Link
            href="/eventos"
            className={`shrink-0 rounded-md px-3 py-2 ${
              !sport && !status ? "bg-[#ff5a00] text-white" : "bg-white text-[#4d4f59]"
            }`}
          >
            Todos
          </Link>
          {Object.entries(sportLabels).map(([value, label]) => (
            <Link
              key={value}
              href={queryFor({ sport: value, league: undefined })}
              className={`shrink-0 rounded-md px-3 py-2 ${
                sport === value ? "bg-[#ff5a00] text-white" : "bg-white text-[#4d4f59]"
              }`}
            >
              {label}
            </Link>
          ))}
          {Object.entries(statusLabels).map(([value, label]) => (
            <Link
              key={value}
              href={queryFor({ status: value })}
              className={`shrink-0 rounded-md px-3 py-2 ${
                status === value ? "bg-[#ff5a00] text-white" : "bg-white text-[#4d4f59]"
              }`}
            >
              {label}
            </Link>
          ))}
          <Link
            href={queryFor({ sort: "confidence" })}
            className={`shrink-0 rounded-md px-3 py-2 ${
              sort === "confidence" ? "bg-[#ff5a00] text-white" : "bg-white text-[#4d4f59]"
            }`}
          >
            Confianza alta
          </Link>
          <Link
            href={queryFor({ sort: "startsAt" })}
            className={`shrink-0 rounded-md px-3 py-2 ${
              sort === "startsAt" ? "bg-[#ff5a00] text-white" : "bg-white text-[#4d4f59]"
            }`}
          >
            Proximos primero
          </Link>
          <Link
            href={queryFor({ minConfidence: "80" })}
            className={`shrink-0 rounded-md px-3 py-2 ${
              minConfidence === 80 ? "bg-[#ff5a00] text-white" : "bg-white text-[#4d4f59]"
            }`}
          >
            80%+
          </Link>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 text-sm font-black">
            {featuredCompetitionFilters.map((item) => (
              <Link
                key={item.label}
                href={queryFor({ country: item.country, league: item.league })}
                className={`shrink-0 rounded-md px-3 py-2 ${
                  country === item.country && league === item.league
                    ? "bg-[#ff5a00] text-white"
                    : "bg-[#26262d] text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 text-sm font-black">
            {countries.map((item) => (
              <Link
                key={item}
                href={queryFor({ country: item, league: undefined })}
                className={`shrink-0 rounded-md px-3 py-2 ${
                  country === item ? "bg-[#ff5a00] text-white" : "bg-[#f0f1f5] text-[#4d4f59]"
                }`}
              >
                {item}
              </Link>
            ))}
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 text-sm font-black">
            {leagues.map((item) => (
              <Link
                key={item}
                href={queryFor({ league: item })}
                className={`shrink-0 rounded-md px-3 py-2 ${
                  league === item ? "bg-[#ff5a00] text-white" : "bg-[#f0f1f5] text-[#4d4f59]"
                }`}
              >
                {item}
              </Link>
            ))}
          </div>
        </div>

        {events.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-white p-6 text-center shadow-sm">
            <p className="font-black">Ajusta los filtros para explorar mas eventos.</p>
            <p className="mt-2 text-sm text-[#6f717c]">
              Prueba con otro deporte, pais, liga o estado.
            </p>
          </div>
        )}
      </div>
    </PageShell>
  );
}
