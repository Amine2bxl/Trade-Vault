import type { Trade } from "@/domain";

/**
 * Module de coaching — les OBSERVATIONS proactives de Jarvis (Phase 0b, Step 6).
 *
 * Ces types sont le vocabulaire que le moteur d'automation et le moteur de
 * notifications échangent via le bus d'événements, SANS dépendre de la couche
 * UI. La règle de direction des dépendances interdit à `src/modules/` d'importer
 * `src/app/` : l'observation d'après-trade est donc autoportée (elle ne lit que
 * le trade, l'intention, la réflexion et le contexte du jour).
 */

/** Priorité d'intervention (Step 6G). LOW ne devient jamais une notification. */
export type CoachingPriority = "high" | "medium" | "low";

/**
 * Forme minimale de l'intention d'un trade. Structurellement compatible avec
 * `TradeIntentInput` (`store/tradeIntel`) — on ne réimporte pas le store ici,
 * on accepte un objet plat équivalent.
 */
export interface AfterTradeIntent {
  emotion?: string | null;
  reasoning?: string | null;
  plan?: string | null;
}

/** Forme minimale de la réflexion d'un trade (voir `TradeReflectionInput`). */
export interface AfterTradeReflection {
  planRespected?: "yes" | "partial" | "no" | null;
  reason?: string | null;
  note?: string | null;
}

export interface AfterTradeInput {
  trade: Trade;
  intent?: AfterTradeIntent | null;
  reflection?: AfterTradeReflection | null;
  /** Trades déjà enregistrés (historique, tous jours confondus). */
  previousTrades: Trade[];
}

export interface AfterTradeObservation {
  /** null = rien à dire ; low = reste dans la review, jamais notifié. */
  priority: CoachingPriority | null;
  /** Identifiant stable du signal (ex: "intent_execution_gap", "loss_streak"). */
  kind: string;
  claim: string;
  evidence: {
    pnl: number;
    confidence?: number;
    planRespected?: "yes" | "partial" | "no" | null;
    reason?: string | null;
    emotion?: string | null;
    /** Pertes consécutives du jour, ce trade inclus. */
    consecutiveLossesToday: number;
    /** Le trade précédent du jour était une perte. */
    afterLoss: boolean;
  };
  /** Les trades qui portent l'observation (deep-link « voir »). */
  affectedTradeIds: string[];
  /** Récurrence mesurée (pertes consécutives) — jamais inventée. */
  recurrence: { count: number; lowSample: boolean } | null;
}
