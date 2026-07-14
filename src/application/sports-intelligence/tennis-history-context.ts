import { getPrisma } from "@/lib/prisma";

type TennisResult = {
  result: "W" | "L";
  opponent: string;
  score: string;
  date: string;
  competition: string;
};

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreFromPayload(payload: unknown) {
  const row = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  return typeof row.score === "string" ? row.score : "";
}

export async function getTennisRecentResults(playerName: string, limit = 5): Promise<TennisResult[]> {
  try {
    const prisma = getPrisma();
    const target = normalizeName(playerName);
    const events = await prisma.event.findMany({
      where: {
        sportId: "sport-tennis",
        status: "completed",
        dataSource: { provider: "Jeff Sackmann Tennis Data" },
      },
      include: {
        home: { select: { name: true } },
        away: { select: { name: true } },
        league: { select: { name: true } },
      },
      orderBy: { startsAt: "desc" },
      take: 800,
    });

    const results: TennisResult[] = [];
    for (const event of events) {
      const homeName = normalizeName(event.home.name);
      const awayName = normalizeName(event.away.name);
      const isWinner = homeName === target;
      const isLoser = awayName === target;
      if (!isWinner && !isLoser) continue;

      results.push({
        result: isWinner ? "W" : "L",
        opponent: isWinner ? event.away.name : event.home.name,
        score: scoreFromPayload(event.rawPayload),
        date: event.startsAt.toISOString().slice(0, 10),
        competition: event.league.name,
      });

      if (results.length >= limit) break;
    }

    return results;
  } catch {
    return [];
  }
}

export async function getTennisRecentForm(playerName: string, limit = 5) {
  const results = await getTennisRecentResults(playerName, limit);
  return results.map((result) => result.result);
}
