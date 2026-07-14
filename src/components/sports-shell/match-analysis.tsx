import type {
  EventInsight,
  FeaturedPlayerCard,
  MatchAnalysis,
  ModelFactor,
  PredictiveMarket,
} from "@/domain/sports-intelligence/types";
import { sportLabels, TeamCrest } from "./ui";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function FormStrip({ form }: { form: string[] }) {
  if (form.length === 0) return null;

  return (
    <div className="flex gap-1">
      {form.map((result, index) => (
        <span
          key={`${result}-${index}`}
          className={`grid h-6 w-6 place-items-center rounded text-[11px] font-black ${
            result === "W"
              ? "bg-[#30b85a] text-white"
              : result === "D"
                ? "bg-[#f1b034] text-[#211b0d]"
                : "bg-[#d84545] text-white"
          }`}
        >
          {result}
        </span>
      ))}
    </div>
  );
}

function RecentResults({ team, align = "left" }: { team: EventInsight["home"]; align?: "left" | "right" }) {
  const results = team.recentResults ?? [];
  if (results.length === 0) return null;

  return (
    <div className="mt-4 space-y-1">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/45">
        Ultimos resultados
      </p>
      {results.map((result) => (
        <div
          key={`${result.date}-${result.opponent}-${result.score}`}
          className={`flex items-center gap-2 rounded-lg bg-white/8 px-2 py-1.5 text-[11px] font-bold text-white/75 ${
            align === "right" ? "justify-end" : ""
          }`}
        >
          <span
            className={`grid h-5 w-5 place-items-center rounded text-[10px] font-black ${
              result.result === "W"
                ? "bg-[#30b85a] text-white"
                : result.result === "D"
                  ? "bg-[#f1b034] text-[#211b0d]"
                  : "bg-[#d84545] text-white"
            }`}
          >
            {result.result}
          </span>
          <span className="truncate">{result.score} vs {result.opponent}</span>
        </div>
      ))}
    </div>
  );
}

function TeamBlock({ team, align = "left" }: { team: EventInsight["home"]; align?: "left" | "right" }) {
  const teamContext = team.tablePosition ? `#${team.tablePosition} tabla` : team.country;

  return (
    <div className={`rounded-xl bg-white/10 p-4 ${align === "right" ? "text-right" : ""}`}>
      <div className={`flex items-center gap-3 ${align === "right" ? "flex-row-reverse" : ""}`}>
        <TeamCrest team={team} className="h-14 w-14 rounded-xl" />
        <div className="min-w-0">
          <p className="truncate text-lg font-black text-white sm:text-2xl">{team.name}</p>
          {teamContext && <p className="mt-1 text-xs font-bold text-white/65">{teamContext}</p>}
        </div>
      </div>
      <div className={`mt-4 flex ${align === "right" ? "justify-end" : ""}`}>
        <FormStrip form={team.form} />
      </div>
      <RecentResults team={team} align={align} />
    </div>
  );
}

export function PredictionProbabilityBar({ analysis }: { analysis: MatchAnalysis }) {
  const draw = analysis.probabilities.draw ?? 0;
  const away = analysis.probabilities.awayWin;
  const home = Math.max(0, analysis.probabilities.homeWin);

  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full bg-white/15">
        <div className="bg-[#ff5a00]" style={{ width: `${home}%` }} />
        {draw > 0 && <div className="bg-[#f5b13f]" style={{ width: `${draw}%` }} />}
        <div className="bg-[#4f8cff]" style={{ width: `${away}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black text-white/75">
        <span>Local {home}%</span>
        {draw > 0 ? <span>Empate {draw}%</span> : <span />}
        <span>Visita {away}%</span>
      </div>
    </div>
  );
}

function hasProjectedScore(analysis: MatchAnalysis) {
  return analysis.projectedScore.label.trim().length > 0;
}

export function MatchScoreBadge({ analysis }: { analysis: MatchAnalysis }) {
  return (
    <div className="rounded-xl bg-[#ff5a00] p-4 text-white shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-white/75">GOUP Match Score</p>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-5xl font-black leading-none">{analysis.matchScore}</span>
        <span className="pb-1 text-sm font-black">{analysis.matchScoreLabel}</span>
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-white/80">
        Mide atractivo, competitividad y relevancia. No indica ganador.
      </p>
    </div>
  );
}

export function MatchHero({ event, analysis }: { event: EventInsight; analysis: MatchAnalysis }) {
  return (
    <section className="overflow-hidden rounded-xl bg-[#171820] text-white shadow-sm">
      <div className="bg-[#ff5a00] px-4 py-3 text-xs font-black uppercase tracking-[0.14em]">
        {[sportLabels[event.sport], event.country, event.league].filter(Boolean).join(" · ")}
      </div>
      <div className="grid gap-3 p-4 lg:grid-cols-[1fr_1.3fr_1fr]">
        <TeamBlock team={event.home} />
        <div className="rounded-xl bg-white p-4 text-[#202128]">
          <p className="text-center text-xs font-black uppercase tracking-[0.14em] text-[#ff5a00]">
            {event.round ?? event.league}
          </p>
          <h1 className="mt-2 text-center text-2xl font-black sm:text-4xl">
            Centro de analisis
          </h1>
          <p className="mt-2 text-center text-sm font-semibold text-[#6f717c]">
            {formatDateTime(event.startsAt)} · {event.venue} · {event.statusLabel ?? event.status}
          </p>
          <div className="mt-5 rounded-xl bg-[#171820] p-4">
            <PredictionProbabilityBar analysis={analysis} />
          </div>
          {(hasProjectedScore(analysis) || analysis.confidence > 0) && (
            <div className="mt-4 grid gap-2 text-center sm:grid-cols-3">
              {hasProjectedScore(analysis) && (
                <div className="rounded-lg bg-[#f4f5f8] p-3">
                  <p className="text-xs font-bold text-[#6f717c]">Marcador proyectado</p>
                  <p className="mt-1 text-xl font-black">{analysis.projectedScore.label}</p>
                </div>
              )}
              {analysis.confidence > 0 && (
                <div className="rounded-lg bg-[#f4f5f8] p-3">
                  <p className="text-xs font-bold text-[#6f717c]">Confianza</p>
                  <p className="mt-1 text-xl font-black">{analysis.confidence}%</p>
                </div>
              )}
              {analysis.confidence > 0 && (
                <div className="rounded-lg bg-[#f4f5f8] p-3">
                  <p className="text-xs font-bold text-[#6f717c]">Riesgo</p>
                  <p className="mt-1 text-xl font-black">{analysis.riskLevel}</p>
                </div>
              )}
            </div>
          )}
          <p className="mt-4 text-center text-xs font-bold text-[#6f717c]">
            Modelo actualizado: {formatDateTime(analysis.updatedAt)}
          </p>
        </div>
        <TeamBlock team={event.away} align="right" />
      </div>
    </section>
  );
}

export function MatchTabs() {
  const tabs = [
    ["Resumen", "resumen"],
    ["Prediccion", "prediccion"],
    ["Mercados", "mercados-predictivos"],
    ["Equipos", "equipos"],
    ["Jugadores", "jugadores"],
    ["Estadisticas", "estadisticas"],
    ["Historial", "historial"],
    ["Modelos", "modelos"],
    ["Noticias", "noticias"],
  ];

  return (
    <nav className="sticky top-[104px] z-20 -mx-3 mt-0 flex gap-2 overflow-x-auto border-y border-[#dfe1e8] bg-white px-3 py-2 text-sm font-black shadow-sm sm:-mx-5 sm:px-5 lg:top-[72px]">
      {tabs.map(([label, href]) => (
        <a
          key={href}
          href={`#${href}`}
          className="shrink-0 rounded-md px-3 py-2 text-[#4d4f59] hover:bg-[#fff0e8] hover:text-[#ff5a00]"
        >
          {label}
        </a>
      ))}
    </nav>
  );
}

export function ComponentScoreGrid({ analysis }: { analysis: MatchAnalysis }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {analysis.matchScoreComponents.map((item) => (
        <div key={item.label} className="rounded-xl border border-[#e2e3e8] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="font-black">{item.label}</p>
            <span className="rounded bg-[#fff0e8] px-2 py-1 font-mono text-sm font-black text-[#ff5a00]">
              {item.score}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e2e3e8]">
            <div className="h-full rounded-full bg-[#ff5a00]" style={{ width: `${item.score}%` }} />
          </div>
          <p className="mt-3 text-sm leading-6 text-[#6f717c]">{item.explanation}</p>
        </div>
      ))}
    </div>
  );
}

export function TeamComparisonBars({ event, analysis }: { event: EventInsight; analysis: MatchAnalysis }) {
  if (analysis.teamComparison.length === 0) return null;

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="grid gap-2">
        {analysis.teamComparison.map((item) => (
          <div key={item.label} className="grid gap-2 sm:grid-cols-[80px_1fr_92px_1fr_80px] sm:items-center">
            <p className="font-mono text-sm font-black text-[#ff5a00]">{item.home}</p>
            <div className="h-3 overflow-hidden rounded-full bg-[#eef0f4] sm:rotate-180">
              <div className="h-full rounded-full bg-[#ff5a00]" style={{ width: `${item.home}%` }} />
            </div>
            <p className="text-center text-xs font-black uppercase text-[#6f717c]">{item.label}</p>
            <div className="h-3 overflow-hidden rounded-full bg-[#eef0f4]">
              <div className="h-full rounded-full bg-[#4f8cff]" style={{ width: `${item.away}%` }} />
            </div>
            <p className="text-right font-mono text-sm font-black text-[#4f8cff]">{item.away}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 text-xs font-black text-[#6f717c]">
        <span>{event.home.name}</span>
        <span className="text-right">{event.away.name}</span>
      </div>
    </div>
  );
}

export function ExpectedStatsTable({ event, analysis }: { event: EventInsight; analysis: MatchAnalysis }) {
  if (analysis.expectedStats.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="grid grid-cols-[1.2fr_1fr_1fr] bg-[#26262d] px-4 py-3 text-sm font-black text-white">
        <span>Metrica</span>
        <span>{event.home.shortName}</span>
        <span>{event.away.shortName}</span>
      </div>
      {analysis.expectedStats.map((stat) => (
        <div key={stat.label} className="grid grid-cols-[1.2fr_1fr_1fr] border-t border-[#ececf1] px-4 py-3 text-sm">
          <span className="font-bold text-[#6f717c]">{stat.label}</span>
          <span className="font-black">{stat.home}</span>
          <span className="font-black">{stat.away}</span>
        </div>
      ))}
    </div>
  );
}

function marketNumericPercent(market: PredictiveMarket) {
  if (!market.value.endsWith("%")) return null;
  const parsed = Number(market.value.replace("%", ""));
  return Number.isNaN(parsed) ? null : Math.min(100, Math.max(0, parsed));
}

export function PredictiveMarketsPanel({ analysis }: { analysis: MatchAnalysis }) {
  if (analysis.predictiveMarkets.length === 0) return null;

  const groups = ["Resultado", "Goles", "Produccion", "Disciplina", "Control"] as const;

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const markets = analysis.predictiveMarkets.filter((market) => market.group === group);
        if (markets.length === 0) return null;

        return (
          <div key={group} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="font-black">{group}</p>
              <span className="rounded-full bg-[#fff0e8] px-2.5 py-1 text-[11px] font-black uppercase text-[#ff5a00]">
                GOUP
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {markets.map((market) => {
                const percent = marketNumericPercent(market);

                return (
                  <article key={market.id} className="rounded-lg border border-[#ececf1] bg-[#f7f7f9] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black leading-tight">{market.label}</p>
                        {market.detail && (
                          <p className="mt-1 text-xs font-bold leading-5 text-[#6f717c]">{market.detail}</p>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-lg font-black text-[#ff5a00]">{market.value}</span>
                    </div>
                    {percent !== null && (
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e0e2e8]">
                        <div className="h-full rounded-full bg-[#ff5a00]" style={{ width: `${percent}%` }} />
                      </div>
                    )}
                    {market.confidence !== undefined && (
                      <p className="mt-2 text-[11px] font-bold text-[#8a8d98]">
                        Confianza modelo {market.confidence}%
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function HistoricalMetricsTable({ event, analysis }: { event: EventInsight; analysis: MatchAnalysis }) {
  const metrics = analysis.historicalMetrics ?? [];

  if (metrics.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="grid grid-cols-[1.2fr_1fr_1fr] bg-[#171820] px-4 py-3 text-sm font-black text-white">
        <span>Historico GOUP</span>
        <span>{event.home.shortName}</span>
        <span>{event.away.shortName}</span>
      </div>
      {metrics.map((metric) => (
        <div key={metric.label} className="grid grid-cols-[1.2fr_1fr_1fr] border-t border-[#ececf1] px-4 py-3 text-sm">
          <div>
            <span className="font-bold text-[#6f717c]">{metric.label}</span>
            <p className="mt-0.5 text-[11px] font-semibold text-[#9a9da7]">
              Basado en {metric.sampleSize} partidos
            </p>
          </div>
          <span className="font-black">{metric.home}</span>
          <span className="font-black">{metric.away}</span>
        </div>
      ))}
    </div>
  );
}

function FactorGroup({ title, factors }: { title: string; factors: ModelFactor[] }) {
  if (factors.length === 0) return null;

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="font-black">{title}</p>
      <div className="mt-3 space-y-3">
        {factors.map((factor) => (
          <div key={factor.label} className="rounded-lg bg-[#f5f6f9] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black">{factor.label}</p>
                {factor.value && <p className="mt-1 text-xs font-bold text-[#ff5a00]">{factor.value}</p>}
              </div>
              <span className="font-mono text-sm font-black text-[#ff5a00]">
                {factor.impact > 0 ? "+" : ""}
                {factor.impact}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#6f717c]">{factor.explanation}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PredictionFactors({ analysis }: { analysis: MatchAnalysis }) {
  const groups = [
    { title: "Factores favorables", factors: analysis.favorableFactors },
    { title: "Factores desfavorables", factors: analysis.unfavorableFactors },
    { title: "Incertidumbres", factors: analysis.uncertainties },
  ].filter((group) => group.factors.length > 0);

  if (groups.length === 0) return null;

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {groups.map((group) => (
        <FactorGroup key={group.title} title={group.title} factors={group.factors} />
      ))}
    </div>
  );
}

export function HeadToHeadTimeline({ analysis }: { analysis: MatchAnalysis }) {
  if (analysis.headToHead.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="space-y-3">
        {analysis.headToHead.map((match) => (
          <div key={`${match.date}-${match.score}`} className="grid gap-2 rounded-lg bg-[#f5f6f9] p-3 sm:grid-cols-[110px_1fr_auto] sm:items-center">
            <span className="text-xs font-black text-[#8a8d98]">{match.date}</span>
            <span className="font-black">{match.home} {match.score} {match.away}</span>
            <span className="text-xs font-bold text-[#6f717c]">{match.competition}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoupPlayerCard({ player }: { player: FeaturedPlayerCard }) {
  const topAttributes = player.attributes.slice(0, 3);

  return (
    <article className="rounded-xl bg-[#171820] p-3 text-white shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-black leading-tight">{player.name}</h3>
          <p className="mt-0.5 truncate text-[11px] font-bold text-white/60">
            {player.team} · {player.position}
          </p>
        </div>
        <div className="shrink-0 rounded-lg bg-[#ff5a00] px-2 py-1 text-center">
          <p className="text-2xl font-black leading-none">{player.score}</p>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {topAttributes.map((attribute) => (
          <div key={attribute.label}>
            <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
              <span className="text-white/60">{attribute.label}</span>
              <span className="font-mono">{attribute.value}</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-[#ff5a00]" style={{ width: `${attribute.value}%` }} />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

export function FeaturedPlayerCards({ analysis }: { analysis: MatchAnalysis }) {
  if (analysis.featuredPlayers.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {analysis.featuredPlayers.map((player) => (
        <GoupPlayerCard key={player.id} player={player} />
      ))}
    </div>
  );
}
