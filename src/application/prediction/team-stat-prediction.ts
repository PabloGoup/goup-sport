import { getPrisma } from "@/lib/prisma";
import { poissonProbability } from "@/domain/prediction/football-poisson";
import type { PredictiveMarket } from "@/domain/sports-intelligence/types";

type StatConfig = {
  key: string;
  group: PredictiveMarket["group"];
  label: string;
  /** Lineas over/under a emitir (vacio = solo total esperado). */
  lines: number[];
};

const STAT_CONFIG: StatConfig[] = [
  { key: "corners", group: "Produccion", label: "corners", lines: [8.5, 9.5, 10.5] },
  { key: "shots", group: "Produccion", label: "tiros", lines: [] },
  { key: "shots_on_target", group: "Produccion", label: "tiros al arco", lines: [] },
  { key: "yellow_cards", group: "Disciplina", label: "tarjetas", lines: [3.5, 4.5] },
  { key: "fouls", group: "Disciplina", label: "faltas", lines: [20.5, 25.5] },
];

const MIN_SAMPLES = 4;

function poissonCdf(k: number, lambda: number): number {
  let sum = 0;
  for (let i = 0; i <= k; i += 1) sum += poissonProbability(i, lambda);
  return Math.min(1, sum);
}

function pct(probability: number): string {
  return `${Math.round(probability * 100)}%`;
}

/** Promedio de una metrica por equipo (nombre), sobre partidos completados. */
async function teamStatAverages(
  prisma: ReturnType<typeof getPrisma>,
  teamName: string,
): Promise<{ byKey: Map<string, number>; samples: number }> {
  const participants = await prisma.participant.findMany({
    where: { sportId: "sport-football", name: { equals: teamName, mode: "insensitive" } },
    select: { id: true },
  });
  const ids = participants.map((p) => p.id);
  const byKey = new Map<string, number>();
  if (ids.length === 0) return { byKey, samples: 0 };

  const rows = await prisma.teamMatchMetric.findMany({
    where: {
      participantId: { in: ids },
      metricKey: { in: STAT_CONFIG.map((s) => s.key) },
      event: { status: "completed" },
    },
    select: { metricKey: true, metricValue: true, eventId: true },
  });

  const sums = new Map<string, { total: number; count: number }>();
  const events = new Set<string>();
  for (const row of rows) {
    events.add(row.eventId);
    const entry = sums.get(row.metricKey) ?? { total: 0, count: 0 };
    entry.total += row.metricValue;
    entry.count += 1;
    sums.set(row.metricKey, entry);
  }
  for (const [key, { total, count }] of sums) byKey.set(key, total / count);

  return { byKey, samples: events.size };
}

/**
 * Mercados de estadisticas de equipo (Nivel B) predichos pre-partido: corners,
 * tarjetas, tiros y faltas esperados, con over/under. Se calculan desde el
 * historial real por partido (TeamMatchMetric). Devuelve [] si falta muestra.
 */
export async function getFootballStatMarkets(
  homeTeam: string,
  awayTeam: string,
  client?: ReturnType<typeof getPrisma>,
): Promise<PredictiveMarket[]> {
  try {
    const prisma = client ?? getPrisma();
    const [home, away] = await Promise.all([
      teamStatAverages(prisma, homeTeam),
      teamStatAverages(prisma, awayTeam),
    ]);

    if (home.samples < MIN_SAMPLES || away.samples < MIN_SAMPLES) return [];

    const confidence = Math.round(Math.min(0.55, Math.min(home.samples, away.samples) / 20) * 100);
    const markets: PredictiveMarket[] = [];

    for (const stat of STAT_CONFIG) {
      const homeAvg = home.byKey.get(stat.key);
      const awayAvg = away.byKey.get(stat.key);
      if (homeAvg === undefined || awayAvg === undefined) continue;

      const expectedTotal = homeAvg + awayAvg;
      markets.push({
        id: `stat-${stat.key}-total`,
        group: stat.group,
        label: `Total de ${stat.label} esperado`,
        value: expectedTotal.toFixed(1),
        detail: `Local ${homeAvg.toFixed(1)} · Visita ${awayAvg.toFixed(1)}`,
        confidence,
      });

      for (const line of stat.lines) {
        const over = 1 - poissonCdf(Math.floor(line), expectedTotal);
        markets.push({
          id: `stat-${stat.key}-over-${line}`,
          group: stat.group,
          label: `Mas de ${line} ${stat.label}`,
          value: pct(over),
          confidence,
        });
      }
    }

    return markets;
  } catch {
    return [];
  }
}
