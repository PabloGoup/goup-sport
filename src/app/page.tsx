import Link from "next/link";
import { getPlatformSnapshot, isProjectedVisibleEvent } from "@/domain/sports-intelligence/service";
import type { EventInsight, SearchResult } from "@/domain/sports-intelligence/types";
import {
  ConfidenceBar,
  PageShell,
  sportLabels,
} from "@/components/sports-shell/ui";
import { FavoritesPanel } from "@/components/sports-shell/favorites-panel";
import { EventCarousel } from "@/components/sports-shell/event-carousel";
import { listStoredProviderEvents } from "@/application/sports-intelligence/stored-events";
import { listStoredCalendarEvents } from "@/application/sports-intelligence/stored-calendar-events";
import { mergeUniqueEvents } from "@/application/sports-intelligence/real-events";

const quickSports = [
  { label: "En vivo", href: "/eventos?status=live", icon: "LIVE" },
  { label: "En breve", href: "/eventos?status=upcoming", icon: "E" },
  { label: "Mundial 2026", href: "/eventos?country=World&league=World+Cup", icon: "M" },
  { label: "NBA verano", href: "/eventos?sport=basketball", icon: "N" },
  { label: "Futbol", href: "/eventos?sport=football", icon: "F" },
  { label: "Tenis", href: "/eventos?sport=tennis", icon: "T" },
  { label: "Basquetbol", href: "/eventos?sport=basketball", icon: "B" },
];

const popularEvents = [
  { label: "Copa del Mundo", href: "/eventos?country=World&league=World+Cup" },
  { label: "Liga NBA de verano", href: "/eventos?sport=basketball" },
  { label: "MLB", href: "/eventos" },
  { label: "Copa Libertadores", href: "/eventos?country=World&league=Copa+Libertadores" },
  { label: "Argentina Primera A", href: "/eventos?country=Argentina" },
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

export default async function Home() {
  const snapshot = getPlatformSnapshot();
  const [storedEvents, calendarEvents] = await Promise.all([
    listStoredProviderEvents(),
    listStoredCalendarEvents(),
  ]);
  const importedEvents = mergeUniqueEvents(calendarEvents, storedEvents);
  const displayEvents = importedEvents.length > 0 ? importedEvents : snapshot.events;
  const visibleEvents = displayEvents.filter((event) => isProjectedVisibleEvent(event, 7));
  const featuredPrediction = snapshot.predictions[0];

  return (
    <PageShell active="/" searchResults={buildEventSearchResults(visibleEvents)}>
      <div className="grid min-h-[calc(100vh-126px)] grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_360px]">
        <aside className="hidden border-r border-[#d7d8df] bg-[#f4f4f7] lg:block">
          <div className="border-b border-[#d7d8df] p-4">
            <p className="text-sm font-black text-[#4a4c55]">Inicio</p>
          </div>
          <div className="space-y-1 p-3">
            {[
              "El reto millonario",
              "Torneos de analisis",
              "Copa Mundial 2026",
              "Confianza mejorada",
            ].map((item, index) => (
              <div
                key={item}
                className={`flex items-center justify-between rounded-md px-3 py-3 text-sm font-bold ${
                  index === 0 ? "bg-[#dedfe5]" : "hover:bg-white"
                }`}
              >
                <span>{item}</span>
                {index === 3 && (
                  <span className="rounded-full bg-[#ff9f00] px-2 py-1 text-xs font-black text-white">
                    83
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-[#d7d8df] p-3">
            <p className="px-1 py-3 text-base font-black text-[#4a4c55]">Eventos populares</p>
            <div className="h-0.5 bg-[#ff5a00]" />
            <div className="mt-3 space-y-1">
              {popularEvents.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center justify-between rounded-md px-2 py-3 text-sm font-bold hover:bg-white"
                  >
                    <span>{item.label}</span>
                    <span className="text-xl text-[#a1a4ae]">☆</span>
                  </Link>
              ))}
            </div>
          </div>
          <FavoritesPanel events={visibleEvents} />
        </aside>

        <section className="min-w-0 bg-[#e8e9ed]">
          <div className="border-b border-[#d7d8df] bg-[#f4f4f7] px-3 py-3 sm:px-5">
            <div className="scrollbar-hide flex gap-5 overflow-x-auto text-center">
              {quickSports.map((item, index) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="shrink-0 text-xs font-black uppercase tracking-[0.08em] text-[#3f414b]"
                >
                  <div
                    className={`mx-auto mb-2 grid h-9 w-9 place-items-center rounded-full ${
                      index === 0 ? "bg-[#ff5a00] text-white" : "bg-[#e2e3e8]"
                    }`}
                  >
                    {item.icon}
                  </div>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-4 p-3 sm:p-5">
            <EventCarousel events={visibleEvents} />

            <div className="overflow-hidden rounded-xl bg-[#111] text-white">
              <div className="flex min-h-[96px] items-center justify-between gap-3 bg-[linear-gradient(90deg,#ff5a00,#111_70%)] px-5 py-4">
                <div>
                  <p className="text-2xl font-black">Inteligencia premium</p>
                  <p className="mt-1 text-sm font-semibold text-white/75">
                    Comparadores, historial completo y explicaciones IA.
                  </p>
                </div>
                <Link
                  href="/api-producto"
                  className="shrink-0 rounded-lg bg-white px-4 py-3 text-sm font-black text-[#ff5a00]"
                >
                  Ver planes
                </Link>
              </div>
            </div>

            <section>
              <h2 className="mb-3 text-2xl font-black text-[#4a4c55]">Analisis mas populares</h2>
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <div className="space-y-0 divide-y divide-[#e2e3e8]">
                  {snapshot.predictions.map((prediction) => (
                    <div
                      key={prediction.eventId}
                      className="grid gap-3 py-4 md:grid-cols-[1fr_140px_180px]"
                    >
                      <div className="flex gap-3">
                        <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded bg-[#ff5a00] text-sm font-black text-white">
                          ✓
                        </span>
                        <div>
                          <p className="text-xs font-bold text-[#8a8d98]">
                            {sportLabels[prediction.event.sport]}
                          </p>
                          <p className="font-black text-[#202128]">{prediction.predictedOutcome}</p>
                          <p className="mt-1 text-sm font-semibold text-[#6f717c]">
                            {prediction.event.home.name} - {prediction.event.away.name}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#8a8d98]">Confianza</p>
                        <p className="text-xl font-black">{prediction.confidence}%</p>
                      </div>
                      <div className="rounded-lg bg-[#f5f6f9] p-3">
                        <p className="text-xs font-bold text-[#8a8d98]">Factor principal</p>
                        <p className="mt-1 text-sm font-black">{prediction.factors[0].label}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-4 text-center">
                  <Link href="/modelos" className="font-black text-[#ff5a00]">
                    Mostrar mas
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </section>

        <aside className="hidden border-l border-[#d7d8df] bg-[#e2e3e8] xl:block">
          <div className="border-b border-[#d7d8df] bg-[#f4f4f7] p-4">
            <div className="grid grid-cols-2 text-center text-sm font-bold text-[#5d606b]">
              <span className="border-b-4 border-[#ff5a00] pb-3 text-[#202128]">Insight</span>
              <span className="pb-3">Modelo</span>
            </div>
          </div>
          <div className="p-5">
            <div className="rounded-xl bg-white p-5 text-center shadow-sm">
              <p className="text-sm leading-6 text-[#5d606b]">
                Selecciona un evento para analizar escenarios, factores y trazabilidad del modelo.
              </p>
              <p className="mt-5 text-4xl font-black text-[#ff5a00]">goupsport</p>
            </div>
            <div className="mt-4 rounded-xl bg-[#ff5a00] p-4 text-center text-lg font-black text-white">
              Ver explicacion completa
            </div>
            <div className="mt-5 space-y-3">
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <p className="font-black text-[#202128]">{featuredPrediction.predictedOutcome}</p>
                <div className="mt-4">
                  <div className="mb-2 flex justify-between text-sm font-black">
                    <span>Confianza IA</span>
                    <span>{featuredPrediction.confidence}%</span>
                  </div>
                  <ConfidenceBar value={featuredPrediction.confidence} />
                </div>
              </div>
              {featuredPrediction.factors.slice(0, 2).map((factor) => (
                <div key={factor.label} className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-black">{factor.label}</p>
                    <span className="font-mono text-sm text-[#ff5a00]">
                      {factor.impact > 0 ? "+" : ""}
                      {factor.impact}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#6f717c]">{factor.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
