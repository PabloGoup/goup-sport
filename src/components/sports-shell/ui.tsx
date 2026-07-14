import Link from "next/link";
import Image from "next/image";
import type { EventInsight, Prediction, SearchResult, Sport, Team } from "@/domain/sports-intelligence/types";
import { getSearchIndex } from "@/domain/sports-intelligence/service";
import { FavoriteButton } from "./favorite-button";
import { GlobalSearch } from "./global-search";

export const sportLabels: Record<Sport, string> = {
  football: "Futbol",
  basketball: "Basketball",
  tennis: "Tenis",
};

export const sportIcons: Record<Sport, string> = {
  football: "⚽",
  basketball: "🏀",
  tennis: "🎾",
};

export const sportBackgrounds: Record<Sport, string> = {
  football:
    "https://images.unsplash.com/photo-1459865264687-595d652de67e?auto=format&fit=crop&w=1200&q=70",
  basketball:
    "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=70",
  tennis:
    "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1200&q=70",
};

const countryFlags: Record<string, string> = {
  Argentina: "🇦🇷",
  Austria: "🇦🇹",
  Belgium: "🇧🇪",
  Brazil: "🇧🇷",
  England: "🏴",
  France: "🇫🇷",
  Morocco: "🇲🇦",
  Norway: "🇳🇴",
  Portugal: "🇵🇹",
  Spain: "🇪🇸",
  Switzerland: "🇨🇭",
};

const statusLabels = {
  live: "En vivo",
  today: "Hoy",
  upcoming: "Proximo",
} as const;

export function formatEventDate(event: EventInsight) {
  return new Date(event.startsAt).toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function getEventStage(event: EventInsight) {
  return event.round ?? event.statusLabel ?? statusLabels[event.status];
}

export function getEventPrimaryMetric(event: EventInsight) {
  if (event.confidence > 0) {
    return {
      label: "Confianza",
      value: `${event.confidence}/100`,
      detail: "Modelo GOUP",
    };
  }

  return {
    label: "Estado",
    value: statusLabels[event.status],
    detail: getEventStage(event),
  };
}

export function getEventSecondaryMetric(event: EventInsight) {
  return {
    label: "Competicion",
    value: event.league,
    detail: event.country ?? "Global",
  };
}

export const navItems = [
  { label: "Inicio", href: "/" },
  { label: "Eventos", href: "/eventos" },
  { label: "Modelos", href: "/modelos" },
  { label: "API", href: "/api-producto" },
  { label: "Dashboards", href: "/dashboards" },
];

export function AppHeader({ active }: { active: string }) {
  return (
    <header className="sticky top-0 z-30 bg-[#ff5a00] text-white shadow-sm">
      <div className="mx-auto flex max-w-[1480px] items-center gap-3 px-3 py-3 sm:px-5">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <Image
            src="/logo.png"
            alt="GOUP SPORT"
            width={2000}
            height={1556}
            priority
            className="h-10 w-auto max-w-[200px] object-contain sm:h-12 sm:max-w-[220px]"
          />
          <div className="min-w-0">
            <p className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-white/80 sm:block">
              intelligence
            </p>
          </div>
        </Link>

        <nav className="ml-3 hidden flex-1 items-center gap-1 text-sm font-black uppercase lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-5 transition ${
                active === item.href
                  ? "bg-white/18 text-white"
                  : "text-white hover:bg-white/10"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <button className="ml-auto hidden rounded-full bg-white/20 px-4 py-2 text-sm font-black md:block">
          ?
        </button>
        <Link
          href="/modelos"
          className="hidden rounded-md border border-white px-4 py-2 text-sm font-black md:block"
        >
          Iniciar sesion
        </Link>
        <Link
          href="/api-producto"
          className="ml-auto rounded-md bg-[#31b846] px-3 py-2 text-xs font-black text-white hover:bg-[#249837] md:ml-0 sm:px-4 sm:text-sm"
        >
          Abrir cuenta
        </Link>
      </div>
      <nav className="scrollbar-hide flex gap-1 overflow-x-auto border-t border-white/15 px-2 py-0 text-sm font-black uppercase lg:hidden">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 px-3 py-3 ${
              active === item.href ? "bg-white/20 text-white" : "text-white"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function PageShell({
  active,
  children,
  searchResults = [],
}: Readonly<{ active: string; children: React.ReactNode; searchResults?: SearchResult[] }>) {
  const resolvedSearchResults = searchResults.length > 0 ? searchResults : getSearchIndex();

  return (
    <main className="min-h-screen bg-[#e8e9ed] text-[#26262d]">
      <AppHeader active={active} />
      <div className="border-b border-[#d7d8df] bg-[#f7f7f9]">
        <div className="mx-auto flex max-w-[1480px] items-center gap-3 px-3 py-2 sm:px-5">
          <button className="rounded-md bg-[#ececf1] px-3 py-3 text-sm font-bold text-[#4d4f59]">
            Ocultar deportes
          </button>
          <div className="hidden min-w-0 flex-1 items-center gap-2 text-sm font-semibold text-[#7a7c86] sm:flex">
            <span>Inicio</span>
            <span>/</span>
            <span>{navItems.find((item) => item.href === active)?.label ?? "Dashboard"}</span>
          </div>
          <GlobalSearch results={resolvedSearchResults} />
        </div>
      </div>
      <div className="mx-auto max-w-[1480px] px-0 py-0 sm:px-0">{children}</div>
    </main>
  );
}

export function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#d9dbe3]">
      <div
        className="h-full rounded-full bg-[#ff5a00]"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function TeamCrest({
  team,
  className = "h-9 w-9",
}: {
  team: Team;
  className?: string;
}) {
  const fallback = countryFlags[team.country ?? team.name] ?? team.shortName.slice(0, 3);

  return (
    <span className={`${className} grid shrink-0 place-items-center overflow-hidden rounded-full bg-white text-base font-black text-[#26262d] shadow-sm`}>
      {team.logoUrl ? (
        // Remote provider logos are already optimized small assets. Use img to avoid hardcoding domains in next.config while providers are still evolving.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logoUrl} alt={team.name} className="h-full w-full object-contain p-1" />
      ) : (
        fallback
      )}
    </span>
  );
}

export function EventCard({ event, compact = false }: { event: EventInsight; compact?: boolean }) {
  const primaryMetric = getEventPrimaryMetric(event);
  const secondaryMetric = getEventSecondaryMetric(event);

  return (
    <article className="relative min-h-[188px] overflow-hidden rounded-xl bg-[#111] text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-55"
        style={{ backgroundImage: `url(${sportBackgrounds[event.sport]})` }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.9),rgba(0,0,0,0.58)),radial-gradient(circle_at_78%_20%,rgba(255,90,0,0.55),transparent_30%)]" />
      <div className="relative p-3">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/eventos/${event.id}`} className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-base">{sportIcons[event.sport]}</span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-black uppercase tracking-[0.1em] text-white/80">
                  {sportLabels[event.sport]} / {event.country ?? "Global"}
                </p>
                <p className="truncate text-[11px] font-bold text-[#ffb48a]">{event.league}</p>
              </div>
            </div>
          </Link>
          <FavoriteButton eventId={event.id} />
        </div>

        <Link href={`/eventos/${event.id}`} className="mt-4 block">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <TeamCrest team={event.home} className="h-8 w-8" />
                <p className="truncate text-xl font-black leading-tight">{event.home.name}</p>
              </div>
            </div>
            <span className="rounded-md bg-white/16 px-2 py-1 text-[11px] font-black text-white">VS</span>
            <div className="min-w-0 text-right">
              <div className="flex min-w-0 items-center justify-end gap-2">
                <p className="truncate text-xl font-black leading-tight">{event.away.name}</p>
                <TeamCrest team={event.away} className="h-8 w-8" />
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-2 text-xs font-bold text-white/70 sm:grid-cols-2">
            <div className="rounded-lg bg-white/12 px-3 py-2">
              <p className="uppercase tracking-[0.08em] text-white/45">Horario</p>
              <p className="mt-0.5 text-xs font-black text-white">{formatEventDate(event)}</p>
            </div>
            <div className="rounded-lg bg-white/12 px-3 py-2">
              <p className="uppercase tracking-[0.08em] text-white/45">Fase</p>
              <p className="mt-0.5 truncate text-xs font-black text-white">{getEventStage(event)}</p>
            </div>
          </div>

          {!compact && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[primaryMetric, secondaryMetric].map((metric) => (
                <div key={metric.label} className="rounded-lg bg-white px-3 py-2 text-[#202128]">
                  <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#8a8d98]">
                    {metric.label}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-black">{metric.value}</p>
                </div>
              ))}
            </div>
          )}
        </Link>
      </div>
    </article>
  );
}

export function PredictionCard({
  prediction,
}: {
  prediction: Prediction & { event: EventInsight };
}) {
  return (
    <Link
      href={`/modelos/${prediction.eventId}`}
      className="block rounded-xl border border-[#dfe1e8] bg-white p-4 shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black sm:text-base">{prediction.predictedOutcome}</p>
          <p className="mt-1 text-xs font-semibold text-[#6f717c]">
            {prediction.event.home.shortName} vs {prediction.event.away.shortName}
          </p>
        </div>
        <span className="rounded bg-[#ff5a00] px-2 py-1 text-xs font-black text-white">
          {prediction.confidence}
        </span>
      </div>
      <div className="mt-4 space-y-2">
        {prediction.factors.map((factor) => (
          <div key={factor.label} className="rounded-lg border border-[#e3e4ea] bg-[#f7f7f9] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black text-[#26262d]">{factor.label}</p>
              <span className="font-mono text-xs text-[#ff5a00]">
                {factor.impact > 0 ? "+" : ""}
                {factor.impact}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#6f717c]">{factor.explanation}</p>
          </div>
        ))}
      </div>
    </Link>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff5a00]">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-black sm:text-3xl">{title}</h2>
      {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f717c]">{description}</p>}
    </div>
  );
}
