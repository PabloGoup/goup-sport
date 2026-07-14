import Link from "next/link";
import { getPlatformSnapshot, isProjectedVisibleEvent } from "@/domain/sports-intelligence/service";
import type { EventInsight, SearchResult } from "@/domain/sports-intelligence/types";
import { EventCarousel } from "@/components/sports-shell/event-carousel";
import { PageShell, sportBackgrounds, sportIcons, sportLabels, TeamCrest } from "@/components/sports-shell/ui";
import { listStoredProviderEvents } from "@/application/sports-intelligence/stored-events";
import { listStoredCalendarEvents } from "@/application/sports-intelligence/stored-calendar-events";
import { mergeUniqueEvents } from "@/application/sports-intelligence/real-events";

const sportTabs = [
  { label: "En vivo", href: "/eventos?status=live", icon: "LIVE" },
  { label: "Proximos", href: "/eventos?status=upcoming", icon: "⏱" },
  { label: "Futbol", href: "/eventos?sport=football", icon: "⚽" },
  { label: "Basketball", href: "/eventos?sport=basketball", icon: "🏀" },
  { label: "Tenis", href: "/eventos?sport=tennis", icon: "🎾" },
  { label: "80%+", href: "/eventos?minConfidence=80", icon: "↗" },
];

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

function formatEventTime(event: EventInsight) {
  return new Date(event.startsAt).toLocaleString("es-CL", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function eventSignal(event: EventInsight) {
  if (event.confidence > 0) return `${event.confidence}%`;
  if (event.status === "live") return "Live";
  if (event.status === "today") return "Hoy";
  return "Prox.";
}

const compactCardAccents = [
  "linear-gradient(180deg,rgba(6,19,31,0.16),rgba(6,19,31,0.92)),linear-gradient(115deg,rgba(0,196,204,0.52),transparent 55%)",
  "linear-gradient(180deg,rgba(6,19,31,0.18),rgba(6,19,31,0.92)),linear-gradient(115deg,rgba(255,90,0,0.52),transparent 55%)",
  "linear-gradient(180deg,rgba(6,19,31,0.18),rgba(6,19,31,0.92)),linear-gradient(115deg,rgba(117,82,255,0.52),transparent 55%)",
  "linear-gradient(180deg,rgba(6,19,31,0.18),rgba(6,19,31,0.92)),linear-gradient(115deg,rgba(16,120,104,0.52),transparent 55%)",
];

async function loadImportedEvents() {
  const [storedEvents, calendarEvents] = await Promise.all([
    listStoredProviderEvents().catch(() => []),
    listStoredCalendarEvents().catch(() => []),
  ]);

  return mergeUniqueEvents(calendarEvents, storedEvents);
}

export default async function Home() {
  const snapshot = getPlatformSnapshot();
  const importedEvents = await loadImportedEvents();
  const displayEvents = importedEvents.length > 0 ? importedEvents : snapshot.events;
  const visibleEvents = displayEvents.filter((event) => isProjectedVisibleEvent(event, 7));
  const featuredEvents = visibleEvents.slice(0, 8);

  return (
    <PageShell active="/" searchResults={buildEventSearchResults(visibleEvents)}>
      <div className="min-h-[calc(100vh-126px)] bg-[#06131f] text-white">
        <div className="mx-auto max-w-[1480px] px-3 py-4 sm:px-5">
          <nav className="scrollbar-hide mb-4 flex gap-3 overflow-x-auto">
            {sportTabs.map((tab, index) => (
              <Link
                key={tab.label}
                href={tab.href}
                className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-3 text-sm font-black ${
                  index === 0
                    ? "bg-[#ff5a00] text-white shadow-[0_12px_26px_rgba(255,90,0,0.28)]"
                    : "bg-[#132536] text-white/78 hover:bg-[#1b3348] hover:text-white"
                }`}
              >
                <span className="grid h-7 min-w-7 place-items-center rounded-full bg-white/12 text-xs">
                  {tab.icon}
                </span>
                {tab.label}
              </Link>
            ))}
          </nav>

          <div className="space-y-4">
            <EventCarousel events={visibleEvents} />

            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h1 className="text-2xl font-black">Partidos destacados</h1>
                <Link href="/eventos" className="rounded-full bg-white px-4 py-2 text-sm font-black text-[#071522]">
                  Ver todos
                </Link>
              </div>

              <div className="grid gap-2 md:gap-3 md:grid-cols-2 xl:grid-cols-4">
                {featuredEvents.map((event, index) => (
                  <div key={event.id}>
                    <Link
                      href={`/eventos/${event.id}`}
                      className="block min-h-[104px] rounded-xl bg-[#edf4f7] p-3 text-[#071522] shadow-[0_8px_22px_rgba(0,0,0,0.18)] md:hidden"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-base shadow-sm">
                            {sportIcons[event.sport]}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-[#00969b]">
                              {sportLabels[event.sport]}
                            </p>
                            <p className="truncate text-xs font-bold text-[#6a7480]">{event.league}</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-[#ff5a00] px-2.5 py-1 text-xs font-black text-white">
                          {eventSignal(event)}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <TeamCrest team={event.home} className="h-7 w-7 text-[10px]" />
                          <span className="truncate text-base font-black">{event.home.name}</span>
                        </span>
                        <span className="rounded bg-[#dce7ec] px-2 py-1 text-[10px] font-black text-[#55606b]">VS</span>
                        <span className="flex min-w-0 items-center justify-end gap-2">
                          <span className="truncate text-right text-base font-black">{event.away.name}</span>
                          <TeamCrest team={event.away} className="h-7 w-7 text-[10px]" />
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-lg bg-white">
                        <span className="px-2 py-2 text-xs font-black">{formatEventTime(event)}</span>
                        <span className="border-x border-[#dfe7ec] px-2 py-2 text-center text-xs font-black text-[#00969b]">{event.country ?? "Global"}</span>
                        <span className="px-2 py-2 text-right text-xs font-black text-[#00969b]">{eventSignal(event)}</span>
                      </div>
                    </Link>

                    <Link
                      href={`/eventos/${event.id}`}
                      className="group relative hidden min-h-[250px] overflow-hidden rounded-2xl bg-[#102132] p-4 text-white shadow-[0_14px_36px_rgba(0,0,0,0.22)] ring-1 ring-white/8 transition hover:-translate-y-0.5 hover:ring-[#62f4ff]/40 md:block"
                    >
                      <div
                        className="absolute inset-0 bg-cover bg-center opacity-70"
                        style={{ backgroundImage: `url(${sportBackgrounds[event.sport]})` }}
                      />
                      <div
                        className="absolute inset-0"
                        style={{ background: compactCardAccents[index % compactCardAccents.length] }}
                      />
                      <div className="absolute -right-8 bottom-9 text-[96px] leading-none opacity-20">
                        {sportIcons[event.sport]}
                      </div>
                      <div className="relative flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-lg shadow-sm">
                            {sportIcons[event.sport]}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-black uppercase tracking-[0.12em] text-[#62f4ff]">
                              {sportLabels[event.sport]}
                            </p>
                            <p className="truncate text-xs font-bold text-white/60">{event.league}</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-[#ff5a00] px-2.5 py-1 text-xs font-black text-white">
                          {eventSignal(event)}
                        </span>
                      </div>
                      <div className="relative mt-10 space-y-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <TeamCrest team={event.home} className="h-10 w-10 text-xs" />
                          <p className="truncate text-2xl font-black text-white">{event.home.name}</p>
                        </div>
                        <div className="flex min-w-0 items-center gap-3">
                          <TeamCrest team={event.away} className="h-10 w-10 text-xs" />
                          <p className="truncate text-2xl font-black text-white">{event.away.name}</p>
                        </div>
                      </div>
                      <div className="relative mt-7 flex items-center justify-between rounded-xl bg-white px-3 py-3 text-[#071522]">
                        <span className="text-xs font-black">{formatEventTime(event)}</span>
                        <span className="text-xs font-black text-[#00969b]">{event.country ?? "Global"}</span>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </section>

          
          </div>
        </div>
      </div>
    </PageShell>
  );
}
