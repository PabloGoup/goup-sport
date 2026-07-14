import { getPrisma } from "@/lib/prisma";
import type { EventInsight, HistoricalTeamMetric } from "@/domain/sports-intelligence/types";

const metricLabels: Record<string, string> = {
  xg_total: "xG promedio",
  shots_total: "Tiros promedio",
  shots_on_target: "Tiros al arco",
  shot_accuracy: "Precision de remate",
  passes_total: "Pases promedio",
  pass_completion: "Precision de pase",
  pressures_total: "Presiones",
  ball_recoveries: "Recuperaciones",
  carries_total: "Conducciones",
};

const preferredMetrics = [
  "xg_total",
  "shots_total",
  "shots_on_target",
  "shot_accuracy",
  "passes_total",
  "pass_completion",
  "pressures_total",
  "ball_recoveries",
  "carries_total",
];

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function formatMetric(metricKey: string, value?: number) {
  if (value === undefined) return "";
  if (["shot_accuracy", "pass_completion", "dribble_completion"].includes(metricKey)) {
    return `${Math.round(value * 100)}%`;
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export async function getFootballHistoricalMetrics(event: EventInsight): Promise<HistoricalTeamMetric[]> {
  if (event.sport !== "football") return [];

  try {
    const prisma = getPrisma();
    const participants = await prisma.participant.findMany({
      where: {
        sportId: "sport-football",
        type: "team",
      },
      include: {
        teamAggregateMetrics: {
          where: {
            source: "StatsBomb Open Data",
            scope: "statsbomb-imported-matches",
            metricKey: { in: preferredMetrics },
          },
        },
      },
    });

    const homeCandidates = participants.filter(
      (participant) =>
        normalizeName(participant.name) === normalizeName(event.home.name) &&
        participant.teamAggregateMetrics.length > 0,
    );
    const awayCandidates = participants.filter(
      (participant) =>
        normalizeName(participant.name) === normalizeName(event.away.name) &&
        participant.teamAggregateMetrics.length > 0,
    );
    const home = homeCandidates[0];
    const away = awayCandidates[0];

    if (!home && !away) return [];

    const source = "StatsBomb Open Data";

    return preferredMetrics
      .map((metricKey) => {
        const homeMetric = home?.teamAggregateMetrics.find((metric) => metric.metricKey === metricKey);
        const awayMetric = away?.teamAggregateMetrics.find((metric) => metric.metricKey === metricKey);
        if (!homeMetric || !awayMetric) return null;

        return {
          label: metricLabels[metricKey] ?? metricKey,
          home: formatMetric(metricKey, homeMetric?.metricValue),
          away: formatMetric(metricKey, awayMetric?.metricValue),
          source,
          sampleSize: Math.max(homeMetric?.sampleSize ?? 0, awayMetric?.sampleSize ?? 0),
        };
      })
      .filter((metric): metric is HistoricalTeamMetric => Boolean(metric));
  } catch {
    return [];
  }
}
