import { NextResponse } from "next/server";
import {
  ApiSportsConfigError,
  ApiSportsRequestError,
  getFootballFixtureStatistics,
} from "@/infrastructure/api-sports/client";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);

  if (!/^\d+$/.test(id)) {
    return NextResponse.json(
      {
        apiVersion: "v1",
        error: {
          code: "invalid_fixture_id",
          message: "Fixture id must be numeric.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const raw = await getFootballFixtureStatistics({
      fixture: id,
      team: searchParams.get("team") ?? undefined,
    });

    return NextResponse.json({
      apiVersion: "v1",
      data: raw.response,
      meta: {
        provider: "api-sports",
        rawResults: raw.results,
        paging: raw.paging,
        fixture: id,
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
