/**
 * In-memory IP rate limiter for raw HTTP endpoints.
 *
 * Prevents rapid-fire abuse on billing, crypto, and email endpoints.
 * Per-VM on Vercel — not a cross-instance barrier, but catches the most
 * common attack pattern (bursts of sequential requests).
 *
 * Upgrade path: replace with a DB-backed counter (e.g. Supabase table
 * with IP + window_key) when cross-instance coordination is required.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 30; // per IP per minute

export function checkRateLimit(request: Request): { allowed: boolean; retryAfter?: number } {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  bucket.count += 1;
  if (bucket.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  return { allowed: true };
}

/** Prevent unbounded memory growth — purge stale buckets periodically. */
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(ip);
  }
}, 120_000);
