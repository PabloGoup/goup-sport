import { NextResponse } from "next/server";
import {
  ApiSportsConfigError,
  ApiSportsRequestError,
  getFootballCountries,
} from "@/infrastructure/api-sports/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    const raw = await getFootballCountries({
      name: searchParams.get("name") ?? undefined,
      code: searchParams.get("code") ?? undefined,
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
