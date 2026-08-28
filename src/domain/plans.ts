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

export type Tier = "free" | "pro" | "elite";
export type Interval = "monthly" | "yearly";
export type PaidPlan = "pro_monthly" | "pro_yearly" | "elite_monthly" | "elite_yearly";
export type Plan = "free" | PaidPlan;

/** Ordre des paliers : un palier donne accès à tout ce qu'offrent ceux d'en dessous. */
export const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1, elite: 2 };

export const PAID_TIERS = ["pro", "elite"] as const;
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
    tagline: { fr: "Note tes trades. Pour toujours.", en: "Log your trades. Forever." },
    monthly: 0,
    yearly: 0,
    features: [
      {
        fr: "10 trades par mois, captures incluses",
        en: "10 trades a month, screenshots included",
      },
      { fr: "Tableau de bord et calendrier", en: "Dashboard and calendar" },
      { fr: "Checklist, plan, calculateur", en: "Checklist, plan, calculator" },
      { fr: "Jarvis 3 fois par jour", en: "Jarvis 3 times a day" },
      { fr: "1 compte de trading", en: "1 trading account" },
    ],
  },
  {
    id: "pro",
    name: { fr: "Pro", en: "Pro" },
    // La promesse centrale du produit. TOUS les outils d'analyse sont ici :
    // un trader qui paie ne doit jamais tomber sur un mur.
    tagline: {
      fr: "Découvre ce qui te rapporte, et ce qui te ruine.",
      en: "Find what pays you, and what ruins you.",
    },
    monthly: 15,
    yearly: 120,
    featured: true,
    features: [
      { fr: "Trades illimités", en: "Unlimited trades" },
      { fr: "Toutes les analyses de ton edge", en: "Every analysis of your edge" },
      { fr: "Tes erreurs chiffrées en euros", en: "Your mistakes priced in euros" },
      { fr: "Monte-Carlo : ta probabilité de ruine", en: "Monte Carlo: your risk of ruin" },
      { fr: "Saisonnalité : tes heures rentables", en: "Seasonality: your profitable hours" },
      { fr: "Jarvis 20 fois par jour", en: "Jarvis 20 times a day" },
      { fr: "Rapports mensuels automatiques", en: "Automatic monthly reports" },
      { fr: "Jusqu'à 3 comptes (2 sous-comptes)", en: "Up to 3 accounts (2 sub-accounts)" },
    ],
  },
  {
    id: "elite",
    name: { fr: "Elite", en: "Elite" },
    // Elite ne débloque aucune page : elle enlève les limites. C'est une offre
    // de VOLUME, pas de fonctionnalités — sinon elle reprendrait à Pro ce qui
    // fait la valeur du produit.
    tagline: {
      fr: "Les mêmes outils, sans aucune limite.",
      en: "The same tools, with no limits at all.",
    },
    monthly: 25,
    yearly: 200,
    features: [
      { fr: "Jarvis sans aucune limite", en: "Jarvis with no limit at all" },
      { fr: "Comptes de trading illimités", en: "Unlimited trading accounts" },
      { fr: "Détection automatique de patterns", en: "Automatic pattern detection" },
      { fr: "Alertes push et rappels de session", en: "Push alerts and session reminders" },
      { fr: "Support prioritaire", en: "Priority support" },
    ],
  },
];

export const TIER_BY_ID = Object.fromEntries(TIERS.map((p) => [p.id, p])) as Record<Tier, TierDef>;

/** Le palier d'un plan enregistré en base. */
export function tierOf(plan: Plan | string | null | undefined): Tier {
  if (typeof plan !== "string") return "free";
  const tier = plan.split("_")[0];
  return tier === "pro" || tier === "elite" ? tier : "free";
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
  // TOUT ce qui est un outil d'analyse est dans Pro. Un trader qui paie ne
  // doit jamais tomber sur un second mur : Monte-Carlo et la saisonnalité sont
  // précisément ce dont il a besoin, les garder plus haut n'aurait vendu ni
  // l'un ni l'autre.
  analytics: "pro",
  mistakes: "pro",
  goals: "pro",
  missed: "pro",
  news: "pro",
  jarvis: "pro",
  reports: "pro",
  montecarlo: "pro",
  seasonality: "pro",
  // Elite n'ouvre aucune page : elle enlève les limites.
  patterns: "elite",
  automation: "elite",
  pushAlerts: "elite",
  prioritySupport: "elite",
};

/**
 * Les limites d'usage par palier.
 *
 * Ce sont elles qui rendent l'offre gratuite RÉELLEMENT gratuite sans la rendre
 * suffisante : on peut tenir un journal sérieux, mais pas piloter plusieurs
 * comptes ni encoder une activité complète. `Infinity` veut dire « aucune
 * limite », et se teste comme tel — pas un 999 magique qu'on finirait par
 * atteindre.
 */
export interface TierLimits {
  /** Comptes de trading, sous-comptes compris. */
  accounts: number;
  /** Trades encodables par mois calendaire. */
  tradesPerMonth: number;
  /** Requêtes Jarvis par jour. */
  jarvisPerDay: number;
}

export const LIMITS: Record<Tier, TierLimits> = {
  free: { accounts: 1, tradesPerMonth: 10, jarvisPerDay: 3 },
  pro: { accounts: 3, tradesPerMonth: Infinity, jarvisPerDay: 20 },
  elite: { accounts: Infinity, tradesPerMonth: Infinity, jarvisPerDay: Infinity },
};

/** Nombre de comptes de trading autorisés (Infinity au palier Elite). */
export const ACCOUNT_LIMIT: Record<Tier, number> = {
  free: LIMITS.free.accounts,
  pro: LIMITS.pro.accounts,
  elite: LIMITS.elite.accounts,
};

export function tierAtLeast(current: Tier, required: Tier): boolean {
  return TIER_RANK[current] >= TIER_RANK[required];
}
