/**
 * Money-management — dimensionner par le risque, pas à l'intuition.
 *
 * Le terminal laissait saisir une quantité au doigt mouillé. Or la discipline
 * que le journal TradeVault cherche à mesurer commence ici : on décide d'abord
 * COMBIEN on accepte de perdre, le stop dit à quelle distance, et la taille de
 * position n'est que le quotient des deux. C'est l'ordre inverse de l'habitude,
 * et c'est le seul qui rend le risque constant d'un trade à l'autre.
 *
 * Rien dans ce module ne touche au moteur ni au DOM : ce sont des fonctions
 * pures, testables, que le ticket comme les panneaux peuvent appeler.
 */

import { InstrumentSpec, NQ } from "./instruments";
import { ReplaySessionState } from "./types";

export interface SizingInput {
  /** Capital de référence — en pratique l'equity courante. */
  balance: number;
  /** Part du capital acceptée en perte, en pourcent (1 = 1 %). */
  riskPct: number;
  entry: number;
  stop: number;
  spec?: InstrumentSpec;
  /** Commission par contrat, comptée à l'aller ET au retour. */
  commissionPerContract?: number;
}

export interface Sizing {
  /** Nombre entier de contrats tenables dans le budget. */
  contracts: number;
  /** Dollars alloués au trade. */
  riskBudget: number;
  /** Coût d'un stop touché, pour UN contrat, commissions comprises. */
  riskPerContract: number;
  /** Dollars réellement risqués par `contracts` contrats. */
  riskUsed: number;
  stopPoints: number;
  stopTicks: number;
}

/**
 * La taille de position qu'autorise un budget de risque.
 *
 * Rend `null` quand la question n'a pas de sens : pas de stop, stop du mauvais
 * côté, budget nul. On préfère ne rien proposer plutôt qu'un chiffre arbitraire
 * — une taille inventée est pire qu'une taille absente.
 */
export function sizeFromRisk(input: SizingInput): Sizing | null {
  const spec = input.spec ?? NQ;
  const stopPoints = Math.abs(input.entry - input.stop);
  if (!Number.isFinite(stopPoints) || stopPoints <= 0) return null;
  if (!Number.isFinite(input.balance) || input.balance <= 0) return null;
  if (!Number.isFinite(input.riskPct) || input.riskPct <= 0) return null;

  const commission = Math.max(0, input.commissionPerContract ?? 0);
  // Aller-retour : entrer coûte une commission, sortir une autre. L'ignorer
  // sous-estime le risque de chaque trade, et d'autant plus qu'il est petit.
  const riskPerContract = stopPoints * spec.multiplier + commission * 2;
  if (riskPerContract <= 0) return null;

  const riskBudget = (input.balance * input.riskPct) / 100;
  // Plancher, jamais arrondi au plus près : dépasser le budget n'est pas une
  // approximation acceptable.
  const contracts = Math.max(0, Math.floor(riskBudget / riskPerContract));
  return {
    contracts,
    riskBudget,
    riskPerContract,
    riskUsed: contracts * riskPerContract,
    stopPoints,
    stopTicks: Math.round(stopPoints / spec.tickSize),
  };
}

/** Dollars risqués par une taille DONNÉE — le pendant lecture de `sizeFromRisk`. */
export function riskOfSize(
  qty: number,
  entry: number,
  stop: number,
  spec: InstrumentSpec = NQ,
  commissionPerContract = 0,
): number {
  const stopPoints = Math.abs(entry - stop);
  if (!Number.isFinite(stopPoints) || stopPoints <= 0 || qty <= 0) return 0;
  return qty * (stopPoints * spec.multiplier + Math.max(0, commissionPerContract) * 2);
}

/** Ce que `qty` contrats représentent en part du capital. */
export function riskPctOfSize(
  qty: number,
  entry: number,
  stop: number,
  balance: number,
  spec: InstrumentSpec = NQ,
  commissionPerContract = 0,
): number {
  if (!Number.isFinite(balance) || balance <= 0) return 0;
  return (riskOfSize(qty, entry, stop, spec, commissionPerContract) / balance) * 100;
}

export interface DailyLoss {
  /** Perte maximale tolérée sur la séance, en dollars. */
  limit: number;
  /** Perte réalisée à l'instant (positive quand on perd). */
  used: number;
  /** Ce qu'il reste avant le mur, jamais négatif. */
  remaining: number;
  breached: boolean;
  /** Part du budget consommée, bornée à 1. */
  ratio: number;
}

/**
 * Où en est la séance vis-à-vis de sa limite de perte journalière.
 *
 * Le P&L ouvert compte : une position en cours qui dépasse la limite la
 * dépasse réellement. Attendre sa clôture pour l'admettre est précisément
 * l'erreur que la règle existe pour empêcher.
 */
export function dailyLossState(state: ReplaySessionState, maxLossPct: number): DailyLoss | null {
  const base = state.account.startingBalance;
  if (!Number.isFinite(base) || base <= 0) return null;
  if (!Number.isFinite(maxLossPct) || maxLossPct <= 0) return null;
  const limit = (base * maxLossPct) / 100;
  const net = state.account.realizedPnl - state.account.commissions + state.account.openPnl;
  const used = Math.max(0, -net);
  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
    breached: used >= limit,
    ratio: Math.min(1, used / limit),
  };
}
