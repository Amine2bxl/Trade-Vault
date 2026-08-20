import { useCallback, useEffect, useMemo, useState } from "react";
import type { Trade } from "../types";
import { applyFilter, encodeFilter, type UnifiedFilter } from "../utils/tradeFilter";
import { readFilterParam } from "../utils/deepLink";

/**
 * Filtre de trades partagé — la SEULE source de filtrage d'une page.
 *
 * Journal, Analytics, Missed, Monte Carlo et Weekly Review passent par ici.
 * Le filtre est sérialisé dans le query param `?f=…` (deep-links), lu au
 * montage et ré-écrit à chaque `setFilter` (replaceState, pas pushState, pour
 * ne pas polluer l'historique à chaque clic de filtre).
 *
 * Le composant qui le consomme applique ensuite ses propres filtres locaux
 * (tri, recherche) PAR-DESSUS `filtered` — jamais en recréant la logique de
 * filtrage de base.
 */
export function useTradeFilter(trades: Trade[]) {
  const [filter, setFilterState] = useState<UnifiedFilter>(() =>
    typeof window === "undefined" ? {} : readFilterParam(window.location.search),
  );

  const filtered = useMemo(() => applyFilter(trades, filter), [trades, filter]);

  const setFilter = useCallback((next: UnifiedFilter) => {
    setFilterState(next);
    if (typeof window === "undefined") return;
    // URL reste la source de vérité : on synchronise `?f=` sans ajouter
    // d'entrée d'historique (un filtre n'est pas une navigation).
    const url = new URL(window.location.href);
    const f = encodeFilter(next);
    if (f) url.searchParams.set("f", f);
    else url.searchParams.delete("f");
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
  }, []);

  // Retour/avant du navigateur, et navigation programmée (deep-link) :
  // re-lire le filtre de l'URL — elle reste la source de vérité.
  useEffect(() => {
    const sync = () => setFilterState(readFilterParam(window.location.search));
    window.addEventListener("popstate", sync);
    window.addEventListener("tv:filter", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("tv:filter", sync);
    };
  }, []);

  return { filter, filtered, setFilter };
}
