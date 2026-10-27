import type { Trade } from "./trade";

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

/** Ordre de matérialisation du P&L, qui peut différer de l'ordre d'entrée.
 * Une sortie le lendemain ou une heure invalide est non vérifiable sans date
 * de clôture complète ; on conserve alors un tri de secours non probant. */
function verifiedClock(time: string | undefined | null): string | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec((time ?? "").trim());
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

function validSameDayExit(t: Trade): string | null {
  const entry = verifiedClock(t.entryTime);
  const exit = verifiedClock(t.exitTime);
  if (!entry || !exit || exit < entry) return null;
  return exit;
}

/** Croissant : du P&L réalisé le plus ancien au plus récent, si identifiable. */
export function compareRealizedChronological(a: Trade, b: Trade): number {
  const dates = a.date.localeCompare(b.date);
  if (dates !== 0) return dates;
  const first = validSameDayExit(a) ?? verifiedClock(a.entryTime) ?? "";
  const second = validSameDayExit(b) ?? verifiedClock(b.entryTime) ?? "";
  return first.localeCompare(second) || compareChronological(a, b);
}

/** Sans une clôture non ambiguë, aucun drawdown intrajournalier n'est certifié. */
export function hasVerifiedRealizedOrder(trades: readonly Trade[]): boolean {
  const seen = new Set<string>();
  for (const trade of trades) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trade.date)) return false;
    const exit = validSameDayExit(trade);
    if (!exit) return false;
    const key = trade.date + "T" + exit;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return trades.length > 0;
}
