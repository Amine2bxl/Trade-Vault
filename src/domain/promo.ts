/**
 * Codes promo gérés par l'application — la lecture et la décision, pures.
 *
 * Ce module ne touche ni à la base ni à Stripe : il décide, à partir de la
 * ligne d'un code et de l'adresse de l'appelant, ce que le checkout doit
 * faire. La partie requête/écriture vit dans `backend/promo.server.ts`.
 *
 * Trois issues possibles pour un code valide :
 *   • « owner »     — l'adresse du titulaire : accès PERMANENT, sans paiement.
 *   • « free »      — code sans titulaire ni réduction (invite) : accès
 *                     permanent pour le premier venu, dans la limite d'usages.
 *   • « discount »  — tout le monde sauf le titulaire : -N% au checkout Stripe.
 */

import type { PaidPlan } from "./plans";

export interface PromoCodeRow {
  code: string;
  plan: PaidPlan;
  ownerEmail: string | null;
  discountPercent: number | null;
  active: boolean;
  expiresAt: string | null;
  maxUses: number | null;
  usesCount: number;
  note: string | null;
  grantedBy: string | null;
  createdAt: string;
}

/** « Trades2026 » → « TRADES2026 ». `null` si rien d'utilisable. */
export function normalizePromoCode(input: string | null | undefined): string | null {
  if (!input) return null;
  const norm = input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "");
  return norm || null;
}

/** Un code est-il encore utilisable ? (avec une horloge injectable pour les tests) */
export function promoCodeIsUsable(
  pc: Pick<PromoCodeRow, "active" | "expiresAt" | "maxUses" | "usesCount">,
  now = Date.now(),
): boolean {
  if (!pc.active) return false;
  if (pc.expiresAt && new Date(pc.expiresAt).getTime() <= now) return false;
  if (pc.maxUses != null && pc.usesCount >= pc.maxUses) return false;
  return true;
}

export type PromoDecision =
  | { status: "owner"; plan: PaidPlan }
  | { status: "free"; plan: PaidPlan }
  | { status: "discount"; percent: number }
  | { status: "owner_mismatch" }
  | { status: "invalid" };

export function decidePromoCode(
  pc: PromoCodeRow,
  userEmail: string,
  now = Date.now(),
): PromoDecision {
  if (!promoCodeIsUsable(pc, now)) return { status: "invalid" };

  const isOwner = pc.ownerEmail != null && pc.ownerEmail.toLowerCase() === userEmail.toLowerCase();
  if (isOwner) return { status: "owner", plan: pc.plan };

  // Titulaire + réduction : le titulaire rentre par « owner », sa communauté
  // par « discount » — un seul code, deux parcours, c'est le partenariat type.
  if (pc.discountPercent != null) return { status: "discount", percent: pc.discountPercent };

  // Code sans titulaire : il ouvre l'accès permanent à n'importe qui.
  if (pc.ownerEmail == null) return { status: "free", plan: pc.plan };

  // Code réservé à son titulaire, présenté à quelqu'un d'autre.
  return { status: "owner_mismatch" };
}

/** Le libellé d'erreur à exposer, selon le refus. */
export function promoRejectionMessage(status: "invalid" | "owner_mismatch", fr: boolean): string {
  if (status === "owner_mismatch") {
    return fr
      ? "Ce code est personnel — il n'ouvre l'accès qu'à son titulaire."
      : "This code is personal — it only unlocks access for its owner.";
  }
  return fr
    ? "Code invalide, expiré ou déjà utilisé au maximum."
    : "Invalid, expired, or fully redeemed code.";
}
