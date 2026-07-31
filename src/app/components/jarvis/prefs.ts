/**
 * Préférences de Jarvis (Phase UX) — langue de réponse.
 *
 * `auto` → suit la langue de l'app · `fr`/`en` → force la langue des réponses.
 * Stockage sessionStorage (léger, per-onglet). Additif : ne touche aucune
 * structure existante.
 */

export type JarvisResponseLang = "auto" | "fr" | "en";

const KEY = "tv:jarvis:lang";

export function readResponseLang(): JarvisResponseLang {
  if (typeof sessionStorage === "undefined") return "auto";
  try {
    const v = sessionStorage.getItem(KEY);
    return v === "fr" || v === "en" ? v : "auto";
  } catch {
    return "auto";
  }
}

export function writeResponseLang(lang: JarvisResponseLang): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (lang === "auto") sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, lang);
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
