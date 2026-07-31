/**
 * Métriques runtime IA — en mémoire (par instance serverless). Suffisant pour
 * le diagnostic et le taux de fallback ; la persistance multi-instance viendra
 * plus tard (points d'extension : coût estimé, agrégation).
 */

export interface ProviderMetric {
  count: number;
  failures: number;
  fallbacks: number;
  avgMs: number;
  maxMs: number;
  minMs: number;
  lastModel?: string;
}

export interface RuntimeSnapshot {
  requests: number;
  lastUsedProvider: string | null;
  lastFallbackReason: string | null;
  lastError: string | null;
  lastRequestAt: number | null;
  perProvider: Record<string, ProviderMetric>;
}

function emptyMetric(): ProviderMetric {
  return { count: 0, failures: 0, fallbacks: 0, avgMs: 0, maxMs: 0, minMs: 0 };
}

export class MetricsStore {
  private requests = 0;
  private lastUsedProvider: string | null = null;
  private lastFallbackReason: string | null = null;
  private lastError: string | null = null;
  private lastRequestAt: number | null = null;
  private perProvider = new Map<string, ProviderMetric>();

  record(provider: string, model: string, latencyMs: number, ok: boolean): void {
    this.requests += 1;
    this.lastUsedProvider = provider;
    this.lastRequestAt = Date.now();
    const m = this.perProvider.get(provider) ?? emptyMetric();
    m.count += 1;
    if (!ok) m.failures += 1;
    m.lastModel = model;
    m.maxMs = Math.max(m.maxMs, latencyMs);
    m.minMs = m.count === 1 ? latencyMs : Math.min(m.minMs, latencyMs);
    m.avgMs = (m.avgMs * (m.count - 1) + latencyMs) / m.count;
    this.perProvider.set(provider, m);
  }

  recordFallback(provider: string, reason: string): void {
    this.lastFallbackReason = reason;
    const m = this.perProvider.get(provider) ?? emptyMetric();
    m.fallbacks += 1;
    this.perProvider.set(provider, m);
  }

  recordError(type: string): void {
    this.lastError = type;
  }

  snapshot(): RuntimeSnapshot {
    const perProvider: Record<string, ProviderMetric> = {};
    for (const [id, m] of this.perProvider) {
      perProvider[id] = { ...m, avgMs: Math.round(m.avgMs * 10) / 10 };
    }
    return {
      requests: this.requests,
      lastUsedProvider: this.lastUsedProvider,
      lastFallbackReason: this.lastFallbackReason,
      lastError: this.lastError,
      lastRequestAt: this.lastRequestAt,
      perProvider,
    };
  }
}

/** Instance partagée du runtime. */
export const metrics = new MetricsStore();
