/**
 * CE QU'UNE SÉRIE DOIT PROUVER AVANT D'ÊTRE GARDÉE — pur, testé.
 *
 *   • assez d'histoire (trois ans) ;
 *   • des mois qui se suivent sans trou ;
 *   • aucun mouvement mensuel aberrant (une erreur de cotation, un split mal
 *     ajusté) — le seuil est plus large pour la crypto ;
 *   • et, quand une seconde source répond, des clôtures qui CONCORDENT avec
 *     elle sur les deux dernières années : c'est le « vérifié ».
 */
import type { AssetCategory, MonthlyClose } from "./types";

export const MIN_MONTHS = 36;
const MAX_MOVE = { indices: 0.45, forex: 0.25, commodities: 0.8, crypto: 3 } as const;
/** Écart médian toléré entre deux sources (futures continus vs comptant). */
export const AGREEMENT_TOLERANCE = 0.03;

const nextMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
};

export type Invalid = "too_short" | "gap" | "outlier";

/**
 * La plus longue période RÉCENTE sans mois manquant. Les contrats à terme
 * continus de Yahoo ont des trous au début des années 2000 : on garde ce qui
 * suit le dernier trou plutôt que de jeter vingt ans de série.
 */
export function contiguousTail(series: readonly MonthlyClose[]): MonthlyClose[] {
  let start = 0;
  for (let i = 1; i < series.length; i++) {
    if (series[i].month !== nextMonth(series[i - 1].month)) start = i;
  }
  return series.slice(start);
}

export function validateSeries(
  series: readonly MonthlyClose[],
  category: AssetCategory,
): Invalid | null {
  if (series.length < MIN_MONTHS) return "too_short";
  for (let i = 1; i < series.length; i++) {
    if (series[i].month !== nextMonth(series[i - 1].month)) return "gap";
    const move = Math.abs(series[i].close / series[i - 1].close - 1);
    if (move > MAX_MOVE[category]) return "outlier";
  }
  return null;
}

/** Les deux séries concordent-elles sur leurs 24 derniers mois communs ? */
export function seriesAgree(a: readonly MonthlyClose[], b: readonly MonthlyClose[]): boolean {
  const other = new Map(b.map((x) => [x.month, x.close]));
  const diffs = a
    .filter((x) => other.has(x.month))
    .slice(-24)
    .map((x) => Math.abs(x.close / (other.get(x.month) as number) - 1))
    .sort((p, q) => p - q);
  if (diffs.length < 12) return false;
  return diffs[Math.floor(diffs.length / 2)] <= AGREEMENT_TOLERANCE;
}
