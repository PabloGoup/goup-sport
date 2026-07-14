import type { EventInsight } from "@/domain/sports-intelligence/types";

export type ApiSportsFootballFixtureResponse = {
  fixture: {
    id: number;
    date: string;
    timezone: string;
    venue?: {
      id?: number | null;
      name?: string | null;
      city?: string | null;
    };
    status: {
      short: string;
      long: string;
      elapsed?: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country?: string;
    season: number;
    round?: string;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo?: string;
      winner?: boolean | null;
    };
    away: {
      id: number;
      name: string;
      logo?: string;
      winner?: boolean | null;
    };
  };
  goals: {
    home?: number | null;
    away?: number | null;
  };
};

export type ApiSportsFootballCountryResponse = {
  name: string;
  code?: string | null;
  flag?: string | null;
};

export type ApiSportsFootballLeagueResponse = {
  league: {
    id: number;
    name: string;
    type: string;
    logo?: string | null;
  };
  country: {
    name: string;
    code?: string | null;
    flag?: string | null;
  };
  seasons: Array<{
    year: number;
    start: string;
    end: string;
    current: boolean;
  }>;
};

export type ApiSportsFootballFixtureStatisticResponse = {
  team: {
    id: number;
    name: string;
    logo?: string | null;
  };
  statistics: Array<{
    type: string;
    value: string | number | null;
  }>;
};

export type ApiSportsFootballFixtureEventResponse = {
  time: {
    elapsed: number;
    extra?: number | null;
  };
  team: {
    id: number;
    name: string;
    logo?: string | null;
  };
  player: {
    id?: number | null;
    name?: string | null;
  };
  assist: {
    id?: number | null;
    name?: string | null;
  };
  type: string;
  detail: string;
  comments?: string | null;
};

export type ApiSportsEnvelope<T> = {
  get: string;
  parameters: Record<string, string>;
  errors: unknown[] | Record<string, unknown>;
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: T[];
};

export type ApiSportsFixturePreview = {
  provider: "api-sports";
  normalized: EventInsight[];
  raw: ApiSportsEnvelope<ApiSportsFootballFixtureResponse>;
};

export type ApiSportsBasketballGameResponse = {
  id: number;
  date: string;
  time?: string | null;
  timestamp?: number;
  timezone?: string;
  stage?: string | null;
  week?: string | null;
  status: {
    long: string;
    short: string;
    timer?: string | null;
  };
  league: {
    id: number;
    name: string;
    type?: string;
    season?: string | number;
    logo?: string | null;
  };
  country: {
    id?: number;
    name?: string;
    code?: string | null;
    flag?: string | null;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo?: string | null;
    };
    away: {
      id: number;
      name: string;
      logo?: string | null;
    };
  };
  scores?: {
    home?: {
      total?: number | null;
    };
    away?: {
      total?: number | null;
    };
  };
};

export type ApiSportsBasketballLeagueResponse = {
  id: number;
  name: string;
  type?: string;
  logo?: string | null;
  country?: {
    id?: number;
    name?: string;
    code?: string | null;
    flag?: string | null;
  };
  seasons?: Array<{
    season: string | number;
    start?: string;
    end?: string;
    current?: boolean;
  }>;
};
