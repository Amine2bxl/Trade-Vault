import { hasMeasuredRisk, type Trade } from "./trade";
import { easternEntryMinute } from "./quantStats";
import {
  balanceBeforeEntry,
  reconcileSnapshots,
  type BalanceLedger,
  type SnapshotReconciliation,
} from "./balanceAtEntry";

/**
 * QUALITÉ DES DONNÉES DU JOURNAL — module pur (lot 1).
 *
 * Chaque statistique du produit écarte ce qu'elle ne peut pas prouver : un R
 * sans risque mesuré, une heure Eastern non établie, un solde historique non
 * reconstruit. Ce rapport COMPTE ces exclusions, pour que le trader voie ce
 * qui manque et puisse le compléter — au lieu de chiffres silencieusement
 * calculés sur moins de trades qu'il ne le croit. Il ne corrige rien.
 */

export interface DataQuality {
  trades: number;
  /** Imports pas encore relus : ni R, ni setup, ni heure certifiée. */
  pendingReview: number;
  /** Relus, mais sans risque initial mesuré : hors de toute statistique en R. */
  riskUnmeasured: number;
  /** Trades broker sans frais connus : leur P&L est un brut. */
  feesUnknown: number;
  /** Heure Eastern non établie : hors des sessions et tranches horaires. */
  clockUnproven: number;
  /** Solde avant l'entrée, par niveau de preuve. */
  balance: { verified: number; partial: number; unknown: number };
  /** Rapprochement des soldes observés consécutifs. */
  reconciliation: SnapshotReconciliation[];
}

export function assessDataQuality(
  trades: readonly Trade[],
  ledger: Omit<BalanceLedger, "trades">,
): DataQuality {
  const full: BalanceLedger = { ...ledger, trades };
  const out: DataQuality = {
    trades: trades.length,
    pendingReview: 0,
    riskUnmeasured: 0,
    feesUnknown: 0,
    clockUnproven: 0,
    balance: { verified: 0, partial: 0, unknown: 0 },
    reconciliation: reconcileSnapshots(full),
  };
  const anySnapshot = ledger.snapshots.length > 0;
  for (const t of trades) {
    if (t.reviewPending) out.pendingReview++;
    else if (!hasMeasuredRisk(t)) out.riskUnmeasured++;
    if (t.broker && (t.fees === null || t.fees === undefined)) out.feesUnknown++;
    if (easternEntryMinute(t) === null) out.clockUnproven++;
    // Sans aucun snapshot, tout est inconnu : inutile de reconstruire.
    const status = anySnapshot ? balanceBeforeEntry(t, full).status : "UNKNOWN";
    if (status === "VERIFIED") out.balance.verified++;
    else if (status === "PARTIAL") out.balance.partial++;
    else out.balance.unknown++;
  }
  return out;
}
