import { describe, expect, it } from "vitest";
import { buildInputHash, canonicalJson } from "@/application/ai-enrichment/input-hash";
import { buildSampleInput } from "./fixtures";

describe("canonicalJson", () => {
  it("ordena claves de forma estable", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });

  it("normaliza floats a 4 decimales", () => {
    expect(canonicalJson({ x: 0.123456789 })).toBe(canonicalJson({ x: 0.12345 }));
  });

  it("omite undefined y serializa null", () => {
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
  });
});

describe("buildInputHash", () => {
  it("es determinista para el mismo input", () => {
    const a = buildInputHash(buildSampleInput(), "event-analysis-v1");
    const b = buildInputHash(buildSampleInput(), "event-analysis-v1");
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("cambia cuando cambian los datos del evento", () => {
    const base = buildInputHash(buildSampleInput(), "event-analysis-v1");
    const changed = buildInputHash(
      buildSampleInput({ startsAt: "2026-07-21T18:00:00.000Z" }),
      "event-analysis-v1",
    );
    expect(changed).not.toBe(base);
  });

  it("cambia cuando cambia la version del prompt", () => {
    const input = buildSampleInput();
    expect(buildInputHash(input, "event-analysis-v1")).not.toBe(
      buildInputHash(input, "event-analysis-v2"),
    );
  });

  it("cambia cuando cambia la version del feature builder", () => {
    const base = buildInputHash(buildSampleInput(), "event-analysis-v1");
    const changed = buildInputHash(
      buildSampleInput({ meta: { featureVersion: "feature-builder-v2" } }),
      "event-analysis-v1",
    );
    expect(changed).not.toBe(base);
  });
});
