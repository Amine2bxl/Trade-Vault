/**
 * Le catalogue des offres — source unique, partagée par l'app ET le serveur.
 *
 * Un prix, un nom d'offre ou une fonctionnalité incluse n'existe qu'ICI. La
 * landing, la page d'abonnement, les cadenas sur les pages premium, Stripe et
 * le paiement crypto lisent tous ce fichier : changer l'offre est une seule
 * édition, et il devient impossible d'afficher 15 € à un endroit et 19 € à un
 * autre.
 *
 * Ce module reste sans dépendance (pas de React, pas de `process.env`) pour
 * pouvoir être importé des deux côtés.
 */

export type Tier = "free" | "pro" | "elite" | "fund";
export type Interval = "monthly" | "yearly";
export type PaidPlan =
  | "pro_monthly"
  | "pro_yearly"
  | "elite_monthly"
  | "elite_yearly"
  | "fund_monthly"
  | "fund_yearly";
export type Plan = "free" | PaidPlan;

/** Ordre des paliers : un palier donne accès à tout ce qu'offrent ceux d'en dessous. */
export const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1, elite: 2, fund: 3 };

export const PAID_TIERS = ["pro", "elite", "fund"] as const;
export type PaidTier = (typeof PAID_TIERS)[number];

/** Texte bilingue — la landing et l'app n'ont pas le même dictionnaire i18n,
 *  et une offre doit se lire pareil des deux côtés. */
export interface Bi {
  fr: string;
  en: string;
}

export interface TierDef {
  id: Tier;
  name: Bi;
  /** La phrase qui dit à qui l'offre s'adresse. */
  tagline: Bi;
  /** Prix mensuel en euros (0 pour l'offre gratuite). */
  monthly: number;
  /** Prix annuel en euros. Deux mois offerts par rapport au mensuel. */
  yearly: number;
  /** Ce que le palier ajoute — l'offre du dessus hérite de tout. */
  features: Bi[];
  /** Mise en avant sur la grille de prix. */
  featured?: boolean;
}

/**
 * Les quatre paliers.
 *
 * Chaque palier n'énumère QUE ce qu'il ajoute au précédent : la grille de prix
 * affiche « tout Pro, plus… », donc dupliquer les lignes créerait des colonnes
 * illisibles et un risque de divergence à la première modification.
 */
export const TIERS: TierDef[] = [
  {
    id: "free",
    name: { fr: "Gratuit", en: "Free" },
    tagline: { fr: "Ton journal, sans limite.", en: "Your journal, unlimited." },
    monthly: 0,
    yearly: 0,
    features: [
      { fr: "Journal et captures illimités", en: "Unlimited journal and screenshots" },
      { fr: "Tableau de bord et calendrier", en: "Dashboard and calendar" },
      { fr: "Checklist, plan, calculateur", en: "Checklist, plan, calculator" },
      { fr: "1 compte", en: "1 account" },
    ],
  },
  {
    id: "pro",
    name: { fr: "Pro", en: "Pro" },
    tagline: {
      fr: "Sais ce qui te rapporte et ce qui te coûte.",
      en: "Know what pays and what costs you.",
    },
    monthly: 15,
    yearly: 120,
    featured: true,
    features: [
      { fr: "Analyses complètes de ton edge", en: "Full edge analytics" },
      { fr: "Tes erreurs, chiffrées", en: "Your mistakes, quantified" },
      { fr: "Objectifs et setups manqués", en: "Goals and missed setups" },
      { fr: "3 comptes", en: "3 accounts" },
    ],
  },
  {
    id: "elite",
    name: { fr: "Elite", en: "Elite" },
    tagline: {
      fr: "Un coach qui a lu tous tes trades.",
      en: "A coach that has read every trade.",
    },
    monthly: 29,
    yearly: 240,
    features: [
      { fr: "Jarvis illimité + rapports IA", en: "Unlimited Jarvis + AI reports" },
      { fr: "Monte-Carlo et simulateur", en: "Monte Carlo and simulator" },
      { fr: "Saisonnalité et patterns", en: "Seasonality and patterns" },
      { fr: "10 comptes", en: "10 accounts" },
    ],
  },
  {
    id: "fund",
    name: { fr: "Fund", en: "Fund" },
    tagline: {
      fr: "Plusieurs comptes prop firm, un seul pilote.",
      en: "Several prop accounts, one cockpit.",
    },
    monthly: 49,
    yearly: 390,
    features: [
      { fr: "Comptes illimités", en: "Unlimited accounts" },
      { fr: "Automatisation et alertes", en: "Automation and alerts" },
      { fr: "Exports investisseurs", en: "Investor-ready exports" },
      { fr: "Support prioritaire", en: "Priority support" },
    ],
  },
];

export const TIER_BY_ID = Object.fromEntries(TIERS.map((p) => [p.id, p])) as Record<Tier, TierDef>;

/** Le palier d'un plan enregistré en base. */
export function tierOf(plan: Plan | string | null | undefined): Tier {
  if (typeof plan !== "string") return "free";
  const tier = plan.split("_")[0];
  return tier === "pro" || tier === "elite" || tier === "fund" ? tier : "free";
}

export function intervalOf(plan: Plan | string): Interval {
  return typeof plan === "string" && plan.endsWith("_yearly") ? "yearly" : "monthly";
}

export function planId(tier: PaidTier, interval: Interval): PaidPlan {
  return `${tier}_${interval}` as PaidPlan;
}

export function isPaidPlan(value: unknown): value is PaidPlan {
  return (
    typeof value === "string" &&
    (PAID_TIERS as readonly string[]).includes(value.split("_")[0]) &&
    (value.endsWith("_monthly") || value.endsWith("_yearly"))
  );
}

/** Le montant facturé pour un plan, tel qu'affiché partout. */
export function planPrice(plan: PaidPlan): number {
  const tier = TIER_BY_ID[tierOf(plan)];
  return intervalOf(plan) === "yearly" ? tier.yearly : tier.monthly;
}

/** Prix plein annuel (12 mensualités) — l'ancre honnête à côté du prix annuel. */
export function yearlyFullPrice(tier: Tier): number {
  return TIER_BY_ID[tier].monthly * 12;
}
export function yearlyPerMonth(tier: Tier): number {
  return TIER_BY_ID[tier].yearly / 12;
}
export function yearlySaving(tier: Tier): number {
  return Math.round(yearlyFullPrice(tier) - TIER_BY_ID[tier].yearly);
}
/** Mois offerts sur l'engagement annuel (2 aux prix actuels). */
export function monthsFree(tier: Tier): number {
  const t = TIER_BY_ID[tier];
  return t.monthly ? Math.round(12 - t.yearly / t.monthly) : 0;
}

// ── Ce que chaque palier débloque ───────────────────────────────────────────

/**
 * Les capacités gardées, et le palier minimum qui les ouvre.
 *
 * Une capacité, pas une page : « comptes multiples » se vérifie dans un
 * sélecteur, « Jarvis illimité » dans un quota. Les pages entières passent par
 * `PAGE_TIER` ci-dessous.
 */
export type Capability =
  | "analytics"
  | "mistakes"
  | "goals"
  | "missed"
  | "news"
  | "jarvis"
  | "reports"
  | "montecarlo"
  | "seasonality"
  | "patterns"
  | "automation"
  | "pushAlerts"
  | "prioritySupport";

export const CAPABILITY_TIER: Record<Capability, Tier> = {
  analytics: "pro",
  mistakes: "pro",
  goals: "pro",
  missed: "pro",
  news: "pro",
  jarvis: "elite",
  reports: "elite",
  montecarlo: "elite",
  seasonality: "elite",
  patterns: "elite",
  automation: "fund",
  pushAlerts: "fund",
  prioritySupport: "fund",
};

/** Nombre de comptes de trading autorisés (Infinity au palier Fund). */
export const ACCOUNT_LIMIT: Record<Tier, number> = {
  free: 1,
  pro: 3,
  elite: 10,
  fund: Infinity,
};

export function tierAtLeast(current: Tier, required: Tier): boolean {
  return TIER_RANK[current] >= TIER_RANK[required];
}
