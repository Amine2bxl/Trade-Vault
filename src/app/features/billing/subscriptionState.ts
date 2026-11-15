/**
 * L'ÉTAT D'UN ABONNEMENT, ET CE QUE LA PAGE DOIT EN FAIRE — logique pure.
 *
 * La page Abonnement répondait à « où en est cet abonnement ? » à l'intérieur
 * de son JSX, et le bloc d'achat y répondait une seconde fois avec ses propres
 * conditions (`isPro`, `status`, `plan`). Deux réponses à la même question
 * finissent par diverger : un abonnement annulé s'est déjà lu « actif » ici.
 *
 * Tout est maintenant décidé ICI, une fois, sans React : l'état nommé, ce que
 * la page propose d'acheter, et le message à montrer quand un paiement ne
 * démarre pas. Les tests (`subscriptionState.test.ts`) le fixent.
 */
import { LIFETIME_PLAN, MONTHLY_PLAN, tierOf } from "@/domain/plans";
import type { Subscription } from "@/app/hooks/useSubscription";
import type { TKey } from "@/app/i18n/translations";

/** Les états nommés d'un abonnement. Rien d'autre ne décide de l'apparence. */
export type EtatId =
  | "free"
  | "trialing"
  | "active"
  | "cancelling"
  | "pastDue"
  | "expired"
  | "lifetime";

/**
 * L'ÉTAT, CALCULÉ UNE FOIS.
 *
 * L'ordre des tests compte : `cancelAtPeriodEnd` est éprouvé AVANT `active`,
 * parce qu'un abonnement annulé est bien encore actif — c'est précisément ce
 * qui le rendait invisible. Une licence se reconnaît à son PLAN, pas à
 * l'absence d'échéance : un accès offert sans date n'est pas une licence.
 */
export function etatAbonnement(sub: Subscription | null): EtatId {
  if (!sub || tierOf(sub.plan) === "free") return "free";
  if (sub.plan === LIFETIME_PLAN && sub.status === "active") return "lifetime";
  if (sub.status === "past_due") return "pastDue";
  if (sub.cancelAtPeriodEnd && (sub.status === "active" || sub.status === "trialing"))
    return "cancelling";
  if (sub.status === "trialing") return "trialing";
  if (sub.status === "active") return sub.currentPeriodEnd ? "active" : "lifetime";
  return "expired";
}

/**
 * CE QUE LA PAGE PROPOSE D'ACHETER.
 *
 *  • `choose`  — gratuit, essai, abonnement terminé : les deux offres.
 *  • `upgrade` — mensuel en cours : la licence reste ouverte (le webhook coupe
 *                alors le renouvellement du mensuel), le mensuel est marqué.
 *  • `none`    — licence possédée : il n'y a plus rien à vendre.
 */
export type OfferMode = "choose" | "upgrade" | "none";

export function offerMode(sub: Subscription | null, etat: EtatId): OfferMode {
  if (etat === "lifetime") return "none";
  if (
    sub?.plan === MONTHLY_PLAN &&
    (etat === "active" || etat === "cancelling" || etat === "pastDue")
  ) {
    return "upgrade";
  }
  // Un ancien plan payant encore actif (Pro, accès offert daté…) : la licence
  // reste achetable, comme pour un mensuel.
  if (etat === "active" || etat === "cancelling" || etat === "trialing") {
    return sub && tierOf(sub.plan) !== "free" ? "upgrade" : "choose";
  }
  return "choose";
}

/**
 * LE MESSAGE D'UN PAIEMENT QUI NE DÉMARRE PAS.
 *
 * Le serveur répond par des codes courts (`already lifetime`, `price not
 * configured`…). Ils s'affichaient TELS QUELS sous la grille : un trader
 * lisait « price not configured » en anglais technique. Chaque code connu a
 * sa phrase traduite ; un code inconnu tombe sur la phrase générique, jamais
 * sur le texte brut.
 */
const ERREURS: Record<string, TKey> = {
  "already lifetime": "billing.err.alreadyLifetime",
  "already subscribed": "billing.err.alreadySubscribed",
  "price not configured": "billing.err.unavailable",
  "checkout failed": "billing.err.unavailable",
  "invalid promo code": "billing.err.invalidPromo",
  "promo unavailable": "billing.err.unavailable",
  "not signed in": "billing.err.signedOut",
  unauthorized: "billing.err.signedOut",
  "no stripe customer": "billing.err.noCustomer",
};

export function checkoutErrorKey(error: string): TKey {
  return ERREURS[error.trim().toLowerCase()] ?? "billing.err.generic";
}
