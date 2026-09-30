/**
 * Préférences de Jarvis (Phase UX) — langue de réponse.
 *
 * `auto` → suit la langue de l'app · `fr`/`en` → force la langue des réponses.
 * Stockage localStorage : une préférence de langue qui se réinitialise à
 * chaque onglet n'est pas une préférence. Additif : ne touche aucune
 * structure existante.
 */

export type JarvisResponseLang = "auto" | "fr" | "en";

const KEY = "tv:jarvis:lang";

export function readResponseLang(): JarvisResponseLang {
  if (typeof localStorage === "undefined") return "auto";
  try {
    const v = localStorage.getItem(KEY);
    return v === "fr" || v === "en" ? v : "auto";
  } catch {
    return "auto";
  }
}

export function writeResponseLang(lang: JarvisResponseLang): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (lang === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, lang);
  } catch {
    /* best-effort */
  }
}

/** Langue effective du copilote : préférence si fixée, sinon langue de l'app. */
export function effectiveCopyLang(appLang: string): "fr" | "en" {
  const pref = readResponseLang();
  if (pref === "fr" || pref === "en") return pref;
  return appLang === "fr" ? "fr" : "en";
}

/* ── Lecture à voix haute automatique ─────────────────────────────────────
   Éteinte par défaut : une voix qui part toute seule surprend. Allumée, chaque
   réponse est lue dès qu'elle a fini de s'écrire. */

const SPEAK_KEY = "tv:jarvis:autoSpeak";

export function readAutoSpeak(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(SPEAK_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeAutoSpeak(on: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (on) localStorage.setItem(SPEAK_KEY, "1");
    else localStorage.removeItem(SPEAK_KEY);
  } catch {
    /* best-effort */
  }
}

/** Diffusé quand le profil de Jarvis est enregistré depuis les Réglages : la
 *  fenêtre et la page le relisent, pour que la conversation suive. */
export const JARVIS_PROFILE_EVENT = "tv:jarvis-profile";
