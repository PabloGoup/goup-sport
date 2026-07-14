import { NextResponse } from "next/server";
import { getEventDetail } from "@/domain/sports-intelligence/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = getEventDetail(id);

  if (!detail) {
    return NextResponse.json(
      {
        apiVersion: "v1",
        error: {
          code: "event_not_found",
          message: "Event does not exist.",
        },
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    apiVersion: "v1",
    data: detail,
    meta: {
      traceable: true,
      explainability: Boolean(detail.prediction),
    },
  });
}
