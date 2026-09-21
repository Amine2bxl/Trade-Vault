/**
 * Pricing — la vue « app » du catalogue d'offres.
 *
 * Le catalogue lui-même vit dans `@/domain/plans` (partagé avec le serveur).
 * Ce module ajoute ce qui n'a de sens que dans l'interface : le formatage des
 * montants en euros, et la carte page → palier requis qui pose les cadenas.
 */

import type { Page } from "../types";
import { intlLocale } from "../i18n/locale";
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

/**
 * UN MONTANT EN EUROS, DANS LA LANGUE DE CELUI QUI LE LIT.
 *
 * ── LE DÉFAUT ─────────────────────────────────────────────────────────────
 *
 * Le formatage était `fr-FR`, EN DUR, suffixe compris. La grille tarifaire
 * anglaise affichait donc « 16,67 € » : virgule décimale française et symbole
 * derrière le nombre, au milieu d'une page dont tout le reste est en anglais.
 * Sur un montant à deux décimales, la virgule ne se lit pas comme un
 * séparateur décimal pour un anglophone - elle se lit comme un séparateur de
 * milliers, et « 16,67 € » devient un prix à quatre chiffres.
 *
 * C'est la page des tarifs : c'est le seul endroit du produit où un chiffre
 * mal lu coûte une conversion.
 *
 * ── LA RÈGLE ──────────────────────────────────────────────────────────────
 *
 * `Intl` place le symbole tout seul, du bon côté, avec le bon séparateur :
 * « 16,67 € » en français, « €16.67 » en anglais. On ne le recolle pas à la
 * main.
 *
 * Les décimales restent masquées sur un montant rond (« 15 € », pas
 * « 15,00 € ») : un prix d'abonnement entier s'écrit entier.
 *
 * La langue passe par `intlLocale`, la table `Lang → BCP-47` que tout le
 * produit utilise déjà pour les dates : une seule définition de « comment
 * cette langue s'écrit », et les douze langues de l'application sont donc
 * couvertes, pas seulement les deux de la vitrine.
 *
 * Le défaut reste le FRANÇAIS pour ne pas changer en silence le rendu des
 * surfaces qui ne passent pas encore de langue ; chaque appelant qui connaît
 * la sienne la passe.
 */
export function eur(n: number, lang?: string): string {
  return n.toLocaleString(lang ? intlLocale(lang) : "fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: n % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  });
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
  insights: "pro",
  reports: "pro",
  montecarlo: "pro",
  seasonality: "pro",
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
