/**
 * Pricing — one source of truth for the offer.
 *
 * The monthly price is the reference; the annual bill and every derived figure
 * (monthly equivalent, full-price anchor, saving) are computed from it. Nothing
 * in the UI hardcodes a price string, so changing the offer is a one-line edit
 * that cannot leave a stale number on a card, a page or a receipt.
 *
 * Mirrors `backend/crypto-pay.server.ts`, which charges these same amounts.
 */

export const MONTHLY_EUR = 19.99;
/** Two months free versus paying monthly. */
export const YEARLY_EUR = 199;

/** What twelve monthly bills cost — the honest anchor next to the annual price. */
export const YEARLY_FULL_PRICE = MONTHLY_EUR * 12;
export const YEARLY_PER_MONTH = YEARLY_EUR / 12;
export const YEARLY_SAVING = Math.round(YEARLY_FULL_PRICE - YEARLY_EUR);

/** Euro amounts, French formatting: no decimals when the amount is round. */
export function eur(n: number): string {
  return `${n.toLocaleString("fr-FR", {
    minimumFractionDigits: n % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })} €`;
}

export type PaidPlan = "pro_monthly" | "pro_yearly";

/** The billed amount for a plan, as shown everywhere. */
export function planPrice(plan: PaidPlan): number {
  return plan === "pro_yearly" ? YEARLY_EUR : MONTHLY_EUR;
}
