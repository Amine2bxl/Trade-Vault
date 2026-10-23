import { supabase } from "@/integrations/supabase/client";

// ── Screenshots (Supabase Storage) ──
export const SCREENSHOTS_BUCKET = "trade-screenshots";

// Storage paths (non data: URLs) referenced by rows must be removed together
// with the rows, otherwise files pile up as unreachable orphans in the bucket.
export function storagePathsOf(screenshots: string[] | null | undefined): string[] {
  return (screenshots ?? []).filter((s) => !s.startsWith("data:"));
}

/**
 * Les fichiers à supprimer APRÈS l'enregistrement réussi d'un trade modifié :
 * ceux qu'il référençait avant et plus maintenant. Les supprimer avant (comme
 * le faisait le formulaire) laissait, si l'enregistrement échouait, un trade
 * restauré qui pointait vers des fichiers effacés — une capture à jamais
 * cassée.
 */
export function orphanedScreenshots(before: string[] | undefined, after: string[]): string[] {
  const kept = new Set(after);
  return storagePathsOf(before).filter((p) => !kept.has(p));
}

export async function removeScreenshotFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  // Best-effort: a failed storage cleanup should never block the row delete.
  try {
    await supabase.storage.from(SCREENSHOTS_BUCKET).remove(paths);
  } catch {
    /* ignore */
  }
}

export async function uploadScreenshot(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "png";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const { error } = await supabase.storage.from(SCREENSHOTS_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function uploadMissedScreenshot(userId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${userId}/missed/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const { error } = await supabase.storage.from(SCREENSHOTS_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

export async function getScreenshotUrl(path: string): Promise<string> {
  // Legacy trades stored inline base64 data URLs — display them as-is.
  if (path.startsWith("data:")) return path;
  const { data, error } = await supabase.storage
    .from(SCREENSHOTS_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days — prevents screenshots from disappearing mid-session
  if (error) throw error;
  return data.signedUrl;
}

/** Batch variant: one network call for N paths instead of N calls.
 *  `ttlSeconds` : validité des liens — le cache de `screenshotUrls.ts` s'y
 *  aligne (il les re-signe avant l'expiration). */
export async function getScreenshotUrls(
  paths: string[],
  ttlSeconds = 60 * 60 * 24,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const storagePaths: string[] = [];
  for (const p of paths) {
    if (p.startsWith("data:")) out[p] = p;
    else storagePaths.push(p);
  }
  if (storagePaths.length > 0) {
    const { data, error } = await supabase.storage
      .from(SCREENSHOTS_BUCKET)
      .createSignedUrls(storagePaths, ttlSeconds);
    if (error) throw error;
    for (const item of data ?? []) {
      if (item.signedUrl && item.path) out[item.path] = item.signedUrl;
    }
  }
  return out;
}

export async function deleteScreenshot(path: string): Promise<void> {
  const { error } = await supabase.storage.from(SCREENSHOTS_BUCKET).remove([path]);
  if (error) throw error;
}
