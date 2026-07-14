import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runEnrichmentJob } from "@/application/ai-enrichment/enrichment-job";

export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  const headerBuffer = Buffer.from(header);
  const expectedBuffer = Buffer.from(expected);
  if (headerBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(headerBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Invalid or missing cron secret." } },
      { status: 401 },
    );
  }

  if (process.env.GROQ_ENRICHMENT_ENABLED !== "true") {
    return NextResponse.json(
      {
        error: {
          code: "enrichment_disabled",
          message: "GROQ_ENRICHMENT_ENABLED must be true to run this job.",
        },
      },
      { status: 503 },
    );
  }

  try {
    const summary = await runEnrichmentJob({ trigger: "cron" });
    return NextResponse.json({ data: summary });
  } catch (error) {
    console.error("[enrich] el job de cron fallo:", error);
    return NextResponse.json(
      { error: { code: "job_failed", message: "Enrichment job failed. Check server logs." } },
      { status: 500 },
    );
  }
}
