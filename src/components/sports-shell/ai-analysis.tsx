import type { PublicEventAnalysis } from "@/application/ai-enrichment/analysis-reader";

// Todos los textos se renderizan escapados por React; nunca usar
// dangerouslySetInnerHTML con contenido generado por el modelo.

type NamedList = { participantA?: string[]; participantB?: string[] };
type PossibleResult = { label?: string; probability?: number; source?: string };
type Observation = { title?: string; description?: string; category?: string; importance?: number };
type Uncertainty = { description?: string; severity?: string };
type KeyFactor = { label?: string; description?: string; direction?: string; impact?: number };
type PlayerInsight = { playerName?: string; observation?: string; confidence?: number };
type ScoreBlock = {
  overall?: number;
  form?: number;
  attack?: number;
  defense?: number;
  consistency?: number;
  momentum?: number;
};
type VisualScores = { participantA?: ScoreBlock; participantB?: ScoreBlock };
type PredictedOutcome = { label?: string; explanation?: string };

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asObject<T>(value: unknown): T {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as T) : ({} as T);
}

function percent(value?: number) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "";
}

function isWeakAnalysisText(value?: string | null) {
  if (!value) return true;
  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const weakPatterns = [
    "falta de datos",
    "datos sobre lesiones",
    "alineaciones",
    "imbatible",
    "emocionante",
    "gran talento",
    "bien estructurado",
    "modelo experimental no validado",
    "confianza moderada",
  ];

  return weakPatterns.some((pattern) => normalized.includes(pattern));
}

function usefulTexts(values: Array<string | undefined | null>) {
  return values.filter((value): value is string => Boolean(value) && !isWeakAnalysisText(value));
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="font-black">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function AIStatusNotice({ status }: { status: string }) {
  const messages: Record<string, string> = {
    PENDING: "Este evento esta en cola para el proximo ciclo de analisis IA.",
    PROCESSING: "El analisis IA de este evento se esta generando.",
    FAILED: "El ultimo intento de analisis IA fallo. Se reintentara en el proximo ciclo.",
    SKIPPED: "El analisis IA se habilitara en un proximo ciclo de actualizacion.",
    STALE: "Los datos del evento cambiaron; el analisis IA se regenerara en el proximo ciclo.",
  };

  return (
    <div className="rounded-xl border border-dashed border-[#d9d2c7] bg-white/60 p-4 text-sm font-bold text-[#6b6357]">
      {messages[status] ?? "El analisis IA se habilitara en un proximo ciclo de actualizacion."}
    </div>
  );
}

export function AIExperimentalBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-[#fff0e8] px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#ff5a00]">
      Analisis generativo experimental · baja confianza · no validado por modelo estadistico propio
    </span>
  );
}

export function AIExplanation({ analysis }: { analysis: PublicEventAnalysis }) {
  const outcome = asObject<PredictedOutcome>(analysis.predictedOutcome);
  const summaries = usefulTexts([analysis.shortSummary, analysis.detailedSummary, outcome.explanation]);
  const showOutcome = outcome.label && !isWeakAnalysisText(outcome.label);
  const showMeta = typeof analysis.confidence === "number" || typeof analysis.dataQualityScore === "number";

  if (!showOutcome && summaries.length === 0 && !showMeta) return null;

  return (
    <Card title={analysis.headline ?? "Analisis del evento"}>
      <div className="space-y-3 text-sm">
        {showOutcome && (
          <p className="font-bold">
            Lectura principal: <span className="text-[#ff5a00]">{outcome.label}</span>
          </p>
        )}
        {summaries.map((summary) => (
          <p key={summary} className="text-[#4c463c]">{summary}</p>
        ))}
        {showMeta && (
          <p className="text-xs font-bold text-[#6b6357]">
            {[
              typeof analysis.confidence === "number" ? `Confianza ${percent(analysis.confidence)}` : null,
              typeof analysis.dataQualityScore === "number" ? `Calidad de datos ${percent(analysis.dataQualityScore)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>
    </Card>
  );
}

export function PossibleResultsPanel({
  analysis,
  results: override,
}: {
  analysis: PublicEventAnalysis;
  results?: PossibleResult[];
}) {
  const results = override && override.length > 0 ? override : asArray<PossibleResult>(analysis.possibleResults);
  if (results.length === 0) return null;

  return (
    <Card title="Posibles resultados">
      <ul className="space-y-2">
        {results.map((result, index) => (
          <li key={`${result.label}-${index}`} className="flex items-center justify-between gap-3 text-sm">
            <span className="font-bold">{result.label}</span>
            <span className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#6b6357]">
                {result.source === "STATISTICAL_MODEL" ? "Modelo estadistico" : "IA experimental"}
              </span>
              <span className="rounded bg-[#fff0e8] px-2 py-0.5 font-black text-[#ff5a00]">
                {percent(result.probability)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function AIPredictionFactors({ analysis }: { analysis: PublicEventAnalysis }) {
  const factors = asArray<KeyFactor>(analysis.keyFactors).filter(
    (factor) => !isWeakAnalysisText(factor.label) && !isWeakAnalysisText(factor.description),
  );
  if (factors.length === 0) return null;

  return (
    <Card title="Factores del analisis">
      <ul className="space-y-3">
        {factors.map((factor, index) => (
          <li key={`${factor.label}-${index}`} className="text-sm">
            <p className="font-bold">
              {factor.label}
              <span className="ml-2 text-xs font-black text-[#6b6357]">
                impacto {percent(factor.impact)}
              </span>
            </p>
            <p className="text-[#4c463c]">{factor.description}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function StrengthList({ title, items }: { title: string; items: string[] }) {
  const filtered = items.filter((item) => !isWeakAnalysisText(item));
  if (filtered.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-[#6b6357]">{title}</p>
      <ul className="mt-1 list-inside list-disc space-y-1 text-sm">
        {filtered.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function StrengthsWeaknesses({
  analysis,
  homeName,
  awayName,
}: {
  analysis: PublicEventAnalysis;
  homeName: string;
  awayName: string;
}) {
  const strengths = asObject<NamedList>(analysis.strengths);
  const weaknesses = asObject<NamedList>(analysis.weaknesses);
  const filtered = {
    strengthsA: (strengths.participantA ?? []).filter((item) => !isWeakAnalysisText(item)),
    strengthsB: (strengths.participantB ?? []).filter((item) => !isWeakAnalysisText(item)),
    weaknessesA: (weaknesses.participantA ?? []).filter((item) => !isWeakAnalysisText(item)),
    weaknessesB: (weaknesses.participantB ?? []).filter((item) => !isWeakAnalysisText(item)),
  };
  const empty = Object.values(filtered).every((items) => items.length === 0);
  if (empty) return null;

  return (
    <Card title="Fortalezas y debilidades">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <p className="font-black">{homeName}</p>
          <StrengthList title="Fortalezas" items={filtered.strengthsA} />
          <StrengthList title="Debilidades" items={filtered.weaknessesA} />
        </div>
        <div className="space-y-3">
          <p className="font-black">{awayName}</p>
          <StrengthList title="Fortalezas" items={filtered.strengthsB} />
          <StrengthList title="Debilidades" items={filtered.weaknessesB} />
        </div>
      </div>
    </Card>
  );
}

function dedupeByText<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalized = key(item).trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export function UncertaintyPanel({ analysis }: { analysis: PublicEventAnalysis }) {
  const uncertainties = dedupeByText(
    asArray<Uncertainty>(analysis.uncertainties),
    (item) => item.description ?? "",
  ).filter((item) => !isWeakAnalysisText(item.description));
  const limitations = dedupeByText(asArray<string>(analysis.modelLimitations), (item) => item).filter(
    (limitation) =>
      !isWeakAnalysisText(limitation) &&
      !uncertainties.some((u) => (u.description ?? "").trim().toLowerCase() === limitation.trim().toLowerCase()),
  );
  if (uncertainties.length === 0 && limitations.length === 0) return null;

  const severityStyles: Record<string, string> = {
    HIGH: "bg-[#d84545] text-white",
    MEDIUM: "bg-[#f1b034] text-[#211b0d]",
    LOW: "bg-[#e8e2d6] text-[#4c463c]",
  };

  return (
    <Card title="Incertidumbres y limitaciones">
      <ul className="space-y-2 text-sm">
        {uncertainties.map((item, index) => (
          <li key={`uncertainty-${index}`} className="flex items-start gap-2">
            <span
              className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-black ${severityStyles[item.severity ?? "LOW"] ?? severityStyles.LOW}`}
            >
              {item.severity ?? "LOW"}
            </span>
            <span>{item.description}</span>
          </li>
        ))}
        {limitations.map((item, index) => (
          <li key={`limitation-${index}`} className="text-[#6b6357]">
            {item}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function PlayerInsights({ analysis }: { analysis: PublicEventAnalysis }) {
  const insights = asArray<PlayerInsight>(analysis.playerInsights).filter(
    (insight) => !isWeakAnalysisText(insight.playerName) && !isWeakAnalysisText(insight.observation),
  );
  if (insights.length === 0) return null;

  return (
    <Card title="Observaciones de jugadores">
      <ul className="space-y-3 text-sm">
        {insights.map((insight, index) => (
          <li key={`${insight.playerName}-${index}`}>
            <p className="font-bold">
              {insight.playerName}
              {typeof insight.confidence === "number" && (
                <span className="ml-2 text-xs font-black text-[#6b6357]">
                  confianza {percent(insight.confidence)}
                </span>
              )}
            </p>
            <p className="text-[#4c463c]">{insight.observation}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function AIObservations({ analysis }: { analysis: PublicEventAnalysis }) {
  const observations = asArray<Observation>(analysis.observations).filter(
    (observation) => !isWeakAnalysisText(observation.title) && !isWeakAnalysisText(observation.description),
  );
  if (observations.length === 0) return null;

  return (
    <Card title="Observaciones">
      <ul className="space-y-3 text-sm">
        {observations.map((observation, index) => (
          <li key={`${observation.title}-${index}`}>
            <p className="font-bold">
              {observation.title}
              <span className="ml-2 rounded bg-[#e8e2d6] px-1.5 py-0.5 text-[10px] font-black text-[#4c463c]">
                {observation.category ?? "OTHER"}
              </span>
            </p>
            <p className="text-[#4c463c]">{observation.description}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ScoreColumn({ name, scores }: { name: string; scores: ScoreBlock }) {
  const rows: Array<[string, number | undefined]> = [
    ["General", scores.overall],
    ["Forma", scores.form],
    ["Ataque", scores.attack],
    ["Defensa", scores.defense],
    ["Consistencia", scores.consistency],
    ["Momentum", scores.momentum],
  ];

  return (
    <div>
      <p className="font-black">{name}</p>
      <ul className="mt-2 space-y-2">
        {rows.filter(([, value]) => typeof value === "number").map(([label, value]) => (
          <li key={label} className="text-sm">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#4c463c]">{label}</span>
              <span className="font-black">{Math.round(value ?? 0)}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#e8e2d6]">
              <div
                className="h-full rounded-full bg-[#ff5a00]"
                style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TeamVisualScore({
  analysis,
  homeName,
  awayName,
}: {
  analysis: PublicEventAnalysis;
  homeName: string;
  awayName: string;
}) {
  const scores = asObject<VisualScores>(analysis.visualScores);
  if (!scores.participantA && !scores.participantB) return null;

  // Si el modelo asigno puntuaciones identicas a ambos equipos, no tuvo datos
  // para diferenciarlos: ocultamos en vez de mostrar barras iguales enganosas.
  if (
    scores.participantA &&
    scores.participantB &&
    JSON.stringify(scores.participantA) === JSON.stringify(scores.participantB)
  ) {
    return null;
  }

  return (
    <Card title="Puntuacion visual GOUP">
      <div className="grid gap-4 sm:grid-cols-2">
        <ScoreColumn name={homeName} scores={scores.participantA ?? {}} />
        <ScoreColumn name={awayName} scores={scores.participantB ?? {}} />
      </div>
    </Card>
  );
}
