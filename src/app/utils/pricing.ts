/**
 * Pricing — la vue « app » du catalogue d'offres.
 *
 * Le catalogue lui-même vit dans `@/domain/plans` (partagé avec le serveur).
 * Ce module ajoute ce qui n'a de sens que dans l'interface : le formatage des
 * montants en euros, et la carte page → palier requis qui pose les cadenas.
 */

import type { Page } from "../types";
import type { Bi } from "@/domain/plans";
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
  // Pro porte la promesse du produit — comprendre son trading.
  analytics: "pro",
  mistakes: "pro",
  missed: "pro",
  goals: "pro",
  news: "pro",
  insights: "pro",
  reports: "pro",
  // Elite ajoute la projection : ce qui n'existe qu'une fois le reste maîtrisé.
  montecarlo: "elite",
  seasonality: "elite",
};

/**
 * Ce que chaque page payante APPORTE, en une phrase.
 *
 * Le mur d'aperçu et la page d'abonnement affichent cette phrase, pas un nom
 * de fonctionnalité : « Saisonnalité » ne dit rien à personne, « tes heures et
 * tes jours les plus rentables » se comprend en une seconde. La valeur doit se
 * sentir avant d'être expliquée.
 */
export const PAGE_VALUE: Partial<Record<Page, { title: Bi; benefit: Bi }>> = {
  analytics: {
    title: { fr: "Analyses", en: "Analytics" },
    benefit: {
      fr: "Quel setup te paie vraiment, et lequel te coûte chaque mois.",
      en: "Which setup actually pays you, and which one bleeds you monthly.",
    },
  },
  mistakes: {
    title: { fr: "Erreurs", en: "Mistakes" },
    benefit: {
      fr: "Le prix en euros de chacune de tes erreurs récurrentes.",
      en: "The euro price of every mistake you keep repeating.",
    },
  },
  insights: {
    title: { fr: "Jarvis", en: "Jarvis" },
    benefit: {
      fr: "Un coach qui a lu tes trades et te dit quoi corriger demain.",
      en: "A coach that has read your trades and says what to fix tomorrow.",
    },
  },
  reports: {
    title: { fr: "Rapports", en: "Reports" },
    benefit: {
      fr: "Ton bilan mensuel écrit pour toi, prêt à relire ou à envoyer.",
      en: "Your monthly review, written for you, ready to read or send.",
    },
  },
  goals: {
    title: { fr: "Objectifs", en: "Goals" },
    benefit: {
      fr: "Où tu en es de ton objectif, et le rythme qu'il faut tenir.",
      en: "Where you stand on your goal, and the pace it takes.",
    },
  },
  missed: {
    title: { fr: "Setups manqués", en: "Missed setups" },
    benefit: {
      fr: "Ce que t'ont coûté les trades que tu n'as pas pris.",
      en: "What the trades you skipped have cost you.",
    },
  },
  news: {
    title: { fr: "Calendrier éco", en: "Econ calendar" },
    benefit: {
      fr: "Les annonces qui vont bouger tes paires, avant l'ouverture.",
      en: "The releases that will move your pairs, before the open.",
    },
  },
  montecarlo: {
    title: { fr: "Monte-Carlo", en: "Monte Carlo" },
    benefit: {
      fr: "Ta probabilité de ruine sur 10 000 scénarios de ton edge.",
      en: "Your risk of ruin across 10,000 runs of your own edge.",
    },
  },
  seasonality: {
    title: { fr: "Saisonnalité", en: "Seasonality" },
    benefit: {
      fr: "Tes heures et tes jours rentables — et ceux à ne plus trader.",
      en: "Your profitable hours and days — and the ones to stop trading.",
    },
  },
};

/** La capacité correspondant à une page gardée, pour les libellés. */
export function capabilityForPage(page: Page): Capability | null {
  return page in CAPABILITY_TIER ? (page as Capability) : null;
}

export function canAccessPage(tier: Tier, page: Page): boolean {
  const required = PAGE_TIER[page];
  return !required || tierAtLeast(tier, required);
}

/** Les pages payantes d'un palier, dans l'ordre de la navigation. */
export function pagesOfTier(tier: Tier): Page[] {
  return (Object.keys(PAGE_TIER) as Page[]).filter((p) => PAGE_TIER[p] === tier);
}
