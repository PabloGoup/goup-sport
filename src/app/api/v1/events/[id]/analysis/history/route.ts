import { NextResponse } from "next/server";
import { getEventAnalysisHistory } from "@/application/ai-enrichment/analysis-reader";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const history = await getEventAnalysisHistory(id);

  return NextResponse.json({
    apiVersion: "v1",
    data: history,
    meta: {
      traceable: true,
      count: history.length,
    },
  });
}
