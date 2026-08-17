import { confidenceFrom } from "../confidence";
import type { Detector } from "./types";

/**
 * risk_after_loss — le risque augmente après une perte.
 *
 * C'est la fuite comportementale la plus coûteuse en trading retail et la plus
 * invisible dans les stats agrégées. Détecté quand la taille moyenne du trade
 * qui SUIT une perte est nettement supérieure à la normale, et que ces trades
 * coûtent de l'argent.
 */
export const riskAfterLossDetector: Detector = (data) => {
  const ral = data.signals.riskAfterLoss;
  if (!ral || ral.tradesAfterLoss < 5 || ral.driftPct < 15) return null;

  return {
    moment: "warning",
    pattern: "risk_after_loss",
    priority: 0, // attribué par priority.ts
    confidence: confidenceFrom(ral.tradesAfterLoss, ral.driftPct / 40),
    sampleSize: ral.tradesAfterLoss,
    evidence: {
      driftPct: ral.driftPct,
      avgRiskNormal: ral.avgRiskNormal,
      avgRiskAfterLoss: ral.avgRiskAfterLoss,
      pnlAfterLoss: ral.pnlAfterLoss,
    },
    // `pnlAfterLoss` est le P&L TOTAL des trades pris après une perte, pas le
    // surcoût imputable à l'augmentation de taille : le trader aurait perdu
    // quelque chose sur ces trades même en taille normale. C'est donc une
    // borne HAUTE, et le texte affiché doit le refléter — il disait
    // « ce comportement t'a coûté X », ce qui transformait une corrélation en
    // causalité et surestimait l'impact. Un chiffre exagéré coûte la
    // crédibilité du coach auprès du seul public qui paie : celui qui compte.
    impact:
      ral.pnlAfterLoss < 0
        ? { label: "Coût estimé après perte", amount: Math.abs(ral.pnlAfterLoss), unit: "$" }
        : null,
    mission: ["pause_after_loss", "keep_size_after_loss"],
    affectedTrades: ral.afterLossTradeIds,
  };
};
