import { NextResponse } from "next/server";
import {
  ApiSportsConfigError,
  ApiSportsRequestError,
} from "@/infrastructure/api-sports/client";
import { previewFootballFixtures } from "@/infrastructure/api-sports/collector";

function isIsoDate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const league = searchParams.get("league") ?? undefined;
  const season = searchParams.get("season") ?? undefined;
  const team = searchParams.get("team") ?? undefined;
  const next = searchParams.get("next") ?? undefined;
  const live = searchParams.get("live") ?? undefined;

  if (date && !isIsoDate(date)) {
    return NextResponse.json(
      {
        apiVersion: "v1",
        error: {
          code: "invalid_filter",
          message: "date must use YYYY-MM-DD format.",
        },
      },
      { status: 400 },
    );
  }

  if ((from && !isIsoDate(from)) || (to && !isIsoDate(to))) {
    return NextResponse.json(
      {
        apiVersion: "v1",
        error: {
          code: "invalid_filter",
          message: "from and to must use YYYY-MM-DD format.",
        },
      },
      { status: 400 },
    );
  }

  if ((from && !to) || (!from && to)) {
    return NextResponse.json(
      {
        apiVersion: "v1",
        error: {
          code: "invalid_filter",
          message: "from and to must be provided together.",
        },
      },
      { status: 400 },
    );
  }

  if (!date && !from && !to && !league && !team && !next && !live) {
    return NextResponse.json(
      {
        apiVersion: "v1",
        error: {
          code: "missing_filter",
          message: "Provide at least one filter: date, from/to, league, team, next, or live.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const preview = await previewFootballFixtures({
      date: date ?? undefined,
      from: from ?? undefined,
      to: to ?? undefined,
      league,
      season,
      team,
      next,
      live,
    });

    return NextResponse.json({
      apiVersion: "v1",
      data: preview.normalized,
      meta: {
        provider: preview.provider,
        rawResults: preview.raw.results,
        paging: preview.raw.paging,
        normalizedOnly: true,
      },
    });
  } catch (error) {
    if (error instanceof ApiSportsConfigError) {
      return NextResponse.json(
        {
          apiVersion: "v1",
          error: {
            code: "provider_not_configured",
            message: "API_SPORTS_KEY is not configured on the server.",
          },
        },
        { status: 503 },
      );
    }

    if (error instanceof ApiSportsRequestError) {
      return NextResponse.json(
        {
          apiVersion: "v1",
          error: {
            code: "provider_request_failed",
            message: error.message,
            status: error.status,
          },
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        apiVersion: "v1",
        error: {
          code: "provider_unknown_error",
          message: "Unexpected API-Sports integration error.",
        },
      },
      { status: 500 },
    );
  }
}
