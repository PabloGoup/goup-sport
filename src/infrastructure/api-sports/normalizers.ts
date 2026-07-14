import type { EventInsight, EventStatus } from "@/domain/sports-intelligence/types";
import type { ApiSportsFootballFixtureResponse } from "./types";

function mapFixtureStatus(status: string): EventStatus {
  if (["1H", "HT", "2H", "ET", "BT", "P", "LIVE"].includes(status)) return "live";
  if (["NS", "TBD"].includes(status)) return "upcoming";
  return "today";
}

function shortName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function normalizeFootballFixture(fixture: ApiSportsFootballFixtureResponse): EventInsight {
  const venue = [fixture.fixture.venue?.name, fixture.fixture.venue?.city].filter(Boolean).join(", ");

  return {
    id: `apisports-football-fixture-${fixture.fixture.id}`,
    sport: "football",
    league: fixture.league.name,
    leagueId: String(fixture.league.id),
    country: fixture.league.country,
    season: fixture.league.season,
    round: fixture.league.round,
    startsAt: fixture.fixture.date,
    status: mapFixtureStatus(fixture.fixture.status.short),
    statusLabel: fixture.fixture.status.long,
    home: {
      id: `apisports-football-team-${fixture.teams.home.id}`,
      name: fixture.teams.home.name,
      shortName: shortName(fixture.teams.home.name),
      form: [],
      logoUrl: fixture.teams.home.logo,
      country: fixture.league.country,
    },
    away: {
      id: `apisports-football-team-${fixture.teams.away.id}`,
      name: fixture.teams.away.name,
      shortName: shortName(fixture.teams.away.name),
      form: [],
      logoUrl: fixture.teams.away.logo,
      country: fixture.league.country,
    },
    venue: venue || "Venue pending",
    confidence: 0,
    modelVersion: "external-data-only",
    source: {
      id: `apisports-football-fixture-${fixture.fixture.id}`,
      provider: "API-Sports Football",
      collectedAt: new Date().toISOString(),
      normalizedVersion: "api-sports-football-normalizer-0.1.0",
    },
  };
}

export function normalizeFootballFixtures(fixtures: ApiSportsFootballFixtureResponse[]) {
  return fixtures.map(normalizeFootballFixture);
}
