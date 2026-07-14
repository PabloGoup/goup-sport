import type { AggregatesByScope } from "./feature-builder-shared";
import { pickMetrics } from "./feature-builder-shared";

const BASKETBALL_METRIC_KEYS = [
  "elo",
  "points_scored",
  "points_conceded",
  "offensive_rating",
  "defensive_rating",
  "pace",
  "field_goal_pct",
  "three_point_pct",
  "rebounds",
  "turnovers",
];

export function buildBasketballSpecific(aggregates: AggregatesByScope) {
  return pickMetrics(aggregates, BASKETBALL_METRIC_KEYS);
}
