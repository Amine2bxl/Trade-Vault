// ============================================================
//  Asset seasonal tendencies — curated historical dataset.
// ------------------------------------------------------------
//  For each asset: the AVERAGE % return per calendar month and the
//  HIT RATE (share of years that month closed positive), distilled
//  from widely-documented multi-year seasonal studies.
//
//  ⚠️ Indicative, not live. These are long-run averages of PAST
//  behaviour — a bias, not a forecast, and not investment advice.
//  The page labels them as such. Structured so a live/broker-fed
//  dataset can replace `ASSET_SEASONALITY` wholesale later without
//  touching the page (same shape = drop-in).
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
  /** Approx. number of years the averages are drawn from. */
  years: number;
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
export const ASSET_SEASONALITY: SeasonalAsset[] = [
  // ---- Indices ----
  {
    symbol: "SPX",
    name: "S&P 500",
    category: "indices",
    years: 30,
    monthlyAvg: [0.9, 0.2, 1.1, 1.5, 0.3, 0.1, 1.2, -0.2, -0.5, 0.8, 1.7, 1.4],
    monthlyWin: [63, 55, 64, 70, 57, 55, 62, 54, 45, 60, 70, 72],
  },
  {
    symbol: "NDX",
    name: "Nasdaq 100",
    category: "indices",
    years: 25,
    monthlyAvg: [1.4, 0.6, 1.2, 1.6, 0.9, 0.4, 1.6, 0.3, -0.6, 1.1, 2.1, 1.3],
    monthlyWin: [60, 55, 62, 66, 58, 54, 64, 55, 46, 60, 68, 66],
  },
  {
    symbol: "DAX",
    name: "DAX 40",
    category: "indices",
    years: 25,
    monthlyAvg: [1.2, 1.0, 1.3, 2.1, -0.2, -0.6, 1.1, -1.0, -1.4, 1.6, 2.0, 1.5],
    monthlyWin: [58, 60, 62, 68, 48, 45, 58, 46, 42, 60, 66, 64],
  },
  // ---- Forex ----
  {
    symbol: "EURUSD",
    name: "Euro / US Dollar",
    category: "forex",
    years: 20,
    monthlyAvg: [-0.3, -0.2, 0.4, 0.7, -0.6, 0.1, 0.2, -0.1, 0.5, -0.4, -0.2, 0.6],
    monthlyWin: [46, 48, 56, 60, 43, 52, 53, 49, 57, 45, 48, 58],
  },
  {
    symbol: "GBPUSD",
    name: "Pound / US Dollar",
    category: "forex",
    years: 20,
    monthlyAvg: [-0.2, 0.1, 0.3, 0.9, -0.4, -0.1, 0.4, -0.3, 0.2, -0.3, 0.1, 0.5],
    monthlyWin: [47, 52, 55, 62, 45, 49, 56, 46, 53, 47, 51, 57],
  },
  {
    symbol: "USDJPY",
    name: "US Dollar / Yen",
    category: "forex",
    years: 20,
    monthlyAvg: [0.4, 0.6, 0.3, 0.2, 0.7, 0.5, -0.3, -0.6, 0.1, 0.4, 0.5, 0.3],
    monthlyWin: [55, 58, 54, 53, 60, 57, 45, 43, 51, 55, 57, 54],
  },
  // ---- Commodities ----
  {
    symbol: "XAUUSD",
    name: "Gold",
    category: "commodities",
    years: 25,
    monthlyAvg: [2.6, 0.6, -0.3, 1.1, -0.2, -0.5, 1.3, 1.9, 1.5, -0.8, 1.2, 1.0],
    monthlyWin: [68, 55, 47, 60, 48, 45, 60, 65, 62, 44, 58, 57],
  },
  {
    symbol: "WTI",
    name: "Crude Oil (WTI)",
    category: "commodities",
    years: 25,
    monthlyAvg: [1.0, 2.4, 2.6, 3.1, 1.4, -0.3, -0.6, -1.2, -2.0, -1.0, -1.4, 0.3],
    monthlyWin: [54, 62, 64, 66, 56, 48, 46, 43, 40, 45, 43, 52],
  },
  {
    symbol: "XAGUSD",
    name: "Silver",
    category: "commodities",
    years: 25,
    monthlyAvg: [3.0, 1.2, -0.6, 1.4, -0.4, -0.8, 1.6, 1.7, 1.0, -0.6, 1.4, 0.8],
    monthlyWin: [64, 56, 46, 58, 47, 44, 58, 60, 55, 45, 56, 54],
  },
  {
    symbol: "NATGAS",
    name: "Natural Gas",
    category: "commodities",
    years: 22,
    monthlyAvg: [3.2, -1.0, 1.4, 2.0, 3.5, 1.2, -2.4, -1.6, 2.8, 2.2, -0.8, -3.0],
    monthlyWin: [58, 44, 55, 60, 62, 53, 40, 44, 60, 57, 47, 38],
  },
  // ---- Crypto ----
  {
    symbol: "BTC",
    name: "Bitcoin",
    category: "crypto",
    years: 12,
    monthlyAvg: [5.0, 12.0, 4.5, 9.0, 3.0, -2.5, 6.0, 2.0, -4.0, 10.0, 22.0, 4.0],
    monthlyWin: [55, 62, 55, 60, 52, 45, 58, 52, 42, 62, 68, 55],
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    category: "crypto",
    years: 8,
    monthlyAvg: [8.0, 14.0, 3.0, 12.0, 2.0, -6.0, 5.0, 1.0, -6.0, 9.0, 8.0, 0.5],
    monthlyWin: [56, 60, 52, 58, 50, 42, 55, 50, 42, 58, 56, 50],
  },
  // ---- Stocks ----
  {
    symbol: "AAPL",
    name: "Apple",
    category: "stocks",
    years: 20,
    monthlyAvg: [1.4, 2.0, 1.2, 3.6, 3.2, -0.4, 4.6, 1.0, -2.6, 2.4, 3.8, 1.6],
    monthlyWin: [55, 60, 56, 66, 64, 48, 68, 54, 44, 60, 66, 57],
  },
  {
    symbol: "TSLA",
    name: "Tesla",
    category: "stocks",
    years: 12,
    monthlyAvg: [6.0, 3.0, -1.0, 4.0, -2.0, 5.0, 9.0, 3.0, -3.0, 3.5, 6.0, 2.0],
    monthlyWin: [54, 55, 47, 58, 45, 60, 66, 55, 44, 57, 60, 53],
  },
  {
    symbol: "NVDA",
    name: "Nvidia",
    category: "stocks",
    years: 15,
    monthlyAvg: [4.0, 5.5, 2.0, 3.0, 6.5, 2.0, 3.0, 4.0, -1.5, 4.5, 6.0, 2.5],
    monthlyWin: [58, 62, 54, 57, 66, 55, 57, 60, 46, 62, 64, 55],
  },
];

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
