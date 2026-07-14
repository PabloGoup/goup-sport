import type { AggregatesByScope } from "./feature-builder-shared";
import { pickMetrics } from "./feature-builder-shared";

const FOOTBALL_METRIC_KEYS = [
  "xg_total",
  "xg_conceded",
  "goals_total",
  "goals_conceded",
  "shots_total",
  "shots_on_target",
  "shot_accuracy",
  "passes_total",
  "pass_completion",
  "possession",
  "pressures_total",
  "ball_recoveries",
  "carries_total",
];

export function buildFootballSpecific(aggregates: AggregatesByScope) {
  return pickMetrics(aggregates, FOOTBALL_METRIC_KEYS);
}
