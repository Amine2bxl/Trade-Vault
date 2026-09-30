import type { Trade } from "../types";

/**
 * L'ORDRE CHRONOLOGIQUE D'UN TRADE — la date, puis l'HEURE D'ENTRÉE.
 *
 * Le journal ne triait que sur la date : les trades d'une même journée
 * gardaient l'ordre de chargement, et « 09:47 » pouvait s'afficher au-dessus
 * de « 11:42 ». La clé secondaire est l'heure d'ENTRÉE (le moment où la
 * décision a été prise), jamais celle de sortie.
 *
 * Les heures sont stockées en « HH:MM » ; une heure saisie sans zéro (« 9:05 »)
 * est normalisée pour que la comparaison de chaînes reste chronologique. Une
 * heure absente passe AVANT toutes les autres dans l'ordre croissant — donc en
 * bas de la journée dans le journal, qui lit du plus récent au plus ancien.
 */

function hhmm(time: string | undefined | null): string {
  const m = /^(\d{1,2}):(\d{2})/.exec((time ?? "").trim());
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

/** Croissant : le plus ancien d'abord (date, puis heure d'entrée). */
export function compareChronological(a: Trade, b: Trade): number {
  return a.date.localeCompare(b.date) || hhmm(a.entryTime).localeCompare(hhmm(b.entryTime));
}

/** Décroissant : le plus récent d'abord — l'ordre du journal. */
export function newestFirst(a: Trade, b: Trade): number {
  return -compareChronological(a, b);
}
