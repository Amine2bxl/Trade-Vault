import type { NotificationCategory } from "./types";

/**
 * CE QUE LE TRADER VEUT ENTENDRE — module PUR.
 *
 * Les interrupteurs de catégories existaient dans les Réglages, mais leur
 * valeur dormait dans `localStorage` sans qu'aucun moteur ne la lise : couper
 * « Calendrier économique » ne coupait rien. Ils vivent maintenant dans les
 * préférences du compte (`user_preferences`, clé `NOTIF_PREFS_KEY`) et le
 * moteur les applique via son adaptateur `allow`.
 */

export type NotifPrefKey = "economic" | "discipline" | "risk" | "goals" | "jarvis";
export type NotifPrefs = Record<NotifPrefKey, boolean>;

/** L'ordre d'affichage : l'alerte datée d'abord, puis le journal. */
export const NOTIF_PREF_KEYS: NotifPrefKey[] = [
  "economic",
  "discipline",
  "risk",
  "goals",
  "jarvis",
];

/** Clé dans `user_preferences.prefs`. */
export const NOTIF_PREFS_KEY = "notifications";
/** Diffusé par les Réglages pour que l'application applique aussitôt. */
export const NOTIF_PREFS_EVENT = "tv:notif-prefs";

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  economic: true,
  discipline: true,
  risk: true,
  goals: true,
  jarvis: true,
};

/** Lit une valeur stockée, quelle que soit sa forme (ancienne clé `ai` incluse). */
export function normalizeNotifPrefs(raw: unknown): NotifPrefs {
  const out = { ...DEFAULT_NOTIF_PREFS };
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  for (const k of NOTIF_PREF_KEYS) if (typeof r[k] === "boolean") out[k] = r[k] as boolean;
  if (typeof r.jarvis !== "boolean" && typeof r.ai === "boolean") out.jarvis = r.ai;
  return out;
}

/** Une catégorie de la boîte → l'interrupteur qui la gouverne. */
export function categoryAllowed(prefs: NotifPrefs, category: NotificationCategory): boolean {
  switch (category) {
    case "economic":
    case "discipline":
    case "risk":
    case "goals":
    case "jarvis":
      return prefs[category];
    // L'inactivité est une observation de Jarvis.
    case "activity":
      return prefs.jarvis;
    // Le système (sécurité, compte) ne se coupe pas.
    default:
      return true;
  }
}
