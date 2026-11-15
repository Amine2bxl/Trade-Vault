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
export type PaidPlan = "pro_monthly" | "pro_yearly" | "elite_monthly" | "elite_yearly" | "lifetime";

/**
 * DEUX FAÇONS DE PAYER LE MÊME PRODUIT — novembre 2026.
 *
 * La licence seule (20 €) laissait deux traders sans réponse : celui qui veut
 * essayer un mois avant de s'engager, et celui qui préfère une petite somme
 * récurrente. On vend donc DEUX plans, qui ouvrent exactement la même chose
 * (le palier `elite`, tout TradeVault) :
 *
 *   • `elite_monthly` — `MONTHLY_EUR` par mois, sans engagement, résiliable
 *     en un clic depuis le portail Stripe ;
 *   • `lifetime`      — `LIFETIME_EUR` payés une fois, à vie.
 *
 * Le rapport entre les deux est voulu : la licence coûte moins de six
 * mensualités (`lifetimeBreakEvenMonths`). Un trader qui reste plus d'un
 * semestre a intérêt à la licence, et la grille le lui dit en chiffres plutôt
 * qu'en adjectifs. Les plans `pro_*` / `elite_yearly` restent reconnus : ce
 * sont ceux des abonnés d'avant, convertis en licence.
 *
 * `elite_monthly` est un identifiant DÉJÀ autorisé en base (contraintes
 * `subscriptions_plan_check`, `effective_tier` → `elite`) : relancer le
 * mensuel ne demande aucune migration.
 */
export const LIFETIME_PLAN = "lifetime" as const;
export const LIFETIME_EUR = 49;

/** L'abonnement mensuel — le même accès complet, sans engagement. */
export const MONTHLY_PLAN = "elite_monthly" as const;
export const MONTHLY_EUR = 9;

/** Les plans réellement en vente, dans l'ordre de la grille. */
export const SALE_PLANS = [MONTHLY_PLAN, LIFETIME_PLAN] as const;
export type SalePlan = (typeof SALE_PLANS)[number];

export function isSalePlan(value: unknown): value is SalePlan {
  return (SALE_PLANS as readonly unknown[]).includes(value);
}

/**
 * Le plan vendu pour une demande de paiement.
 *
 * Un client resté sur une ancienne grille (onglet ouvert, cache) peut encore
 * demander `pro_monthly` ou `elite_yearly`. Il n'est jamais conduit vers un
 * tarif retiré : une demande mensuelle mène au mensuel, toute autre à la
 * licence.
 */
export function salePlanFor(plan: PaidPlan): SalePlan {
  if (isSalePlan(plan)) return plan;
  return intervalOf(plan) === "monthly" ? MONTHLY_PLAN : LIFETIME_PLAN;
}

/** Le nombre de mensualités au-delà duquel la licence revient moins cher —
 *  l'argument honnête de la licence, calculé, jamais écrit à la main. */
export function lifetimeBreakEvenMonths(): number {
  return Math.ceil(LIFETIME_EUR / MONTHLY_EUR);
}

/** Les mots de la licence, dans les deux langues — partagés par la vitrine,
 *  la page Abonnement et la fenêtre d'achat. Aucune promesse de gain : on
 *  décrit ce qu'on achète et comment on le paie. */
export const LIFETIME_COPY = {
  badge: { fr: "Paiement unique", en: "One-time payment" },
  title: { fr: "Licence à vie", en: "Lifetime license" },
  priceNote: { fr: "une fois · à vie", en: "once · for life" },
  cta: { fr: "Acheter la licence", en: "Get the license" },
  trust: {
    fr: "Aucun abonnement · Paiement sécurisé par Stripe · Accès immédiat",
    en: "No subscription · Secure payment by Stripe · Instant access",
  },
  owned: { fr: "TradeVault t'appartient, à vie.", en: "TradeVault is yours, for life." },
  free: { fr: "Commencer gratuitement", en: "Start for free" },
  current: { fr: "Ton offre", en: "Your plan" },
} as const;

/** Les mots du mensuel. Même règle : ce qu'on paie, quand, et comment on
 *  s'en va. */
export const MONTHLY_COPY = {
  badge: { fr: "Sans engagement", en: "No commitment" },
  title: { fr: "Mensuel", en: "Monthly" },
  priceNote: { fr: "par mois", en: "per month" },
  cta: { fr: "Choisir le mensuel", en: "Go monthly" },
  trust: {
    fr: "Paiement sécurisé par Stripe · Accès immédiat",
    en: "Secure payment by Stripe · Instant access",
  },
  owned: {
    fr: "Ton abonnement mensuel est actif.",
    en: "Your monthly plan is active.",
  },
  manage: { fr: "Gérer l'abonnement", en: "Manage subscription" },
  note: { fr: "Résiliable à tout moment, en un clic.", en: "Cancel anytime, in one click." },
} as const;

/**
 * CE QUE L'ACCÈS COMPLET CHANGE, EN SIX LIGNES CONCRÈTES.
 *
 * La grille listait dix fonctionnalités par leur nom (« Monte-Carlo »,
 * « Saisonnalité »…) : un nom ne dit pas ce qu'on y gagne. Ces six lignes
 * disent le RÉSULTAT, chacune adossée à une page PAYANTE qui existe (Erreurs,
 * Saisonnalité, Jarvis, Monte-Carlo, Rapports) — Analyses est gratuit. Partagées par la page Abonnement,
 * `/pricing` et la modale d'achat. Aucune promesse de gain.
 */
export const FULL_ACCESS_POINTS: readonly Bi[] = [
  { fr: "Trades et comptes illimités", en: "Unlimited trades and accounts" },
  { fr: "Chaque erreur récurrente chiffrée en €", en: "Every recurring mistake priced in €" },
  {
    fr: "Tes heures rentables, et celles à ne plus trader",
    en: "Your profitable hours, and the ones to stop trading",
  },
  {
    fr: "Jarvis lit tes trades et te donne un plan",
    en: "Jarvis reads your trades, hands you a plan",
  },
  { fr: "Ta probabilité de ruine sur 10 000 scénarios", en: "Your risk of ruin over 10,000 runs" },
  { fr: "Ton rapport mensuel, écrit pour toi", en: "Your monthly report, written for you" },
];

/** La phrase qui relie les deux prix — dérivée des montants. */
export function breakEvenCopy(lang: "fr" | "en"): string {
  const n = lifetimeBreakEvenMonths();
  return lang === "fr"
    ? `La licence coûte moins de ${n} mois d'abonnement.`
    : `The license costs less than ${n} months of the monthly plan.`;
}
/** La même idée, en quelques mots — pour une ligne d'option du sélecteur. */
export function breakEvenShort(lang: "fr" | "en"): string {
  const n = lifetimeBreakEvenMonths();
  return lang === "fr" ? `Moins de ${n} mois de mensuel` : `Less than ${n} months of monthly`;
}
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

/**
 * Une ligne de la liste d'une offre.
 *
 * `metered` marque les lignes qui ne font QUE donner un chiffre déjà porté par
 * `LIMITS` (trades par mois, Jarvis par jour, comptes). La grille tarifaire
 * affiche ces trois chiffres dans un bandeau comparatif au bas de chaque
 * colonne : les répéter en puce au-dessus ferait lire deux fois la même
 * information, dans deux formes différentes. Les autres surfaces (matrice
 * complète, modale d'upgrade) continuent de tout afficher — c'est justement
 * leur rôle.
 */
export interface Feature extends Bi {
  metered?: boolean;
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
  features: Feature[];
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
      // Le chiffre part au bandeau ; la puce garde ce que le bandeau ne dit
      // pas — qu'une capture d'écran accompagne chaque trade, gratuitement.
      {
        fr: "Une capture d'écran sur chaque trade",
        en: "A screenshot on every trade",
      },
      { fr: "10 trades par mois", en: "10 trades a month", metered: true },
      { fr: "Tableau de bord et calendrier", en: "Dashboard and calendar" },
      // Ouvert le 2026-11-15 : voir CE QUE l'on fait est gratuit ; savoir
      // POURQUOI on perd (erreurs, Jarvis, projections) reste payant.
      { fr: "Analyses : setups, heures, jours", en: "Analytics: setups, hours, days" },
      { fr: "Checklist, plan, calculateur", en: "Checklist, plan, calculator" },
      { fr: "Jarvis 3 fois par jour", en: "Jarvis 3 times a day", metered: true },
      { fr: "1 compte de trading", en: "1 trading account", metered: true },
    ],
  },
  {
    id: "elite",
    name: { fr: "Accès complet", en: "Full access" },
    tagline: {
      fr: "Tout TradeVault — au mois, ou une fois pour toutes.",
      en: "All of TradeVault — monthly, or once and for all.",
    },
    monthly: MONTHLY_EUR,
    // Plan annuel HÉRITÉ (`elite_yearly`), plus vendu : dix mensualités, la
    // règle « deux mois offerts » de l'ancienne grille. Il ne sert qu'à
    // décrire une ligne ancienne ; la licence (`LIFETIME_EUR`) le remplace.
    yearly: MONTHLY_EUR * 10,
    featured: true,
    features: [
      { fr: "Trades illimités", en: "Unlimited trades", metered: true },
      { fr: "Comptes de trading illimités", en: "Unlimited trading accounts", metered: true },
      { fr: "Erreurs, setups manqués, saisonnalité", en: "Mistakes, missed setups, seasonality" },
      { fr: "Monte-Carlo : ta probabilité de ruine", en: "Monte Carlo: your risk of ruin" },
      { fr: "Rapports mensuels automatiques", en: "Automatic monthly reports" },
      { fr: "Jarvis inclus", en: "Jarvis included", metered: true },
      { fr: "Synchro Tradovate, en lecture seule", en: "Tradovate sync, read-only" },
      {
        fr: "Transfert et recalibrage entre comptes",
        en: "Transfer and rescale trades between accounts",
      },
      { fr: "Alertes push et rappels de session", en: "Push alerts and session reminders" },
    ],
  },
];

/** Le palier Pro n'est plus vendu ; il reste décrit pour les lignes des
 *  anciens abonnés qui le portent encore. */
const LEGACY_TIERS: TierDef[] = [
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
      { fr: "Trades illimités", en: "Unlimited trades", metered: true },
      { fr: "Tes erreurs chiffrées en euros", en: "Your mistakes priced in euros" },
      { fr: "Monte-Carlo : ta probabilité de ruine", en: "Monte Carlo: your risk of ruin" },
      { fr: "Saisonnalité : tes heures rentables", en: "Seasonality: your profitable hours" },
      { fr: "Jarvis 20 fois par jour", en: "Jarvis 20 times a day", metered: true },
      { fr: "Rapports mensuels automatiques", en: "Automatic monthly reports" },
      {
        fr: "Synchro Tradovate, en lecture seule",
        en: "Tradovate sync, read-only",
      },
      {
        fr: "Transfert et recalibrage entre comptes",
        en: "Transfer and rescale trades between accounts",
      },
      {
        fr: "Jusqu'à 3 comptes (2 sous-comptes)",
        en: "Up to 3 accounts (2 sub-accounts)",
        metered: true,
      },
    ],
  },
];

export const TIER_BY_ID = Object.fromEntries(
  [...TIERS, ...LEGACY_TIERS].map((p) => [p.id, p]),
) as Record<Tier, TierDef>;

/** Le palier d'un plan enregistré en base. */
export function tierOf(plan: Plan | string | null | undefined): Tier {
  if (typeof plan !== "string") return "free";
  if (plan === LIFETIME_PLAN) return "elite";
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
  if (value === LIFETIME_PLAN) return true;
  return (
    typeof value === "string" &&
    (PAID_TIERS as readonly string[]).includes(value.split("_")[0]) &&
    (value.endsWith("_monthly") || value.endsWith("_yearly"))
  );
}

/** Le montant facturé pour un plan, tel qu'affiché partout. */
export function planPrice(plan: PaidPlan): number {
  if (plan === LIFETIME_PLAN) return LIFETIME_EUR;
  if (plan === MONTHLY_PLAN) return MONTHLY_EUR;
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
  | "mistakes"
  | "goals"
  | "missed"
  | "news"
  | "jarvis"
  | "reports"
  | "montecarlo"
  | "seasonality"
  | "brokerSync"
  | "accountTransfer"
  | "recalibration"
  | "patterns"
  | "automation"
  | "pushAlerts"
  | "prioritySupport";

export const CAPABILITY_TIER: Record<Capability, Tier> = {
  // TOUT ce qui est un outil d'analyse est dans Pro. Un trader qui paie ne
  // doit jamais tomber sur un second mur : Monte-Carlo et la saisonnalité sont
  // précisément ce dont il a besoin, les garder plus haut n'aurait vendu ni
  // l'un ni l'autre.
  mistakes: "pro",
  goals: "pro",
  missed: "pro",
  news: "pro",
  jarvis: "pro",
  reports: "pro",
  montecarlo: "pro",
  seasonality: "pro",
  // Les outils de COMPTE d'un trader de prop firm : ses trades qui arrivent
  // seuls de Tradovate, et ses comptes qui se répondent (transfert, échelle).
  // Vérifiés aussi côté serveur : `requireProPlan` et `recalibrate_account`.
  brokerSync: "pro",
  accountTransfer: "pro",
  recalibration: "pro",
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
