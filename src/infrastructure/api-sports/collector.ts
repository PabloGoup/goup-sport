import { getFootballFixtures } from "./client";
import { normalizeFootballFixtures } from "./normalizers";
import type { ApiSportsFixturePreview } from "./types";

export async function previewFootballFixtures(params: {
  id?: string;
  date?: string;
  from?: string;
  to?: string;
  league?: string;
  season?: string;
  team?: string;
  next?: string;
  live?: string;
}): Promise<ApiSportsFixturePreview> {
  const raw = await getFootballFixtures(params);

  return {
    provider: "api-sports",
    normalized: normalizeFootballFixtures(raw.response),
    raw,
  };
}
