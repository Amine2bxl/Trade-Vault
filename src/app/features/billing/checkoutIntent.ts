import { isSalePlan, type SalePlan } from "@/domain/plans";

/**
 * L'OFFRE CHOISIE AVANT D'AVOIR UN COMPTE — retenue jusqu'au paiement.
 *
 * Retour du propriétaire (2026-11-15) : « tous les CTA doivent rediriger vers
 * le Stripe choisi ». Sur la vitrine et `/pricing`, choisir le mensuel ou la
 * licence ouvrait l'inscription… et l'offre s'arrêtait là : une fois le
 * compte créé, le trader arrivait dans l'application sans jamais voir le
 * paiement de l'offre qu'il avait choisie.
 *
 * L'offre est donc retenue sur l'appareil au clic, puis `App` la consomme
 * dès qu'une session existe et part directement vers le paiement Stripe de
 * CETTE offre. Elle survit à la confirmation d'e-mail et au détour par Google
 * (même navigateur), et expire après 24 h : un clic oublié ne doit pas
 * déclencher un paiement des jours plus tard.
 */
const KEY = "tv.checkout.intent";
export const CHECKOUT_INTENT_TTL_MS = 24 * 60 * 60 * 1000;

function stockage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function rememberCheckoutIntent(plan: SalePlan, now: number = Date.now()): void {
  try {
    stockage()?.setItem(KEY, JSON.stringify({ plan, at: now }));
  } catch {
    /* stockage refusé : le trader choisira son offre dans l'application */
  }
}

/** Rend l'offre retenue (une seule fois) et l'efface. `null` si aucune,
 *  expirée ou illisible. */
export function takeCheckoutIntent(now: number = Date.now()): SalePlan | null {
  const s = stockage();
  if (!s) return null;
  let raw: string | null = null;
  try {
    raw = s.getItem(KEY);
    s.removeItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { plan?: unknown; at?: unknown };
    if (!isSalePlan(v.plan) || typeof v.at !== "number") return null;
    if (now - v.at > CHECKOUT_INTENT_TTL_MS || v.at > now + 60_000) return null;
    return v.plan;
  } catch {
    return null;
  }
}
