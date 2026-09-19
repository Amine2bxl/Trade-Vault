/**
 * accountHealth — OÙ EN EST LE COMPTE, par rapport à ses propres règles.
 *
 * Module PUR : il prend des trades et des règles, il rend des nombres. Aucun
 * React, aucun accès réseau — c'est ce qui permet de le tester, et c'est
 * surtout ce qui permet au journal réel et au rejeu de lire EXACTEMENT le même
 * calcul. Deux tableaux de bord qui calculeraient chacun leur drawdown
 * finiraient par ne plus dire la même chose.
 *
 * LE PLANCHER VIENT DU MOTEUR DE RÈGLES, pas d'ici (`computeFloor`). Les trois
 * types de drawdown — statique, trailing intraday, trailing à la clôture — ne
 * se ressemblent que de loin, et les réimplémenter aurait produit une seconde
 * vérité pour une seule règle.
 *
 * AUCUNE RÈGLE N'EST INVENTÉE. Sans limite configurée, il n'y a ni plancher,
 * ni marge restante, ni pourcentage vers la cible — et les champs valent
 * `null`. Afficher « il te reste 3 402 $ » sur un compte dont personne n'a
 * saisi le drawdown serait un chiffre sorti de nulle part, et le trader le
 * croirait.
 */

import type { Trade } from "../types";
import { computeFloor, type AccountRules } from "@/modules/probability/rules";

/** Un point de la courbe de solde — un par journée tradée. */
export interface BalancePoint {
  date: string;
  balance: number;
  /** Le plancher à cette date, `null` si aucune règle de drawdown. */
  floor: number | null;
}

export interface AccountHealth {
  /** La courbe, du plus ancien au plus récent. */
  curve: BalancePoint[];
  startingBalance: number;
  /** Solde courant = départ + P&L cumulé. */
  balance: number;
  /** Plus haut solde atteint (clôtures de journée). */
  peak: number;
  /** Repli depuis le plus haut, en devise. Toujours ≥ 0. */
  drawdown: number;
  /** Plancher courant, `null` sans règle de drawdown. */
  floor: number | null;
  /** Ce qui reste avant le plancher, `null` sans règle. Peut être négatif. */
  remaining: number | null;
  /** Solde visé, `null` sans objectif configuré. */
  target: number | null;
  /**
   * Avancement du plancher vers la cible, entre 0 et 1.
   *
   * Mesuré sur le segment plancher → cible, pas 0 → cible : c'est la seule
   * lecture utile sur un compte financé, où tout se joue dans cette bande.
   * `null` s'il manque l'une des deux bornes.
   */
  progress: number | null;
  /** Le compte a-t-il franchi son plancher ? */
  breached: boolean;
}

/** Les journées tradées, du plus ancien au plus récent, avec leur P&L. */
function dailyPnl(trades: Trade[]): { date: string; pnl: number }[] {
  const map = new Map<string, number>();
  for (const t of trades) map.set(t.date, (map.get(t.date) ?? 0) + t.pnl);
  return [...map.entries()]
    .map(([date, pnl]) => ({ date, pnl }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function computeAccountHealth(
  trades: Trade[],
  startingBalance: number,
  rules?: AccountRules | null,
): AccountHealth {
  // Le solde de départ du COMPTE fait autorité : une règle enregistrée pour un
  // autre capital ne doit pas déplacer la courbe de celui-ci. Il est donc posé
  // APRÈS l'étalement, et c'est lui qui gagne.
  const effective: AccountRules = { ...(rules ?? {}), startingBalance };
  const hasDrawdown = Boolean(effective.maxDrawdown && effective.maxDrawdown > 0);

  const days = dailyPnl(trades);
  const curve: BalancePoint[] = [];
  let balance = startingBalance;
  let peak = startingBalance;
  let peakEod = startingBalance;

  for (const d of days) {
    balance += d.pnl;
    // Le plus haut se met à jour APRÈS la journée : un plancher trailing suit
    // les clôtures, et la journée qu'on vient d'ajouter en est une.
    peak = Math.max(peak, balance);
    peakEod = Math.max(peakEod, balance);
    const floor = hasDrawdown ? computeFloor(effective, peak, peakEod) : null;
    curve.push({
      date: d.date,
      balance,
      floor: floor != null && Number.isFinite(floor) ? floor : null,
    });
  }

  const floorNow = hasDrawdown ? computeFloor(effective, peak, peakEod) : null;
  const floor = floorNow != null && Number.isFinite(floorNow) ? floorNow : null;
  const target =
    effective.profitTarget && effective.profitTarget > 0
      ? startingBalance + effective.profitTarget
      : null;

  const progress =
    floor != null && target != null && target > floor
      ? Math.min(1, Math.max(0, (balance - floor) / (target - floor)))
      : null;

  return {
    curve,
    startingBalance,
    balance,
    peak,
    drawdown: Math.max(0, peak - balance),
    floor,
    remaining: floor != null ? balance - floor : null,
    target,
    progress,
    breached: floor != null && balance <= floor,
  };
}
