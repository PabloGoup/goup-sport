import { NextResponse } from "next/server";
import { listPredictions } from "@/domain/sports-intelligence/service";

export function GET() {
  return NextResponse.json({
    apiVersion: "v1",
    data: listPredictions(),
    meta: {
      disclaimer: "Sports intelligence only. This API does not provide betting advice.",
      explainability: "Each prediction includes model version, factors, caveats, and source data.",
    },
  });
}
