/**
 * Quels mois méritent un rapport — module PUR.
 *
 * POURQUOI CE MODULE. La logique « quels mois ont des trades mais pas encore
 * de rapport » existait en double : une fois en ligne dans le backfill après
 * import CSV (`App.tsx`), et nulle part ailleurs — si bien que la page
 * Rapports ne savait générer QUE le mois précédent. Un trader qui saisit six
 * mois d'historique à la main n'avait donc jamais ses six rapports.
 *
 * Une seule définition ici, réutilisée par l'import CSV ET par la page : c'est
 * la règle « une seule source de vérité » appliquée à une question produit
 * simple mais qui doit répondre pareil partout.
 *
 * RÈGLE MÉTIER : un rapport mensuel n'a de sens que sur un mois TERMINÉ. Le
 * mois en cours est donc exclu — sinon l'utilisateur figerait une photo
 * partielle et croirait, un mois plus tard, que c'est le bilan complet.
 */

const MONTH_RE = /^\d{4}-\d{2}$/;

/** Mois courant au format `YYYY-MM`, en UTC (même base que les dates de trade). */
export function currentMonth(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}

/**
 * Les mois TERMINÉS qui contiennent au moins un trade, du plus récent au plus
 * ancien — l'ordre d'affichage attendu dans une liste de rapports.
 */
export function closedTradeMonths(tradeDates: readonly string[], now: Date = new Date()): string[] {
  const nowMonth = currentMonth(now);
  const months = new Set<string>();
  for (const d of tradeDates) {
    const m = typeof d === "string" ? d.slice(0, 7) : "";
    if (MONTH_RE.test(m) && m < nowMonth) months.add(m);
  }
  return [...months].sort().reverse();
}

/**
 * Les mois générables : ils ont des trades, ils sont terminés, et aucun
 * rapport n'existe encore. Du plus récent au plus ancien — on génère d'abord
 * ce qui intéresse le plus le trader.
 */
export function missingReportMonths(
  tradeDates: readonly string[],
  existingMonths: readonly string[],
  now: Date = new Date(),
): string[] {
  const have = new Set(existingMonths);
  return closedTradeMonths(tradeDates, now).filter((m) => !have.has(m));
}
