// ============================================================
//  Saisonnalité des actifs — la FORME commune.
// ------------------------------------------------------------
//  Pour chaque actif : le rendement MOYEN de chaque mois du
//  calendrier et la part d'années où il a fini positif. Les
//  chiffres viennent de clôtures de fin de mois synchronisées
//  chaque jour (`backend/market-history.server.ts`, chaîne Yahoo
//  → Stooq → FRED) et calculées par `domain/marketSeasonality`.
//  Plus aucun jeu de chiffres « documentés » écrit à la main : un
//  chiffre de marché affiché a une source et une date.
// ============================================================

export type AssetCategory = "indices" | "forex" | "commodities" | "crypto" | "stocks";

export interface SeasonalAsset {
  symbol: string;
  name: string;
  category: AssetCategory;
  /** Avg % return, index 0 = January … 11 = December. */
  monthlyAvg: number[];
  /** Share of years that month was positive (0–100), same indexing. */
  monthlyWin: number[];
  /** Years the averages are drawn from (smallest monthly sample). */
  years: number;
  /** Provenance : the provider that served the series… */
  source?: "yahoo" | "stooq" | "fred";
  /** …and the second one that agreed with it, when any. */
  witness?: "yahoo" | "stooq" | "fred" | null;
}

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  indices: "Indices",
  forex: "Forex",
  commodities: "Commodities",
  crypto: "Crypto",
  stocks: "Stocks",
};

export const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Values below are curated approximations of documented seasonal patterns
// (e.g. equity "Sell in May", Santa rally, gold's Q1/late-summer strength,
// Bitcoin's historically strong Q4). Kept intentionally modest and rounded.

export interface SeasonalStats {
  bestMonth: { month: number; avg: number };
  worstMonth: { month: number; avg: number };
  currentMonthAvg: number;
  currentMonthWin: number;
  annualAvg: number;
}

export function computeSeasonalStats(
  asset: SeasonalAsset,
  currentMonth = new Date().getMonth(),
): SeasonalStats {
  let best = 0,
    worst = 0;
  asset.monthlyAvg.forEach((v, i) => {
    if (v > asset.monthlyAvg[best]) best = i;
    if (v < asset.monthlyAvg[worst]) worst = i;
  });
  const annualAvg = asset.monthlyAvg.reduce((a, b) => a + b, 0);
  return {
    bestMonth: { month: best, avg: asset.monthlyAvg[best] },
    worstMonth: { month: worst, avg: asset.monthlyAvg[worst] },
    currentMonthAvg: asset.monthlyAvg[currentMonth],
    currentMonthWin: asset.monthlyWin[currentMonth],
    annualAvg,
  };
}
