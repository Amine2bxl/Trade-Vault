import { formatMoney as formatCurrencyMoney } from "@/shared/currency";

/**
 * Un montant de la page, en forme courte et dans la devise du trader. Arrondi
 * à l'unité : un drawdown médian de 509.175 ne s'écrit pas avec trois
 * décimales.
 */
export function formatMoney(v: number): string {
  return formatCurrencyMoney(v, { compact: true });
}

/**
 * Le montant à l'unité (sans « k ») — pour un mur ou une lecture au survol.
 * La forme courte arrondit 27 500 à « 28k » : sur l'objectif lui-même, c'est
 * une erreur de 500.
 */
export function formatMoneyExact(v: number): string {
  return formatCurrencyMoney(v, { whole: true });
}
