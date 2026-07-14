import { NextResponse } from "next/server";
import {
  ApiSportsConfigError,
  ApiSportsRequestError,
  getBasketballGames,
} from "@/infrastructure/api-sports/client";
import { normalizeBasketballGame } from "@/infrastructure/api-sports/basketball-normalizers";

function isIsoDate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const league = searchParams.get("league") ?? undefined;
  const season = searchParams.get("season") ?? undefined;
  const team = searchParams.get("team") ?? undefined;
  const live = searchParams.get("live") ?? undefined;

  if (date && !isIsoDate(date)) {
    return NextResponse.json(
      { apiVersion: "v1", error: { code: "invalid_filter", message: "date must use YYYY-MM-DD format." } },
      { status: 400 },
    );
  }

  if (!date && !league && !team && !live) {
    return NextResponse.json(
      {
        apiVersion: "v1",
        error: { code: "missing_filter", message: "Provide at least one filter: date, league, team, or live." },
      },
      { status: 400 },
    );
  }

  try {
    const raw = await getBasketballGames({ date: date ?? undefined, league, season, team, live });

    return NextResponse.json({
      apiVersion: "v1",
      data: raw.response.map(normalizeBasketballGame),
      meta: {
        provider: "api-sports-basketball",
        rawResults: raw.results,
        paging: raw.paging,
        normalizedOnly: true,
      },
    });
  } catch (error) {
    if (error instanceof ApiSportsConfigError) {
      return NextResponse.json(
        { apiVersion: "v1", error: { code: "provider_not_configured", message: "API_SPORTS_KEY is not configured on the server." } },
        { status: 503 },
      );
    }

    if (error instanceof ApiSportsRequestError) {
      return NextResponse.json(
        { apiVersion: "v1", error: { code: "provider_request_failed", message: error.message, status: error.status } },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { apiVersion: "v1", error: { code: "provider_unknown_error", message: "Unexpected API-Sports basketball integration error." } },
      { status: 500 },
    );
  }
}
