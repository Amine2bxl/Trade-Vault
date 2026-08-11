import { useEffect, useRef, useState } from "react";
import { getScreenshotUrls } from "../store";

const CACHE_TTL = 23 * 60 * 60 * 1000; // 23h — refresh before signed URL expires (7-day TTL)
const urlCache = new Map<string, { url: string; at: number }>();

/**
 * Resolves screenshot entries (storage paths or legacy data: URLs) to
 * displayable URLs. Batched (one signed-URL call for all missing paths),
 * cached across components, and auto-refreshes before expiry.
 *
 * If a signed URL fails to load (onError), the hook provides a `retry`
 * callback that clears the cache and re-fetches.
 */
export function useScreenshotUrls(paths: string[]): Record<string, string> {
  const [, forceRender] = useState(0);
  const urlsRef = useRef<Record<string, string>>({});

  const key = paths.join("|");
  useEffect(() => {
    let cancelled = false;
    const now = Date.now();
    const expired = paths.filter((p) => {
      const entry = urlCache.get(p);
      return !entry || now - entry.at > CACHE_TTL;
    });

    if (expired.length === 0) {
      const snapshot: Record<string, string> = {};
      for (const p of paths) snapshot[p] = urlCache.get(p)?.url ?? "";
      urlsRef.current = snapshot;
      return;
    }

    getScreenshotUrls(expired)
      .then((resolved) => {
        if (cancelled) return;
        for (const [p, u] of Object.entries(resolved)) {
          urlCache.set(p, { url: u, at: Date.now() });
        }
        const snapshot: Record<string, string> = {};
        for (const p of paths) {
          const entry = urlCache.get(p);
          snapshot[p] = entry ? entry.url : p.startsWith("data:") ? p : "";
        }
        urlsRef.current = snapshot;
        forceRender((n) => n + 1);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Build return value from cache for current paths
  const snapshot: Record<string, string> = {};
  for (const p of paths) {
    const entry = urlCache.get(p);
    snapshot[p] = entry ? entry.url : p.startsWith("data:") ? p : (urlsRef.current[p] ?? "");
  }

  return snapshot;
}

/** Clear a path from cache so it will be re-fetched on next render. */
export function invalidateScreenshot(path: string) {
  urlCache.delete(path);
}

/** Imperatively seed the cache (e.g. right after an upload resolved its URL). */
export function seedScreenshotUrl(path: string, url: string) {
  urlCache.set(path, { url, at: Date.now() });
}
