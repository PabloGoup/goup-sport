import type { AggregatesByScope } from "./feature-builder-shared";
import { pickMetrics } from "./feature-builder-shared";

const TENNIS_METRIC_KEYS = [
  "ranking",
  "elo",
  "elo_surface",
  "surface_win_pct",
  "hold_pct",
  "break_pct",
  "first_serve_pct",
  "return_points_won_pct",
  "recent_match_minutes",
];

export function buildTennisSpecific(aggregates: AggregatesByScope) {
  return pickMetrics(aggregates, TENNIS_METRIC_KEYS);
}
