// ============================================================
//  Position sizing math — shared by the Lot Size Calculator page
//  and the quick calculator embedded in the Add Trade modal.
// ============================================================

/** Common futures contracts and their $ value per point. */
export const POINT_VALUES = [
  { label: "NQ", value: 20 },
  { label: "MNQ", value: 2 },
  { label: "ES", value: 50 },
  { label: "MES", value: 5 },
  { label: "YM", value: 5 },
  { label: "GC", value: 100 },
] as const;

export interface ContractsResult {
  contracts: number;
  effectiveRisk: number;
}

/** contracts = floor(risk / (stop distance × $ per point)); null when inputs incomplete. */
export function calcContracts(
  riskDollar: number,
  stopPoints: number,
  pointValue: number,
): ContractsResult | null {
  if (riskDollar <= 0 || stopPoints <= 0 || pointValue <= 0) return null;
  const contracts = Math.floor(riskDollar / (stopPoints * pointValue));
  return { contracts, effectiveRisk: contracts * stopPoints * pointValue };
}

// ---- Forex ---------------------------------------------------------------

/**
 * Major pairs with the approximate USD value of 1 pip for ONE standard lot
 * (100k units), assuming a USD-denominated account. Quote-USD pairs are exactly
 * $10/pip; others move with rates — values are the conventional approximations
 * used by risk calculators and are clearly labelled in the UI.
 */
export const FOREX_PAIRS = [
  { label: "EUR/USD", pipValue: 10 },
  { label: "GBP/USD", pipValue: 10 },
  { label: "AUD/USD", pipValue: 10 },
  { label: "NZD/USD", pipValue: 10 },
  { label: "USD/JPY", pipValue: 6.7 },
  { label: "USD/CHF", pipValue: 11.2 },
  { label: "USD/CAD", pipValue: 7.3 },
  { label: "EUR/GBP", pipValue: 12.7 },
  { label: "XAU/USD", pipValue: 10 },
] as const;

export interface LotsResult {
  /** Standard lots, floored to 2 decimals (micro-lot precision). */
  lots: number;
  miniLots: number;
  microLots: number;
  units: number;
  effectiveRisk: number;
  /** $ per pip at the computed size. */
  pipValueAtSize: number;
}

/** lots = risk / (stop pips × pip value per standard lot); null when inputs incomplete. */
export function calcForexLots(
  riskDollar: number,
  stopPips: number,
  pipValuePerLot: number,
): LotsResult | null {
  if (riskDollar <= 0 || stopPips <= 0 || pipValuePerLot <= 0) return null;
  const raw = riskDollar / (stopPips * pipValuePerLot);
  const lots = Math.floor(raw * 100) / 100; // floor to micro-lot so risk never exceeds target
  return {
    lots,
    miniLots: Math.round(lots * 10 * 100) / 100,
    microLots: Math.round(lots * 100 * 100) / 100,
    units: Math.round(lots * 100_000),
    effectiveRisk: Math.round(lots * stopPips * pipValuePerLot * 100) / 100,
    pipValueAtSize: Math.round(lots * pipValuePerLot * 100) / 100,
  };
}
