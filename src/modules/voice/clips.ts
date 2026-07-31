/**
 * Static voice clips — the runtime half of the cloned voice.
 *
 * Every fixed Jarvis line is pre-synthesized into `public/voices/` (see
 * `scripts/voices/generate.ts`) with the cloned voice. This module maps an
 * exact spoken line back to its audio file. Exact match only: a line that was
 * never rendered falls back to the browser voice — the trader hears a voice,
 * never an error.
 */

const MANIFEST_URL = "/voices/manifest.json";

let manifest: Map<string, string> | null = null;
let loading: Promise<Map<string, string>> | null = null;

/**
 * Load the text→file map once per session. Resolves to an empty map on any
 * failure so callers always get a usable (fallback) result.
 */
export function loadVoiceClips(): Promise<Map<string, string>> {
  if (manifest) return Promise.resolve(manifest);
  if (!loading) {
    loading = fetch(MANIFEST_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`manifest ${r.status}`);
        return r.json() as Promise<Record<string, string>>;
      })
      .then((data) => {
        manifest = new Map(Object.entries(data));
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
 * The audio URL for a spoken line, or null when no clip was pre-rendered for
 * it. Only meaningful after `loadVoiceClips()` resolved.
 */
export function clipFor(text: string): string | null {
  if (!manifest) return null;
  const file = manifest.get(text);
  return file ? `/voices/${file}` : null;
}
