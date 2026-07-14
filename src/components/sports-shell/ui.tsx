import Link from "next/link";
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
  Canada: "🇨🇦",
  Chile: "🇨🇱",
  Ecuador: "🇪🇨",
  England: "ENG",
  France: "🇫🇷",
  Germany: "🇩🇪",
  Iraq: "🇮🇶",
  Lebanon: "🇱🇧",
  Morocco: "🇲🇦",
  Norway: "🇳🇴",
  Paraguay: "🇵🇾",
  Philippines: "🇵🇭",
  Portugal: "🇵🇹",
  "Puerto Rico": "🇵🇷",
  Spain: "🇪🇸",
  Sweden: "🇸🇪",
  Switzerland: "🇨🇭",
  USA: "🇺🇸",
  World: "🌐",
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
    <header
      className="sticky top-0 z-30 text-white shadow-[0_1px_0_rgba(255,255,255,0.08)]"
      style={{ backgroundColor: "#07111f" }}
    >
      <div className="mx-auto flex max-w-[1480px] items-center gap-5 px-4 py-3 sm:px-6">
        <Link href="/" className="flex min-w-[250px] items-center gap-3">
          <span className="block text-[36px] font-black leading-[0.82] tracking-[-0.04em] text-white">
            GoUp
          </span>
          <span className="block max-w-[112px] text-[10px] font-black uppercase leading-[1.05] tracking-[0.18em] text-[#ff7a2f]">
            Sport Intelligence
          </span>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-2 text-sm font-black uppercase lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative rounded-full px-4 py-2.5 transition ${
                active === item.href
                  ? "bg-[#ff5a00] text-white shadow-[0_10px_24px_rgba(255,90,0,0.28)]"
                  : "text-white/68 hover:bg-white/8 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link href="/api-producto" className="ml-auto hidden h-11 w-11 place-items-center rounded-full border border-white/12 bg-white/7 text-sm font-black text-white/82 hover:bg-white/12 md:grid lg:ml-0">
          ?
        </Link>
        <Link
          href="/modelos"
          className="hidden rounded-full border border-white/16 px-5 py-2.5 text-sm font-black text-white hover:bg-white/8 md:block"
        >
          Iniciar sesion
        </Link>
        <Link
          href="/api-producto"
          className="ml-auto rounded-full bg-[#31b846] px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-[#249837] md:ml-0 sm:px-5 sm:text-sm"
        >
          Abrir cuenta
        </Link>
      </div>
      <nav className="scrollbar-hide flex gap-2 overflow-x-auto border-t border-white/15 px-3 py-2 text-sm font-black uppercase lg:hidden">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-full px-3 py-2 ${
              active === item.href ? "bg-[#ff5a00] text-white" : "text-white/76"
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
      <div className="border-b border-white/8" style={{ backgroundColor: "#07111f" }}>
        <div className="mx-auto flex max-w-[1480px] items-center gap-3 px-3 py-2 sm:px-5">
          <Link href="/eventos" className="rounded-md bg-white/8 px-3 py-3 text-sm font-bold text-white/82 hover:bg-white/12 hover:text-white">
            Ver deportes
          </Link>
          <div className="hidden min-w-0 flex-1 items-center gap-2 text-sm font-semibold text-white/50 sm:flex">
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
  function providerLogoUrl() {
    const footballMatch = team.id.match(/^apisports-football-team-(\d+)$/);
    if (footballMatch) return `https://media.api-sports.io/football/teams/${footballMatch[1]}.png`;

    const basketballMatch = team.id.match(/^apisports-basketball-team-(\d+)$/);
    if (basketballMatch) return `https://media.api-sports.io/basketball/teams/${basketballMatch[1]}.png`;

    return undefined;
  }

  const resolvedLogoUrl = team.logoUrl ?? providerLogoUrl();
  const fallback = countryFlags[team.name] ?? countryFlags[team.country ?? ""] ?? team.shortName.slice(0, 3);

  return (
    <span className={`${className} grid shrink-0 place-items-center overflow-hidden rounded-full bg-white text-base font-black text-[#26262d] shadow-sm`}>
      {resolvedLogoUrl ? (
        // Remote provider logos are already optimized small assets. Use img to avoid hardcoding domains in next.config while providers are still evolving.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resolvedLogoUrl} alt={team.name} className="h-full w-full object-contain p-1" />
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
    <div className="mb-3 sm:mb-4">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#ff5a00] sm:text-xs sm:tracking-[0.16em]">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-black sm:text-3xl">{title}</h2>
      {description && <p className="mt-1 max-w-2xl text-sm leading-5 text-[#6f717c] sm:mt-2 sm:leading-6">{description}</p>}
    </div>
  );
}
