import type { MissedOpportunity } from "@/app/types";
import { countedR, type MissedRecord } from "@/domain/missedSetup";

/** Une ligne de l'app → l'entrée du calcul pur (`domain/missedSetup`). */
export function recordOf(m: MissedOpportunity): MissedRecord {
  return {
    direction: m.direction ?? null,
    entry: m.entryPrice ?? null,
    stop: m.stopPrice ?? null,
    target: m.targetPrice ?? null,
    classification: m.classification ?? null,
    outcome: m.outcome ?? null,
    declaredR: Number(m.estimatedR) || 0,
  };
}

/** Le R qui compte dans « laissé sur la table » ; `null` s'il ne compte pas. */
export const missedR = (m: MissedOpportunity): number | null => countedR(recordOf(m));
