/**
 * Réglages de la voix du Mode Terminal — durables et suivis d'un appareil à
 * l'autre (`user_preferences`, clé `terminal`). Le son (bips) garde son propre
 * interrupteur, celui de l'onboarding : un seul « son du produit ».
 */

import { loadUserPref, saveUserPref } from "@/app/utils/userPrefs";

export interface TerminalPrefs {
  /** Jarvis parle. Coupé : tout reste lisible en sous-titres. */
  voice: boolean;
  /** `auto` = la langue de l'application. */
  lang: "auto" | "fr" | "en";
  /** Vitesse relative, 0,75 à 1,25. */
  rate: number;
  /** Volume, 0 à 1. */
  volume: number;
}

export const DEFAULT_TERMINAL_PREFS: TerminalPrefs = {
  voice: true,
  lang: "auto",
  rate: 1,
  volume: 0.9,
};

const KEY = "terminal";

const num = (v: unknown, min: number, max: number, def: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;

/** Relit des réglages stockés ; toute valeur douteuse retombe sur le défaut. */
export function normalizeTerminalPrefs(raw: unknown): TerminalPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_TERMINAL_PREFS;
  return {
    voice: typeof r.voice === "boolean" ? r.voice : d.voice,
    lang: r.lang === "fr" || r.lang === "en" || r.lang === "auto" ? r.lang : d.lang,
    rate: num(r.rate, 0.75, 1.25, d.rate),
    volume: num(r.volume, 0, 1, d.volume),
  };
}

export async function loadTerminalPrefs(userId: string): Promise<TerminalPrefs> {
  return normalizeTerminalPrefs(await loadUserPref(userId, KEY));
}

export function saveTerminalPrefs(userId: string, prefs: TerminalPrefs): void {
  saveUserPref(userId, KEY, prefs);
}
