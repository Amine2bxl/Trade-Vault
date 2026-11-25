/**
 * L'ÉTAT DE LA SÉANCE — PRÉPARATION, PRÊT, ACTIVE, PAUSE, TERMINÉE, VERROUILLÉE.
 *
 * Dérivé, jamais saisi : la phase du plan, la fenêtre, les limites atteintes,
 * une pause choisie. Module PUR (l'heure est passée par l'appelant).
 *
 * DEUX NATURES DE LIMITES, réglables une à une :
 *   - `block` : la porte d'entrée de la checklist se ferme. Franchir reste
 *     possible, mais seulement par une dérogation écrite et horodatée ;
 *   - `warn`  : la limite s'affiche, rien ne se ferme.
 * La journée d'observation ne se règle pas : elle se change en changeant le
 * plan, avec son motif (chemin existant).
 *
 * CE QUE LE VERROU NE FAIT PAS : il n'empêche jamais d'enregistrer un trade
 * réellement pris (le journal reflète la réalité), et l'application ne passe,
 * ne modifie ni ne clôt aucun ordre chez un broker.
 *
 * Les signaux de comportement (pertes d'affilée, envie de reprendre déclarée)
 * ne sont pas des faits psychologiques : ce sont des invitations à la pause.
 */

import type { Trade } from "@/domain/trade";
import type { Blocker, Override, Phase, WindowPhase } from "./sessionPlan";

export type Enforcement = "block" | "warn";

export type SessionState = "preparation" | "ready" | "active" | "paused" | "completed" | "locked";

/** Les limites qu'un trader peut passer de « bloque » à « avertit ». */
export const CONFIGURABLE_LIMITS = [
  "maxTrades",
  "stopAfterLosses",
  "dailyLoss",
  "riskBreach",
  "window",
  "windowEnded",
] as const satisfies readonly Blocker[];

export type ConfigurableLimit = (typeof CONFIGURABLE_LIMITS)[number];

/**
 * Par défaut, ce que la checklist bloquait déjà reste bloquant ; le
 * dépassement de risque — constaté APRÈS coup sur un trade déjà pris —
 * avertit d'abord.
 */
export const DEFAULT_ENFORCEMENT: Record<ConfigurableLimit, Enforcement> = {
  maxTrades: "block",
  stopAfterLosses: "block",
  dailyLoss: "block",
  riskBreach: "warn",
  window: "block",
  windowEnded: "block",
};

/** Limites qui VERROUILLENT la séance (la fenêtre, elle, la met en attente ou la termine). */
const LOCKING: readonly Blocker[] = [
  "observation",
  "maxTrades",
  "stopAfterLosses",
  "dailyLoss",
  "riskBreach",
];

export function enforcementOf(
  limit: Blocker,
  config: Partial<Record<ConfigurableLimit, Enforcement>> | undefined,
): Enforcement {
  if (limit === "observation") return "block";
  return config?.[limit] ?? DEFAULT_ENFORCEMENT[limit];
}

export interface LimitSplit {
  /** Ferment la porte d'entrée. */
  blocking: Blocker[];
  /** Affichées, sans rien fermer. */
  warnings: Blocker[];
  /** Bloquantes, mais franchies par une dérogation écrite. */
  overridden: Blocker[];
}

export function splitLimits(
  reached: readonly Blocker[],
  config: Partial<Record<ConfigurableLimit, Enforcement>> | undefined,
  overrides: readonly Override[],
): LimitSplit {
  const out: LimitSplit = { blocking: [], warnings: [], overridden: [] };
  for (const limit of reached) {
    if (enforcementOf(limit, config) === "warn") out.warnings.push(limit);
    else if (limit !== "observation" && overrides.some((o) => o.limit === limit))
      out.overridden.push(limit);
    else out.blocking.push(limit);
  }
  return out;
}

export function sessionState(input: {
  phase: Phase;
  window: WindowPhase;
  blocking: readonly Blocker[];
  pausedUntil: string | null;
  nowMs: number;
}): SessionState {
  if (input.phase === "plan") return "preparation";
  if (input.phase === "review" || input.phase === "closed") return "completed";
  if (input.blocking.some((b) => LOCKING.includes(b))) return "locked";
  if (input.pausedUntil && Date.parse(input.pausedUntil) > input.nowMs) return "paused";
  if (input.window === "before") return "ready";
  if (input.window === "after") return "completed";
  return "active";
}

/** Durée de la pause proposée : assez pour sortir de l'élan, assez courte pour être prise. */
export const PAUSE_MINUTES = 10;

export type BehaviorSignal = "lossStreak" | "reentryUrge";

/**
 * Invitations à la pause. `lossStreak` : les deux DERNIERS trades du jour (ordre
 * d'entrée) sont perdants. `reentryUrge` : le trader l'a DÉCLARÉ sur son dernier
 * trade. Jamais un diagnostic.
 */
export function behaviorSignals(input: {
  /** Trades du jour, dans l'ordre d'entrée (`dayFacts`). */
  trades: readonly Trade[];
  lastReentryUrge: boolean | null;
}): BehaviorSignal[] {
  const out: BehaviorSignal[] = [];
  const last = input.trades.slice(-2);
  if (last.length === 2 && last.every((t) => t.pnl < 0)) out.push("lossStreak");
  if (input.lastReentryUrge === true) out.push("reentryUrge");
  return out;
}
