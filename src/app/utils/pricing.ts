/**
 * Pricing — la vue « app » du catalogue d'offres.
 *
 * Le catalogue lui-même vit dans `@/domain/plans` (partagé avec le serveur).
 * Ce module ajoute ce qui n'a de sens que dans l'interface : le formatage des
 * montants en euros, et la carte page → palier requis qui pose les cadenas.
 */

import type { Page } from "../types";
import {
  TIER_BY_ID,
  CAPABILITY_TIER,
  tierAtLeast,
  yearlyFullPrice,
  yearlyPerMonth,
  yearlySaving,
  type Capability,
  type Tier,
} from "@/domain/plans";

export {
  TIERS,
  TIER_BY_ID,
  TIER_RANK,
  PAID_TIERS,
  CAPABILITY_TIER,
  ACCOUNT_LIMIT,
  tierOf,
  intervalOf,
  planId,
  isPaidPlan,
  planPrice,
  tierAtLeast,
  yearlyFullPrice,
  yearlyPerMonth,
  yearlySaving,
  monthsFree,
} from "@/domain/plans";
export type {
  Tier,
  PaidTier,
  Interval,
  Plan,
  PaidPlan,
  Capability,
  TierDef,
  Bi,
} from "@/domain/plans";

/** L'offre de référence — celle mise en avant partout (Pro). */
export const HEADLINE_TIER: Tier = "pro";

// Anciens noms, conservés parce qu'ils décrivent bien l'offre de référence et
// que la landing les lit directement.
export const MONTHLY_EUR = TIER_BY_ID.pro.monthly;
export const YEARLY_EUR = TIER_BY_ID.pro.yearly;
export const YEARLY_FULL_PRICE = yearlyFullPrice("pro");
export const YEARLY_PER_MONTH = yearlyPerMonth("pro");
export const YEARLY_SAVING = yearlySaving("pro");

/** Euro amounts, French formatting: no decimals when the amount is round. */
export function eur(n: number): string {
  return `${n.toLocaleString("fr-FR", {
    minimumFractionDigits: n % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })} €`;
}

/**
 * Le palier requis pour chaque page.
 *
 * Les pages absentes sont ouvertes à tout le monde : le journal, le tableau de
 * bord, le calendrier, la checklist, le plan et le calculateur restent
 * gratuits pour toujours — c'est ce qui rend l'offre gratuite réellement
 * utilisable, et donc l'offre payante honnête.
 */
export const PAGE_TIER: Partial<Record<Page, Tier>> = {
  analytics: "pro",
  mistakes: "pro",
  missed: "pro",
  goals: "pro",
  news: "pro",
  insights: "elite",
  reports: "elite",
  montecarlo: "elite",
  seasonality: "elite",
};

/** La capacité correspondant à une page gardée, pour les libellés. */
export function capabilityForPage(page: Page): Capability | null {
  return page in CAPABILITY_TIER ? (page as Capability) : null;
}

export function canAccessPage(tier: Tier, page: Page): boolean {
  const required = PAGE_TIER[page];
  return !required || tierAtLeast(tier, required);
}
