import { NextResponse } from "next/server";
import { getPredictionDetail } from "@/domain/sports-intelligence/service";

export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const prediction = getPredictionDetail(eventId);

  if (!prediction) {
    return NextResponse.json(
      {
        apiVersion: "v1",
        error: {
          code: "prediction_not_found",
          message: "Prediction does not exist for this event.",
        },
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    apiVersion: "v1",
    data: prediction,
    meta: {
      traceable: true,
      explainability: true,
    },
  });
}
