import { LIMITS, type Tier } from "@/domain/plans";
import type { Trade } from "../types";

/**
 * Les limites d'usage, côté application.
 *
 * Une limite dépassée n'est pas une erreur technique : c'est un moment de
 * vente. On la signale donc avec un type dédié, pour que l'interface puisse
 * afficher la bonne offre plutôt qu'un « échec de l'enregistrement » qui ne dit
 * rien et ne vend rien.
 */
export type LimitKind = "accounts" | "trades" | "jarvis";

export class PlanLimitError extends Error {
  readonly kind: LimitKind;
  constructor(kind: LimitKind) {
    super(`PLAN_LIMIT_${kind.toUpperCase()}`);
    this.name = "PlanLimitError";
    this.kind = kind;
  }
}

export function isPlanLimitError(e: unknown): e is PlanLimitError {
  return e instanceof PlanLimitError;
}

/**
 * Traduit un REFUS DE LA BASE en `PlanLimitError`.
 *
 * Les limites d'offre ne sont plus seulement vérifiées dans React : deux
 * déclencheurs Postgres (`enforce_trade_quota`, `enforce_account_quota`) les
 * appliquent aussi, parce que le navigateur parle directement à PostgREST avec
 * son propre jeton et qu'un `insert` direct — ou un trade antidaté — passait à
 * côté de tout contrôle applicatif.
 *
 * Quand c'est la base qui refuse, l'erreur remonte sous la forme d'un message
 * PostgREST. Sans cette traduction, l'utilisateur verrait « new row violates
 * check constraint » à la place de l'offre : un mur technique au moment précis
 * où le produit a quelque chose à vendre.
 *
 * Rend `null` si l'erreur n'est pas une limite d'offre — l'appelant doit alors
 * la relancer telle quelle, jamais l'avaler.
 */
export function planLimitFromDbError(e: unknown): PlanLimitError | null {
  const message =
    typeof e === "string"
      ? e
      : e && typeof e === "object" && "message" in e
        ? String((e as { message: unknown }).message)
        : "";
  if (message.includes("PLAN_LIMIT_TRADES")) return new PlanLimitError("trades");
  if (message.includes("PLAN_LIMIT_ACCOUNTS")) return new PlanLimitError("accounts");
  return null;
}

/** Le mois calendaire courant, au format `YYYY-MM`. */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Trades encodés sur le mois calendaire d'une date donnée. */
export function tradesThisMonth(trades: Trade[], month: string = currentMonth()): number {
  return trades.filter((t) => t.date.startsWith(month)).length;
}

/**
 * Ce trade peut-il être encodé ?
 *
 * La limite porte sur les CRÉATIONS du mois, jamais sur les modifications :
 * empêcher quelqu'un de corriger une note sur un trade déjà saisi serait
 * punitif et n'a aucun rapport avec l'offre.
 */
export function canLogTrade(tier: Tier, trades: Trade[], isEdit: boolean): boolean {
  if (isEdit) return true;
  const limit = LIMITS[tier].tradesPerMonth;
  if (!Number.isFinite(limit)) return true;
  return tradesThisMonth(trades) < limit;
}

/** Trades restants ce mois-ci. `Infinity` quand il n'y a pas de limite. */
export function tradesLeftThisMonth(tier: Tier, trades: Trade[]): number {
  const limit = LIMITS[tier].tradesPerMonth;
  if (!Number.isFinite(limit)) return Infinity;
  return Math.max(0, limit - tradesThisMonth(trades));
}
