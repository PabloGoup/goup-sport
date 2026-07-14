import type { EventInsight, EventStatus } from "@/domain/sports-intelligence/types";
import type { ApiSportsBasketballGameResponse } from "./types";

function mapGameStatus(status: string): EventStatus {
  if (["Q1", "Q2", "Q3", "Q4", "OT", "HT", "LIVE"].includes(status)) return "live";
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

function gameDate(game: ApiSportsBasketballGameResponse) {
  if (game.timestamp) return new Date(game.timestamp * 1000).toISOString();
  if (game.time) return new Date(`${game.date}T${game.time}Z`).toISOString();
  return new Date(game.date).toISOString();
}

export function normalizeBasketballGame(game: ApiSportsBasketballGameResponse): EventInsight {
  const season = Number(game.league.season);

  return {
    id: `apisports-basketball-game-${game.id}`,
    sport: "basketball",
    league: game.league.name,
    leagueId: String(game.league.id),
    country: game.country.name,
    season: Number.isNaN(season) ? undefined : season,
    round: game.stage ?? game.week ?? undefined,
    startsAt: gameDate(game),
    status: mapGameStatus(game.status.short),
    statusLabel: game.status.long,
    home: {
      id: `apisports-basketball-team-${game.teams.home.id}`,
      name: game.teams.home.name,
      shortName: shortName(game.teams.home.name),
      form: [],
      logoUrl: game.teams.home.logo ?? undefined,
      country: game.country.name,
    },
    away: {
      id: `apisports-basketball-team-${game.teams.away.id}`,
      name: game.teams.away.name,
      shortName: shortName(game.teams.away.name),
      form: [],
      logoUrl: game.teams.away.logo ?? undefined,
      country: game.country.name,
    },
    venue: "Venue pending",
    confidence: 0,
    modelVersion: "external-data-only",
    source: {
      id: `apisports-basketball-game-${game.id}`,
      provider: "API-Sports Basketball",
      collectedAt: new Date().toISOString(),
      normalizedVersion: "api-sports-basketball-normalizer-0.1.0",
    },
  };
}
