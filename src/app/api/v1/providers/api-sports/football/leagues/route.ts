import { NextResponse } from "next/server";
import {
  ApiSportsConfigError,
  ApiSportsRequestError,
  getFootballLeagues,
} from "@/infrastructure/api-sports/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const season = searchParams.get("season") ?? undefined;

  if (season && !/^\d{4}$/.test(season)) {
    return NextResponse.json(
      {
        apiVersion: "v1",
        error: {
          code: "invalid_filter",
          message: "season must use YYYY format.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const raw = await getFootballLeagues({
      id: searchParams.get("id") ?? undefined,
      name: searchParams.get("name") ?? undefined,
      country: searchParams.get("country") ?? undefined,
      code: searchParams.get("code") ?? undefined,
      season,
      team: searchParams.get("team") ?? undefined,
      type: searchParams.get("type") ?? undefined,
      current: searchParams.get("current") ?? undefined,
    });

    return NextResponse.json({
      apiVersion: "v1",
      data: raw.response,
      meta: {
        provider: "api-sports",
        rawResults: raw.results,
        paging: raw.paging,
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
      { apiVersion: "v1", error: { code: "provider_unknown_error", message: "Unexpected API-Sports integration error." } },
      { status: 500 },
    );
  }
}
