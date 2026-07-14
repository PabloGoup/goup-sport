import { NextResponse } from "next/server";
import { getLatestEventAnalysis } from "@/application/ai-enrichment/analysis-reader";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const analysis = await getLatestEventAnalysis(id);

  if (!analysis) {
    return NextResponse.json(
      {
        apiVersion: "v1",
        error: {
          code: "analysis_not_found",
          message: "No analysis exists for this event yet.",
        },
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    apiVersion: "v1",
    data: analysis,
    meta: {
      traceable: true,
      experimental: analysis.analysisType === "EXPERIMENTAL_AI",
    },
  });
}
