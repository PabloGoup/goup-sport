import type {
  ApiSportsEnvelope,
  ApiSportsFootballCountryResponse,
  ApiSportsFootballFixtureEventResponse,
  ApiSportsFootballFixtureResponse,
  ApiSportsFootballFixtureStatisticResponse,
  ApiSportsFootballLeagueResponse,
  ApiSportsBasketballGameResponse,
  ApiSportsBasketballLeagueResponse,
} from "./types";

const defaultFootballBaseUrl = "https://v3.football.api-sports.io";
const defaultBasketballBaseUrl = "https://v1.basketball.api-sports.io";

export class ApiSportsConfigError extends Error {
  constructor() {
    super("API_SPORTS_KEY is required to call API-Sports.");
  }
}

export class ApiSportsRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(message);
  }
}

function getApiSportsKey() {
  const key = process.env.API_SPORTS_KEY;
  if (!key) throw new ApiSportsConfigError();
  return key;
}

function getFootballBaseUrl() {
  return process.env.API_SPORTS_FOOTBALL_BASE_URL ?? defaultFootballBaseUrl;
}

function getBasketballBaseUrl() {
  return process.env.API_SPORTS_BASKETBALL_BASE_URL ?? defaultBasketballBaseUrl;
}

export async function apiSportsFootballGet<T>(
  path: string,
  params: Record<string, string | number | undefined>,
) {
  const url = new URL(path, `${getFootballBaseUrl()}/`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-apisports-key": getApiSportsKey(),
    },
    next: {
      revalidate: 60 * 15,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ApiSportsRequestError("API-Sports request failed.", response.status, body);
  }

  return (await response.json()) as ApiSportsEnvelope<T>;
}

export async function apiSportsBasketballGet<T>(
  path: string,
  params: Record<string, string | number | undefined>,
) {
  const url = new URL(path, `${getBasketballBaseUrl()}/`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-apisports-key": getApiSportsKey(),
    },
    next: {
      revalidate: 60 * 15,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ApiSportsRequestError("API-Sports basketball request failed.", response.status, body);
  }

  return (await response.json()) as ApiSportsEnvelope<T>;
}

export async function getFootballFixtures(params: {
  id?: string;
  date?: string;
  from?: string;
  to?: string;
  league?: string;
  season?: string;
  team?: string;
  next?: string;
  live?: string;
}) {
  return apiSportsFootballGet<ApiSportsFootballFixtureResponse>("fixtures", params);
}

export async function getFootballCountries(params: { name?: string; code?: string } = {}) {
  return apiSportsFootballGet<ApiSportsFootballCountryResponse>("countries", params);
}

export async function getFootballLeagues(params: {
  id?: string;
  name?: string;
  country?: string;
  code?: string;
  season?: string;
  team?: string;
  type?: string;
  current?: string;
}) {
  return apiSportsFootballGet<ApiSportsFootballLeagueResponse>("leagues", params);
}

export async function getFootballFixtureStatistics(params: { fixture: string; team?: string }) {
  return apiSportsFootballGet<ApiSportsFootballFixtureStatisticResponse>("fixtures/statistics", params);
}

export async function getFootballFixtureEvents(params: {
  fixture: string;
  team?: string;
  player?: string;
  type?: string;
}) {
  return apiSportsFootballGet<ApiSportsFootballFixtureEventResponse>("fixtures/events", params);
}

export async function getFootballFixtureLineups(params: { fixture: string; team?: string }) {
  return apiSportsFootballGet<unknown>("fixtures/lineups", params);
}

export async function getFootballFixturePlayers(params: { fixture: string; team?: string }) {
  return apiSportsFootballGet<unknown>("fixtures/players", params);
}

export async function getBasketballGames(params: {
  id?: string;
  date?: string;
  league?: string;
  season?: string;
  team?: string;
  live?: string;
}) {
  return apiSportsBasketballGet<ApiSportsBasketballGameResponse>("games", params);
}

export async function getBasketballLeagues(params: {
  id?: string;
  name?: string;
  country?: string;
  season?: string;
  team?: string;
  type?: string;
}) {
  return apiSportsBasketballGet<ApiSportsBasketballLeagueResponse>("leagues", params);
}

export async function getBasketballGameTeamStatistics(params: { id: string; team?: string }) {
  return apiSportsBasketballGet<unknown>("games/statistics/teams", params);
}

export async function getBasketballGamePlayerStatistics(params: { id: string; team?: string }) {
  return apiSportsBasketballGet<unknown>("games/statistics/players", params);
}
