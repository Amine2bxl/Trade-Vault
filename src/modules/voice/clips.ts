/**
 * Static voice clips — the runtime half of the cloned voice.
 *
 * Every fixed Jarvis line is pre-synthesized into `public/voices/` (see
 * `scripts/voices/generate.ts`) with the cloned voice. This module maps an
 * exact spoken line back to its audio file. Exact match only: a line that was
 * never rendered falls back to the browser voice — the trader hears a voice,
 * never an error.
 *
 * The manifest is fetched with `no-store` and self-heals: clip filenames are
 * immutable (hashed), so when the browser/CDN holds a stale manifest from an
 * earlier deploy, a failed clip triggers one refresh + retry instead of
 * silently falling back to the browser voice.
 */

const MANIFEST_URL = "/voices/manifest.json";

let manifest: Map<string, string> | null = null;
let loading: Promise<Map<string, string>> | null = null;
let autoHealed = false;

async function fetchManifest(): Promise<Map<string, string>> {
  const res = await fetch(MANIFEST_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`manifest ${res.status}`);
  const data = (await res.json()) as Record<string, string>;
  return new Map(Object.entries(data));
}

/**
 * Load the text→file map once per session. Resolves to an empty map on any
 * failure so callers always get a usable (fallback) result.
 */
export function loadVoiceClips(): Promise<Map<string, string>> {
  if (manifest) return Promise.resolve(manifest);
  if (!loading) {
    loading = fetchManifest()
      .then((m) => {
        manifest = m;
        return manifest;
      })
      .catch(() => {
        manifest = new Map();
        return manifest;
      });
  }
  return loading;
}

/**
 * Re-fetch the manifest after a clip failed to load. Used once per session to
 * heal a stale browser/CDN cache; the new mapping points at the current
 * immutable clip files.
 */
export async function refreshVoiceClips(): Promise<void> {
  if (autoHealed) return;
  autoHealed = true;
  manifest = null;
  loading = null;
  await loadVoiceClips();
}

/**
 * The audio URL for a spoken line, or null when no clip was pre-rendered for
 * it. Only meaningful after `loadVoiceClips()` resolved.
 */
export function clipFor(text: string): string | null {
  if (!manifest) return null;
  const file = manifest.get(text);
  return file ? `/voices/${file}` : null;
}
