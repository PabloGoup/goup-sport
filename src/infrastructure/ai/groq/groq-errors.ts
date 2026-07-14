export type GroqErrorKind =
  | "bad_request"
  | "auth"
  | "not_found"
  | "payload_too_large"
  | "unprocessable"
  | "rate_limited"
  | "server"
  | "timeout"
  | "invalid_response"
  | "unknown";

export class GroqProviderError extends Error {
  readonly kind: GroqErrorKind;
  readonly status?: number;
  readonly retryAfterMs?: number;

  constructor(
    message: string,
    options: { kind: GroqErrorKind; status?: number; retryAfterMs?: number; cause?: unknown },
  ) {
    super(message, { cause: options.cause });
    this.name = "GroqProviderError";
    this.kind = options.kind;
    this.status = options.status;
    this.retryAfterMs = options.retryAfterMs;
  }

  /** 429 y 5xx/timeout se reintentan; los errores de cliente son fatales. */
  get isTransient(): boolean {
    return this.kind === "rate_limited" || this.kind === "server" || this.kind === "timeout";
  }

  /** 401/403 indican configuracion invalida: aborta el job completo. */
  get isAuthFailure(): boolean {
    return this.kind === "auth";
  }
}

export function classifyStatus(status: number): GroqErrorKind {
  if (status === 400) return "bad_request";
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "not_found";
  if (status === 413) return "payload_too_large";
  if (status === 422) return "unprocessable";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server";
  return "unknown";
}

export function parseRetryAfterMs(retryAfter: string | null | undefined): number | undefined {
  if (!retryAfter) return undefined;

  const seconds = Number(retryAfter);
  if (!Number.isNaN(seconds) && seconds >= 0) return Math.round(seconds * 1000);

  const date = Date.parse(retryAfter);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());

  return undefined;
}
