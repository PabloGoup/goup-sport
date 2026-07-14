import type { EventInsight } from "@/domain/sports-intelligence/types";
import { previewFootballFixtures } from "@/infrastructure/api-sports/collector";

type RealFootballEventFilters = {
  id?: string;
  date?: string;
  live?: string;
  next?: string;
  limit?: number;
};

export async function listRealFootballEvents(filters: RealFootballEventFilters = {}) {
  try {
    const preview = await previewFootballFixtures({
      id: filters.id,
      date: filters.date,
      live: filters.live,
      next: filters.next,
    });

    return preview.normalized.slice(0, filters.limit ?? 24);
  } catch {
    return [];
  }
}

export async function getRealFootballEventById(id: string) {
  const fixtureId = id.replace("apisports-football-fixture-", "");
  if (!fixtureId || fixtureId === id) return null;

  const events = await listRealFootballEvents({ id: fixtureId, limit: 1 });
  return events[0] ?? null;
}

export function mergeUniqueEvents(primary: EventInsight[], secondary: EventInsight[]) {
  const seen = new Set<string>();

  return [...primary, ...secondary].filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}
