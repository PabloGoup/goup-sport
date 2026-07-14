import Link from "next/link";
import { notFound } from "next/navigation";
import { EventCard, PageShell, SectionHeader } from "@/components/sports-shell/ui";
import {
  ExpectedStatsTable,
  FeaturedPlayerCards,
  HeadToHeadTimeline,
  HistoricalMetricsTable,
  MatchHero,
  MatchTabs,
  PredictiveMarketsPanel,
  TeamComparisonBars,
} from "@/components/sports-shell/match-analysis";
import {
  AIExperimentalBadge,
  AIExplanation,
  AIObservations,
  AIPredictionFactors,
  PlayerInsights,
  PossibleResultsPanel,
  TeamVisualScore,
} from "@/components/sports-shell/ai-analysis";
import { getEventDetail, getMatchAnalysis } from "@/domain/sports-intelligence/service";
import { getStoredProviderEventById } from "@/application/sports-intelligence/stored-events";
import { getStoredCalendarEventById } from "@/application/sports-intelligence/stored-calendar-events";
import { getFootballHistoricalMetrics } from "@/application/sports-intelligence/football-historical-metrics";
import { getFootballFeaturedPlayers } from "@/application/sports-intelligence/football-history-context";
import { getLatestEventAnalysis } from "@/application/ai-enrichment/analysis-reader";
import {
  getFootballStatisticalPrediction,
  getFootballHeadToHead,
} from "@/application/prediction/football-prediction";
import { getFootballStatMarkets } from "@/application/prediction/team-stat-prediction";

type EventDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params;
  const detail = getEventDetail(id);
  const realEvent = detail ? null : (await getStoredCalendarEventById(id)) ?? (await getStoredProviderEventById(id));

  if (!detail && !realEvent) notFound();

  const event = detail?.event ?? realEvent;
  if (!event) notFound();

  const relatedEvents = detail?.relatedEvents ?? [];
  const [historicalMetrics, featuredPlayers, rawPrediction, headToHead, statMarkets] = await Promise.all([
    getFootballHistoricalMetrics(event),
    getFootballFeaturedPlayers(event),
    event.sport === "football"
      ? getFootballStatisticalPrediction({
          homeTeam: event.home.name,
          awayTeam: event.away.name,
          // El modelo usa todo el historico disponible para una muestra robusta.
        })
      : Promise.resolve(null),
    event.sport === "football"
      ? getFootballHeadToHead(event.home.name, event.away.name)
      : Promise.resolve([]),
    event.sport === "football"
      ? getFootballStatMarkets(event.home.name, event.away.name)
      : Promise.resolve([]),
  ]);

  // Prediccion estadistica propia (modelo Poisson) desde goles historicos reales.
  const statisticalPrediction = rawPrediction
    ? {
        modelVersion: rawPrediction.modelVersion,
        lambdaHome: rawPrediction.lambdaHome,
        lambdaAway: rawPrediction.lambdaAway,
        probabilities: rawPrediction.probabilities,
        expectedScore: rawPrediction.expectedScore,
        topScorelines: rawPrediction.topScorelines,
        confidence: rawPrediction.confidence,
        caveats: rawPrediction.caveats,
        simulation: {
          iterations: rawPrediction.simulation.iterations,
          homeWins: rawPrediction.simulation.homeWins,
          draws: rawPrediction.simulation.draws,
          awayWins: rawPrediction.simulation.awayWins,
        },
      }
    : null;

  const analysis = getMatchAnalysis(event, {
    historicalMetrics,
    featuredPlayers,
    statisticalPrediction,
    headToHead,
    extraMarkets: statMarkets,
  });
  const aiAnalysis = await getLatestEventAnalysis(event.id);

  // Los "posibles resultados" del analisis IA muestran los numeros del modelo
  // Poisson (autoritativos), no una estimacion propia de Groq.
  const modelResults = statisticalPrediction
    ? [
        {
          label: `Victoria ${event.home.name}`,
          probability: statisticalPrediction.probabilities.homeWin,
          source: "STATISTICAL_MODEL",
        },
        {
          label: "Empate",
          probability: statisticalPrediction.probabilities.draw,
          source: "STATISTICAL_MODEL",
        },
        {
          label: `Victoria ${event.away.name}`,
          probability: statisticalPrediction.probabilities.awayWin,
          source: "STATISTICAL_MODEL",
        },
      ]
    : undefined;
  const hasAiAnalysis = aiAnalysis?.status === "COMPLETED";
  const hasSimulation = analysis.simulations.total > 0;
  const hasScorelines = analysis.scorelines.length > 0;
  const hasPredictiveMarkets = analysis.predictiveMarkets.length > 0;
  const hasExpectedStats = analysis.expectedStats.length > 0;
  const hasTeamComparison = analysis.teamComparison.length > 0;
  const hasPlayers = analysis.featuredPlayers.length > 0;
  const hasHistoricalMetrics = (analysis.historicalMetrics?.length ?? 0) > 0;
  const hasHeadToHead = analysis.headToHead.length > 0;
  return (
    <PageShell active="/eventos">
      <div className="p-3 sm:p-5">
        <Link href="/eventos" className="mb-3 inline-block text-sm font-black text-[#ff5a00] sm:mb-4">
          Volver a eventos
        </Link>

        <MatchHero event={event} analysis={analysis} />
        <MatchTabs />

        <div className="mt-3 sm:mt-4">
          <div className="space-y-4 sm:space-y-5">
            {hasAiAnalysis && (
              <section id="analisis-ia" className="scroll-mt-36">
                <SectionHeader
                  eyebrow="Analisis IA"
                  title="Enriquecimiento generativo"
                  description="Contenido explicativo generado a partir de los datos almacenados en GOUP SPORT. No es una recomendacion de apuesta."
                />
                <div className="space-y-3">
                  <AIExperimentalBadge />
                  <AIExplanation analysis={aiAnalysis} />
                  <PossibleResultsPanel analysis={aiAnalysis} results={modelResults} />
                  <AIPredictionFactors analysis={aiAnalysis} />
                  <AIObservations analysis={aiAnalysis} />
                  <PlayerInsights analysis={aiAnalysis} />
                  <TeamVisualScore
                    analysis={aiAnalysis}
                    homeName={event.home.name}
                    awayName={event.away.name}
                  />
                </div>
              </section>
            )}

            <section id="prediccion" className="scroll-mt-36">
              <SectionHeader
                eyebrow="Prediccion"
                title="Escenarios y marcador probable"
                description="La prediccion se muestra como lectura analitica trazable, no como recomendacion de apuesta."
              />
              <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
                <div className="rounded-xl bg-white p-4 shadow-sm">
                  <p className="font-black">Distribucion de probabilidades</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-3">
                    <div className="rounded-lg bg-[#fff0e8] p-3 sm:p-4">
                      <p className="text-xs font-black text-[#ff5a00]">{event.home.name}</p>
                      <p className="mt-1 text-2xl font-black sm:mt-2 sm:text-3xl">{analysis.probabilities.homeWin}%</p>
                    </div>
                    {analysis.probabilities.draw !== undefined && (
                      <div className="rounded-lg bg-[#fff7df] p-3 sm:p-4">
                        <p className="text-xs font-black text-[#b67700]">Empate</p>
                        <p className="mt-1 text-2xl font-black sm:mt-2 sm:text-3xl">{analysis.probabilities.draw}%</p>
                      </div>
                    )}
                    <div className="rounded-lg bg-[#eef4ff] p-3 sm:p-4">
                      <p className="text-xs font-black text-[#2e6fd1]">{event.away.name}</p>
                      <p className="mt-1 text-2xl font-black sm:mt-2 sm:text-3xl">{analysis.probabilities.awayWin}%</p>
                    </div>
                  </div>
                  {hasSimulation && (
                    <div className="mt-4 rounded-lg bg-[#f5f6f9] p-4">
                      <p className="text-sm font-black">Simulacion</p>
                      <p className="mt-2 text-sm leading-6 text-[#6f717c]">
                        De {analysis.simulations.total.toLocaleString("es-CL")} escenarios: {analysis.simulations.homeWins} victorias locales, {analysis.simulations.draws ?? 0} empates y {analysis.simulations.awayWins} victorias visitantes.
                      </p>
                    </div>
                  )}
                </div>
                {hasScorelines && (
                  <div className="rounded-xl bg-white p-4 shadow-sm">
                    <p className="font-black">Marcadores mas probables</p>
                    <div className="mt-3 space-y-2">
                      {analysis.scorelines.map((scoreline) => (
                        <div key={scoreline.label} className="flex items-center justify-between rounded-lg bg-[#f5f6f9] px-3 py-2">
                          <span className="font-black">{scoreline.label}</span>
                          <span className="font-mono text-sm font-black text-[#ff5a00]">{scoreline.probability}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {hasPredictiveMarkets && (
              <section id="mercados-predictivos" className="scroll-mt-36">
                <SectionHeader
                  eyebrow="Indicadores"
                  title="Mercados predictivos"
                  description="Probabilidades e indicadores estadisticos disponibles para el evento."
                />
                <PredictiveMarketsPanel analysis={analysis} />
              </section>
            )}

            {hasTeamComparison && (
              <section id="equipos" className="scroll-mt-36">
                <SectionHeader eyebrow="Equipos" title="Comparacion versus" />
                <TeamComparisonBars event={event} analysis={analysis} />
              </section>
            )}

            {hasPlayers && (
              <section id="jugadores" className="scroll-mt-36">
                <SectionHeader eyebrow="Jugadores" title="Cartas GOUP destacadas" />
                <FeaturedPlayerCards analysis={analysis} />
              </section>
            )}

            {(hasExpectedStats || hasHistoricalMetrics) && (
              <section id="estadisticas" className="scroll-mt-36">
                <SectionHeader eyebrow="Estadisticas" title="Matriz de partido" />
                <div className="space-y-3">
                  <ExpectedStatsTable event={event} analysis={analysis} />
                  <HistoricalMetricsTable event={event} analysis={analysis} />
                </div>
              </section>
            )}

            {hasHeadToHead && (
              <section id="historial" className="scroll-mt-36">
                <SectionHeader eyebrow="Historial" title="Enfrentamientos recientes" />
                <HeadToHeadTimeline analysis={analysis} />
              </section>
            )}

          </div>
        </div>

        {relatedEvents.length > 0 && (
          <section className="mt-4 sm:mt-5">
            <SectionHeader eyebrow="Relacionados" title="Mas eventos del mismo deporte" />
            <div className="grid gap-3 lg:grid-cols-3">
              {relatedEvents.map((related) => (
                <EventCard key={related.id} event={related} />
              ))}
            </div>
          </section>
        )}
      </div>
    </PageShell>
  );
}
