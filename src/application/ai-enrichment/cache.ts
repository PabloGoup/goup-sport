/**
 * Interfaz de cache para analisis. La implementacion por defecto es
 * in-memory; permite incorporar Redis u otro backend sin tocar consumidores.
 */
export interface AnalysisCache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T, ttlMs?: number): void;
  invalidate(key: string): void;
}

type CacheEntry<T> = { value: T; expiresAt: number };

export class InMemoryAnalysisCache<T> implements AnalysisCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(private readonly defaultTtlMs = 5 * 60 * 1000) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    this.entries.set(key, { value, expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs) });
  }

  invalidate(key: string): void {
    this.entries.delete(key);
  }
}
