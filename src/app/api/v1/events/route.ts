import { NextResponse } from "next/server";
import { isEventSort, isEventStatus, isSport, listEvents } from "@/domain/sports-intelligence/service";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sportParam = searchParams.get("sport");
  const statusParam = searchParams.get("status");
  const sortParam = searchParams.get("sort");
  const minConfidenceParam = searchParams.get("minConfidence");

  if (sportParam && !isSport(sportParam)) {
    return NextResponse.json(
      {
        apiVersion: "v1",
        error: { code: "invalid_filter", message: "Unsupported sport filter." },
      },
      { status: 400 },
    );
  }

  if (statusParam && !isEventStatus(statusParam)) {
    return NextResponse.json(
      {
        apiVersion: "v1",
        error: { code: "invalid_filter", message: "Unsupported status filter." },
      },
      { status: 400 },
    );
  }

  if (sortParam && !isEventSort(sortParam)) {
    return NextResponse.json(
      {
        apiVersion: "v1",
        error: { code: "invalid_filter", message: "Unsupported sort option." },
      },
      { status: 400 },
    );
  }

  if (
    minConfidenceParam &&
    (Number.isNaN(Number(minConfidenceParam)) ||
      Number(minConfidenceParam) < 0 ||
      Number(minConfidenceParam) > 100)
  ) {
    return NextResponse.json(
      {
        apiVersion: "v1",
        error: { code: "invalid_filter", message: "minConfidence must be a number from 0 to 100." },
      },
      { status: 400 },
    );
  }

  const sport = isSport(sportParam) ? sportParam : undefined;
  const status = isEventStatus(statusParam) ? statusParam : undefined;
  const sort = isEventSort(sortParam) ? sortParam : undefined;
  const minConfidence =
    minConfidenceParam && !Number.isNaN(Number(minConfidenceParam))
      ? Number(minConfidenceParam)
      : undefined;

  return NextResponse.json({
    apiVersion: "v1",
    data: listEvents({ sport, status, sort, minConfidence }),
    meta: {
      traceable: true,
      rateLimitPlan: "public-demo",
      filters: {
        sport: sport ?? null,
        status: status ?? null,
        sort: sort ?? null,
        minConfidence: minConfidence ?? null,
      },
    },
  });
}
