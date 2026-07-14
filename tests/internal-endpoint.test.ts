import { afterEach, beforeEach, describe, expect, it } from "vitest";

const originalEnv = { ...process.env };

async function loadRoute() {
  // Import dinamico para que el handler lea el process.env de cada test.
  return import("@/app/api/internal/jobs/enrich-events/route");
}

function buildRequest(authorization?: string) {
  return new Request("http://localhost/api/internal/jobs/enrich-events", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });
}

describe("POST /api/internal/jobs/enrich-events", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "super-secreto";
    process.env.GROQ_ENRICHMENT_ENABLED = "false";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("rechaza peticiones sin secreto", async () => {
    const { POST } = await loadRoute();
    const response = await POST(buildRequest());
    expect(response.status).toBe(401);
  });

  it("rechaza secretos incorrectos", async () => {
    const { POST } = await loadRoute();
    const response = await POST(buildRequest("Bearer otro-secreto"));
    expect(response.status).toBe(401);
  });

  it("rechaza todo si CRON_SECRET no esta configurado", async () => {
    delete process.env.CRON_SECRET;
    const { POST } = await loadRoute();
    const response = await POST(buildRequest("Bearer super-secreto"));
    expect(response.status).toBe(401);
  });

  it("responde 503 con secreto valido pero integracion desactivada", async () => {
    const { POST } = await loadRoute();
    const response = await POST(buildRequest("Bearer super-secreto"));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error.code).toBe("enrichment_disabled");
  });
});
