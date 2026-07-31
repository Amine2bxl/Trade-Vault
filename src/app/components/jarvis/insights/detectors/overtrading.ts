import { confidenceFrom } from "../confidence";
import type { Detector } from "./types";

/**
 * overtrading — les journées chargées coûtent de l'argent.
 *
 * Un trader qui force des trades les mauvais jours obtient un PnL par trade
 * nettement inférieur (voire négatif) sur les journées denses par rapport aux
 * journées sélectives. Le coût est le PnL négatif cumulé des jours chargés.
 */
export const overtradingDetector: Detector = (data) => {
  const ot = data.signals.overtrading;
  if (!ot) return null;

  const busyLoses = ot.pnlOnBusyDays < 0;
  const busyWorse = ot.avgPnlPerTradeBusy < ot.avgPnlPerTradeCalm;
  if (!busyLoses || !busyWorse) return null;

  const gap = ot.avgPnlPerTradeCalm - ot.avgPnlPerTradeBusy;
  const effect = gap / Math.max(1, Math.abs(ot.avgPnlPerTradeCalm));

  return {
    moment: "warning",
    pattern: "overtrading",
    priority: 0,
    confidence: confidenceFrom(data.stats.totalTrades, effect),
    sampleSize: data.stats.totalTrades,
    evidence: {
      avgPnlPerTradeBusy: ot.avgPnlPerTradeBusy,
      avgPnlPerTradeCalm: ot.avgPnlPerTradeCalm,
      pnlOnBusyDays: ot.pnlOnBusyDays,
      pnlOnCalmDays: ot.pnlOnCalmDays,
      medianTradesPerDay: ot.medianTradesPerDay,
      busyDayThreshold: ot.busyDayThreshold,
    },
    impact: { label: "Coût des journées chargées", amount: Math.abs(ot.pnlOnBusyDays), unit: "$" },
    mission: [
      `Limiter la journée à ${ot.medianTradesPerDay + 1} trades max`,
      "N'entrer que sur des setups validés",
    ],
  };
};
