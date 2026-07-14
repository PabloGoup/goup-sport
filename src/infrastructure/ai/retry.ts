export type TransientError = {
  isTransient?: boolean;
  retryAfterMs?: number;
};

export type RetryOptions = {
  maxRetries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Reintenta `fn` con espera exponencial + jitter solo para errores transitorios
 * (429/5xx/timeout). Respeta `retryAfterMs` del error cuando esta presente.
 */
export async function withRetries<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 30000;
  const sleep = options.sleep ?? defaultSleep;

  let attempt = 0;

  for (;;) {
    try {
      return await fn();
    } catch (error) {
      const transient = Boolean((error as TransientError)?.isTransient);
      if (!transient || attempt >= options.maxRetries) throw error;

      attempt += 1;
      const retryAfterMs = (error as TransientError).retryAfterMs;
      const exponential = baseDelayMs * 2 ** (attempt - 1);
      const jitter = exponential * 0.2 * Math.random();
      const delayMs = Math.min(maxDelayMs, retryAfterMs ?? Math.round(exponential + jitter));

      options.onRetry?.(attempt, delayMs, error);
      await sleep(delayMs);
    }
  }
}
