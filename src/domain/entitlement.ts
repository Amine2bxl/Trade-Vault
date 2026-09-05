/**
 * L'ACCÈS PAYANT — définition unique, partagée par le serveur et l'application.
 *
 * POURQUOI CE MODULE EXISTE. La question « cette personne a-t-elle accès ? »
 * était répondue à trois endroits qui ne disaient pas la même chose :
 * `backend/require-pro.ts` (`isEntitled`), `app/hooks/useSubscription.ts`
 * (`isPro`) et, implicitement, le balayage d'expiration des e-mails de cycle
 * de vie. Aucun des trois ne regardait `current_period_end` : un abonnement
 * crypto d'un mois, ou un accès offert avec une date de fin, restait
 * `status = 'active'` pour toujours et ouvrait donc l'accès pour toujours.
 *
 * Ce module est PUR (pas de React, pas de `process.env`, pas d'IO) pour
 * pouvoir être importé des deux côtés de la frontière, exactement comme
 * `domain/plans.ts`.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 * L'accès est ouvert quand le statut l'autorise ET que la période payée n'est
 * pas écoulée. « Écoulée » dépend de la SOURCE, parce que les trois sources ne
 * se comportent pas pareil :
 *
 *  • `crypto` — il n'existe aucune facturation récurrente. Une charge achète
 *    une période fixe, point. Passé `current_period_end`, l'accès s'arrête
 *    SANS DÉLAI : c'est toute la raison d'être de la date.
 *  • `comp` — l'accès offert porte la date de fin décidée par l'administrateur
 *    (`comp_grants.expires_at`). Même traitement : un cadeau à durée
 *    déterminée qui ne s'arrête jamais n'est pas un cadeau à durée déterminée.
 *  • `promo` — l'accès influenceur est permanent par construction
 *    (`current_period_end = null`). Une date présente est néanmoins respectée.
 *  • `stripe` — Stripe EST la source de vérité et repousse la date à chaque
 *    renouvellement via `customer.subscription.updated`. Un webhook perdu ou
 *    retardé ferait donc tomber un client qui paie. On accorde un DÉLAI DE
 *    GRÂCE : Stripe nous enverra `past_due` puis `canceled`, et ces statuts,
 *    eux, coupent l'accès immédiatement. Le délai ne protège donc jamais un
 *    impayé — seulement une livraison de webhook en retard.
 *
 * Cette asymétrie est délibérée et c'est le cœur du module : sans elle, soit
 * on laisse fuir l'accès crypto, soit on coupe des clients Stripe en règle.
 */

import { tierOf, type Tier } from "./plans";

/** Statuts que porte `subscriptions.status`. */
export type SubStatus = "trialing" | "active" | "past_due" | "canceled" | "expired";

/** Origines que porte `subscriptions.source`. */
export type SubSource = "signup" | "trial" | "stripe" | "crypto" | "comp" | "promo";

/**
 * La forme minimale dont dépend la décision. Volontairement structurelle
 * (`string | null` plutôt que les unions ci-dessus) : la ligne arrive de
 * Postgres ou d'un webhook, donc d'un monde non typé, et un statut inconnu
 * doit refuser l'accès au lieu de faire planter la comparaison.
 */
export interface EntitlementRow {
  plan?: string | null;
  status?: string | null;
  source?: string | null;
  trial_ends_at?: string | Date | null;
  current_period_end?: string | Date | null;
}

/**
 * Délai de grâce sur un abonnement Stripe dont la date de période est passée.
 *
 * Trois jours : plus long que toute rafale de nouvelles tentatives de Stripe
 * (qui abandonne après ~3 jours) et assez court pour qu'un abonnement
 * réellement mort ne traîne pas. Il ne s'applique QU'À `stripe` — voir l'en-tête.
 */
export const STRIPE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

function toMs(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Le délai de grâce accordé à une source donnée, en millisecondes. */
function graceFor(source: string | null | undefined): number {
  return source === "stripe" ? STRIPE_GRACE_MS : 0;
}

/**
 * La période payée est-elle écoulée ?
 *
 * `null` (aucune date) signifie « pas de fin connue » et n'expire donc jamais :
 * c'est le cas d'un accès promo permanent et d'un abonnement Stripe dont on
 * n'a pas encore reçu la première date de période.
 */
export function periodExpired(row: EntitlementRow, now: number = Date.now()): boolean {
  const end = toMs(row.current_period_end);
  if (end === null) return false;
  return now > end + graceFor(row.source);
}

/**
 * L'accès payant est-il ouvert MAINTENANT ?
 *
 * Le prédicat unique du produit. Déterministe, sans effet de bord, avec une
 * horloge injectable — donc testable sans base ni faux temps global.
 */
export function isEntitled(
  row: EntitlementRow | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!row) return false;

  if (row.status === "trialing") {
    // Un essai ne dépend que de sa propre date de fin : `current_period_end`
    // n'est pas encore renseigné pendant un essai.
    const trialEnd = toMs(row.trial_ends_at);
    return trialEnd !== null && trialEnd > now;
  }

  if (row.status !== "active") return false;

  return !periodExpired(row, now);
}

/**
 * Le palier RÉELLEMENT accessible.
 *
 * La ligne garde le nom du plan acheté même une fois l'accès terminé — c'est
 * ce qui permet de proposer la reprise du bon abonnement. Le palier effectif,
 * lui, retombe à `free` dès que l'accès n'est plus valide.
 */
export function effectiveTier(
  row: EntitlementRow | null | undefined,
  now: number = Date.now(),
): Tier {
  return isEntitled(row, now) ? tierOf(row?.plan) : "free";
}

/**
 * Cette ligne doit-elle être BASCULÉE en base ?
 *
 * `isEntitled` suffit à fermer l'accès en lecture, mais laisser une ligne
 * mentir (`active` alors que la période est finie) rend la base illisible pour
 * tout le reste : relances commerciales, statistiques, support. Le balayage
 * quotidien utilise ce prédicat pour ne réécrire que ce qui doit l'être.
 *
 * On NE bascule PAS un abonnement Stripe : c'est Stripe qui décide de son
 * cycle de vie et son webhook écrira le bon statut. Réécrire ici créerait une
 * seconde autorité sur la même donnée — et un état qui oscille entre les deux.
 */
export function needsExpiry(
  row: EntitlementRow | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!row) return false;
  if (row.status !== "active") return false;
  if (row.source === "stripe") return false;
  return periodExpired(row, now);
}
