import { NextResponse } from "next/server";
import { searchSportsIntelligence } from "@/domain/sports-intelligence/service";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const results = searchSportsIntelligence(query);

  return NextResponse.json({
    apiVersion: "v1",
    data: results,
    meta: {
      query,
      count: results.length,
    },
  });
}
