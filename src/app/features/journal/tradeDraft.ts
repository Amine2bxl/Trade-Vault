/** Screenshot references are small Storage paths, never local base64 copies.
 * Validate old/corrupt drafts before passing the array to the image viewer. */
export function restoreDraftScreenshots(saved: unknown, fallback: string[]): string[] {
  if (!Array.isArray(saved)) return fallback;
  return saved
    .filter((item): item is string => typeof item === "string" && item.length > 0)
    .slice(0, 3);
}

/** Only newly uploaded draft files are owned by the draft. Existing trade
 * screenshots must stay in Storage until the trade itself is successfully edited. */
export function draftOnlyScreenshots(current: string[], original: string[] = []): string[] {
  const existing = new Set(original);
  return current.filter((path) => !existing.has(path) && !path.startsWith("data:"));
}
