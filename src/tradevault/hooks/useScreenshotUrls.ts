import { useEffect, useState } from 'react';
import { getScreenshotUrls } from '../store';

// Module-level cache: signed URLs live 1h, a session rarely needs longer.
const urlCache = new Map<string, string>();

/**
 * Resolves screenshot entries (storage paths or legacy data: URLs) to
 * displayable URLs. Batched (one signed-URL call for all missing paths)
 * and cached across components.
 */
export function useScreenshotUrls(paths: string[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const p of paths) {
      const hit = urlCache.get(p);
      if (hit) initial[p] = hit;
    }
    return initial;
  });

  const key = paths.join('|');
  useEffect(() => {
    let cancelled = false;
    const missing = paths.filter((p) => !urlCache.has(p));
    if (missing.length === 0) {
      // Sync state with cache in case another component resolved these.
      setUrls((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const p of paths) {
          const hit = urlCache.get(p);
          if (hit && next[p] !== hit) { next[p] = hit; changed = true; }
        }
        return changed ? next : prev;
      });
      return;
    }
    getScreenshotUrls(missing)
      .then((resolved) => {
        if (cancelled) return;
        for (const [p, u] of Object.entries(resolved)) urlCache.set(p, u);
        setUrls((prev) => ({ ...prev, ...resolved }));
      })
      .catch(() => { /* transient network failure — placeholders stay */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls;
}

/** Imperatively seed the cache (e.g. right after an upload resolved its URL). */
export function seedScreenshotUrl(path: string, url: string) {
  urlCache.set(path, url);
}
