import type { Page } from "../types";
import { pathForPage } from "./pageUrl";
import { decodeFilter, encodeFilter, type UnifiedFilter } from "./tradeFilter";

/**
 * Deep-links TradeVault — le pont entre « un insight » et « la page filtrée ».
 *
 * Le filtre unifié (`tradeFilter`) est sérialisé dans un query param `?f=…`,
 * compatible avec le routing existant `/journal`, `/analytics`… (`pageUrl.ts`).
 * Aucun nouveau routing : on réutilise `pathForPage` + `URLSearchParams`.
 */

/** La partie `f=…` prête à être concaténée après le chemin. */
export function filterParam(filter: UnifiedFilter): string {
  const f = encodeFilter(filter);
  return f ? `f=${encodeURIComponent(f)}` : "";
}

/** Lit et décode le filtre depuis un `location.search` (tolérant). */
export function readFilterParam(search: string): UnifiedFilter {
  try {
    return decodeFilter(new URLSearchParams(search).get("f"));
  } catch {
    return {};
  }
}

/**
 * Deep-link d'un insight vers une page, filtrée sur les trades concernés.
 * Exemple : `insightDeepLink(["#182", "#185"], "journal")` → `/journal?f=trades%3D…`.
 */
export function insightDeepLink(affectedTrades: string[], page: Page): string {
  const f = affectedTrades.length ? filterParam({ trades: affectedTrades }) : "";
  return f ? `${pathForPage(page)}?${f}` : pathForPage(page);
}
