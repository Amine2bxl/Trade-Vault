import type { EdgeModel, Pools } from "./strategy";
import type { SimConfig } from "./simulation";

/**
 * LE PLAN — tout ce que le trader règle, en unités lisibles.
 *
 * Les pourcentages restent des pourcentages (52, pas 0.52) : c'est ce que le
 * panneau affiche et ce que le trader tape. La conversion vers le moteur se
 * fait ici, à un seul endroit.
 */
export interface Plan {
  /** Taux de réussite des trades décisifs, en %. */
  winRate: number;
  /** Gain moyen, en R. */
  avgWinR: number;
  /** Perte moyenne, en R (valeur absolue). */
  avgLossR: number;
  /** Part des trades neutres, en %. */
  beRate: number;
  tradesPerDay: number;
  balance: number;
  /** Risque par trade, en % du solde de départ. */
  riskPct: number;
  days: number;
  /** Objectif, en % du solde de départ. */
  targetPct: number;
  /** Limite de perte, en % du solde de départ. */
  limitPct: number;
}

export const modelOfPlan = (p: Plan): EdgeModel => ({
  winRate: p.winRate / 100,
  beRate: p.beRate / 100,
  avgWinR: p.avgWinR,
  avgLossR: p.avgLossR,
});

/** Le plan exprimé pour le moteur. */
export function configOf(p: Plan, pools: Pools, runs: number, seed: number): SimConfig {
  return {
    model: modelOfPlan(p),
    pools,
    balance: p.balance,
    risk: (p.balance * p.riskPct) / 100,
    tradesPerDay: p.tradesPerDay,
    days: p.days,
    targetPct: p.targetPct,
    limitPct: p.limitPct,
    runs,
    seed,
  };
}

const KEYS: (keyof Plan)[] = [
  "winRate",
  "avgWinR",
  "avgLossR",
  "beRate",
  "tradesPerDay",
  "balance",
  "riskPct",
  "days",
  "targetPct",
  "limitPct",
];

/** Les réglages qui diffèrent entre deux plans. */
export function changedKeys(a: Plan, b: Plan): (keyof Plan)[] {
  return KEYS.filter((k) => Math.abs(a[k] - b[k]) > 1e-9);
}

/** Arrondis d'affichage : le plan prérempli ne doit pas porter 52,38461 %. */
export const roundPlan = (p: Plan): Plan => ({
  winRate: Math.round(p.winRate),
  avgWinR: Math.round(p.avgWinR * 100) / 100,
  avgLossR: Math.round(p.avgLossR * 100) / 100,
  beRate: Math.round(p.beRate),
  tradesPerDay: Math.min(10, Math.max(1, Math.round(p.tradesPerDay))),
  balance: Math.round(p.balance),
  riskPct: Math.round(p.riskPct * 20) / 20,
  days: Math.round(p.days),
  targetPct: Math.round(p.targetPct),
  limitPct: Math.round(p.limitPct),
});
