import { describe, expect, it, vi } from "vitest";
import { withRetries } from "@/infrastructure/ai/retry";
import { GroqProviderError } from "@/infrastructure/ai/groq/groq-errors";

const immediateSleep = () => Promise.resolve();

describe("withRetries", () => {
  it("reintenta errores 429 y respeta Retry-After", async () => {
    const delays: number[] = [];
    const fn = vi
      .fn()
      .mockRejectedValueOnce(
        new GroqProviderError("rate limited", { kind: "rate_limited", status: 429, retryAfterMs: 1234 }),
      )
      .mockResolvedValue("ok");

    const result = await withRetries(fn, {
      maxRetries: 3,
      sleep: immediateSleep,
      onRetry: (_attempt, delayMs) => delays.push(delayMs),
    });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(delays).toEqual([1234]);
  });

  it("reintenta errores 5xx con backoff exponencial", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new GroqProviderError("boom", { kind: "server", status: 500 }))
      .mockRejectedValueOnce(new GroqProviderError("boom", { kind: "server", status: 503 }))
      .mockResolvedValue("ok");

    const result = await withRetries(fn, { maxRetries: 3, sleep: immediateSleep });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("reintenta timeouts", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new GroqProviderError("timeout", { kind: "timeout" }))
      .mockResolvedValue("ok");

    await expect(withRetries(fn, { maxRetries: 1, sleep: immediateSleep })).resolves.toBe("ok");
  });

  it("no reintenta errores fatales (401)", async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(new GroqProviderError("unauthorized", { kind: "auth", status: 401 }));

    await expect(withRetries(fn, { maxRetries: 3, sleep: immediateSleep })).rejects.toThrow(
      "unauthorized",
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("lanza el error al agotar los reintentos", async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(new GroqProviderError("rate limited", { kind: "rate_limited", status: 429 }));

    await expect(withRetries(fn, { maxRetries: 2, sleep: immediateSleep })).rejects.toThrow(
      "rate limited",
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
