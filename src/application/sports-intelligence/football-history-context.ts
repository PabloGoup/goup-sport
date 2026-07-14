import { readFile } from "node:fs/promises";
import path from "node:path";
import { getPrisma } from "@/lib/prisma";
import type { EventInsight, FeaturedPlayerCard, Team } from "@/domain/sports-intelligence/types";

type StatsBombEventPayload = {
  match?: {
    home_score?: number | null;
    away_score?: number | null;
    goals1?: Array<{ name?: string; minute?: string }>;
    goals2?: Array<{ name?: string; minute?: string }>;
  };
  goals?: {
    home?: number | null;
    away?: number | null;
  };
};

type StatsBombLineup = Array<{
  team_name?: string;
  lineup?: Array<{
    player_id?: number;
    player_name?: string;
    player_nickname?: string | null;
    country?: { name?: string };
    positions?: Array<{ position?: string; from?: string; to?: string | null }>;
  }>;
}>;

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugId(value: string) {
  return normalizeName(value).replace(/\s+/g, "-");
}

function resultForTeam(event: {
  startsAt?: Date;
  round?: string | null;
  league?: { name?: string };
  home: { name: string };
  away: { name: string };
  rawPayload: unknown;
}, teamName: string) {
  const payload = event.rawPayload as StatsBombEventPayload;
  const homeScore = payload.match?.home_score ?? payload.goals?.home;
  const awayScore = payload.match?.away_score ?? payload.goals?.away;

  if (homeScore === null || homeScore === undefined || awayScore === null || awayScore === undefined) {
    return null;
  }

  const isHome = normalizeName(event.home.name) === normalizeName(teamName);
  const isAway = normalizeName(event.away.name) === normalizeName(teamName);
  if (!isHome && !isAway) return null;
  if (homeScore === awayScore) return "D";

  const teamWon = isHome ? homeScore > awayScore : awayScore > homeScore;
  return teamWon ? "W" : "L";
}

function resultDetailForTeam(event: {
  startsAt: Date;
  round?: string | null;
  league?: { name?: string };
  home: { name: string };
  away: { name: string };
  rawPayload: unknown;
}, teamName: string): NonNullable<Team["recentResults"]>[number] | null {
  const payload = event.rawPayload as StatsBombEventPayload;
  const homeScore = payload.match?.home_score ?? payload.goals?.home;
  const awayScore = payload.match?.away_score ?? payload.goals?.away;
  const result = resultForTeam(event, teamName);
  if (!result || homeScore === null || homeScore === undefined || awayScore === null || awayScore === undefined) {
    return null;
  }

  const isHome = normalizeName(event.home.name) === normalizeName(teamName);

  return {
    result,
    opponent: isHome ? event.away.name : event.home.name,
    score: isHome ? `${homeScore}-${awayScore}` : `${awayScore}-${homeScore}`,
    date: event.startsAt.toISOString(),
    competition: event.round ?? event.league?.name ?? "Partido",
  };
}

export async function getFootballRecentForm(
  teamName: string,
  options: { limit?: number; providers?: string[] } | number = {},
  client?: ReturnType<typeof getPrisma>,
) {
  const limit = typeof options === "number" ? options : (options.limit ?? 5);
  const providers =
    typeof options === "number"
      ? ["StatsBomb Open Data", "OpenFootball"]
      : (options.providers ?? ["StatsBomb Open Data", "OpenFootball"]);
  const prisma = client ?? getPrisma();
  const events = await prisma.event.findMany({
    where: {
      sportId: "sport-football",
      status: "completed",
      dataSource: {
        provider: {
          in: providers,
        },
      },
    },
    include: {
      home: true,
      away: true,
    },
    orderBy: {
      startsAt: "desc",
    },
    take: 500,
  });

  return events
    .map((event) => resultForTeam(event, teamName))
    .filter((result): result is "W" | "D" | "L" => Boolean(result))
    .slice(0, limit);
}

export async function getFootballRecentResults(
  teamName: string,
  options: { limit?: number; providers?: string[] } = {},
  client?: ReturnType<typeof getPrisma>,
) {
  const limit = options.limit ?? 5;
  const providers = options.providers ?? ["OpenFootball", "StatsBomb Open Data", "TheSportsDB"];
  const prisma = client ?? getPrisma();
  const events = await prisma.event.findMany({
    where: {
      sportId: "sport-football",
      status: "completed",
      dataSource: {
        provider: {
          in: providers,
        },
      },
    },
    include: {
      home: true,
      away: true,
      league: true,
    },
    orderBy: {
      startsAt: "desc",
    },
    take: 500,
  });

  return events
    .map((event) => resultDetailForTeam(event, teamName))
    .filter((result): result is NonNullable<Team["recentResults"]>[number] => Boolean(result))
    .slice(0, limit);
}

export function recentFormProvidersForEvent(event: EventInsight) {
  if (event.source.provider === "OpenFootball" && event.season === 2026 && event.league === "World Cup") {
    return ["OpenFootball"];
  }

  return ["OpenFootball", "StatsBomb Open Data", "TheSportsDB"];
}

function scoreForPosition(position?: string) {
  if (!position) return 78;
  if (/forward|wing|striker|attacking/i.test(position)) return 88;
  if (/midfield|center/i.test(position)) return 84;
  if (/back|defender|keeper|goal/i.test(position)) return 81;
  return 78;
}

async function readStatsBombLineup(matchId: string): Promise<StatsBombLineup | null> {
  const filePath = path.join(
    process.cwd(),
    "data-providers/statsbomb-open-data/data/lineups",
    `${matchId}.json`,
  );

  try {
    return JSON.parse(await readFile(filePath, "utf8")) as StatsBombLineup;
  } catch {
    return null;
  }
}

export async function getFootballFeaturedPlayers(event: EventInsight): Promise<FeaturedPlayerCard[]> {
  if (event.sport !== "football") return [];

  try {
    const prisma = getPrisma();
    const teamNames = [event.home.name, event.away.name].map(normalizeName);
    const openFootballMatches = await prisma.event.findMany({
      where: {
        sportId: "sport-football",
        status: "completed",
        dataSource: {
          provider: "OpenFootball",
        },
      },
      include: {
        home: true,
        away: true,
      },
      orderBy: {
        startsAt: "desc",
      },
      take: 200,
    });
    const scorers = new Map<string, FeaturedPlayerCard>();

    for (const match of openFootballMatches) {
      const payload = match.rawPayload as StatsBombEventPayload;
      const goalGroups = [
        { team: match.home.name, goals: payload.match?.goals1 ?? [] },
        { team: match.away.name, goals: payload.match?.goals2 ?? [] },
      ];

      for (const group of goalGroups) {
        if (!teamNames.includes(normalizeName(group.team))) continue;

        for (const goal of group.goals) {
          if (!goal.name) continue;

          const key = `${group.team}-${goal.name}`;
          const current = scorers.get(key);
          if (current) {
            current.score = Math.min(99, current.score + 4);
            current.form = Math.min(99, current.form + 4);
            current.projection = `${current.projection} · ${goal.minute ?? "gol"}'`;
            current.attributes = current.attributes.map((attribute) =>
              attribute.label === "Impacto" || attribute.label === "Definicion"
                ? { ...attribute, value: Math.min(99, attribute.value + 5) }
                : attribute,
            );
            continue;
          }

          scorers.set(key, {
            id: `openfootball-recent-scorer-${slugId(group.team)}-${slugId(goal.name)}`,
            name: goal.name,
            team: group.team,
            position: "Goleador reciente",
            nationality: group.team,
            score: 86,
            form: 86,
            projection: goal.minute ? `Gol reciente ${goal.minute}'` : "Gol reciente",
            attributes: [
              { label: "Impacto", value: 88 },
              { label: "Definicion", value: 86 },
              { label: "Forma", value: 86 },
              { label: "Actualidad", value: 94 },
              { label: "Consistencia", value: 80 },
              { label: "Trazabilidad", value: 92 },
            ],
          });
        }
      }
    }

    const recentScorerCards = Array.from(scorers.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    if (recentScorerCards.length > 0) return recentScorerCards;

    const recentMatches = await prisma.event.findMany({
      where: {
        sportId: "sport-football",
        status: "completed",
        dataSource: {
          provider: {
            in: ["StatsBomb Open Data", "OpenFootball"],
          },
        },
      },
      include: {
        home: true,
        away: true,
      },
      orderBy: {
        startsAt: "desc",
      },
      take: 200,
    });

    const cards: FeaturedPlayerCard[] = [];

    for (const match of recentMatches) {
      const matchHasParticipant =
        teamNames.includes(normalizeName(match.home.name)) ||
        teamNames.includes(normalizeName(match.away.name));
      if (!matchHasParticipant || !match.externalId) continue;

      const lineups = await readStatsBombLineup(match.externalId);
      if (!lineups) continue;

      for (const team of lineups) {
        if (!team.team_name || !teamNames.includes(normalizeName(team.team_name))) continue;

        for (const player of team.lineup ?? []) {
          const position = player.positions?.find((item) => item.from === "00:00")?.position ?? player.positions?.[0]?.position;
          const score = scoreForPosition(position);

          cards.push({
            id: `statsbomb-player-${player.player_id ?? player.player_name}`,
            name: player.player_nickname ?? player.player_name ?? "Jugador",
            team: team.team_name,
            position: position ?? "Jugador",
            nationality: player.country?.name ?? team.team_name,
            score,
            form: score,
            projection: "Historial StatsBomb",
            attributes: [
              { label: "Impacto", value: score },
              { label: "Forma", value: score - 2 },
              { label: "Consistencia", value: score - 4 },
              { label: "Influencia", value: score - 1 },
              { label: "Disponibilidad", value: 90 },
              { label: "Trazabilidad", value: 88 },
            ],
          });

          if (cards.length >= 4) return cards;
        }
      }
    }

    return cards;
  } catch {
    return [];
  }
}
