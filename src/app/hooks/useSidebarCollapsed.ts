import { useCallback, useEffect, useState } from "react";

/**
 * L'état plié/déplié de la barre latérale, retenu d'une session à l'autre.
 *
 * POURQUOI `localStorage` ICI ALORS QU'IL EST REFUSÉ POUR LE CACHE DE TRADES.
 * La distinction est le contenu, pas le mécanisme : une préférence d'affichage
 * n'apprend rien à qui lirait le disque d'une machine partagée, alors que
 * l'historique de P&L d'un trader, oui (`MOTION_AND_PERF.md` §C3). Un booléen
 * de mise en page peut donc survivre à la déconnexion sans rien coûter.
 *
 * Lecture PARESSEUSE, dans l'initialiseur d'état : `localStorage` n'existe pas
 * pendant le rendu serveur, et lire dans un effet ferait apparaître la barre
 * dépliée pendant une frame avant de se replier.
 */

const KEY = "tv:sidebar-collapsed";

function readInitial(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    // Mode privé, quota, stockage désactivé : l'affichage ne doit jamais
    // dépendre de la réussite d'une écriture.
    return false;
  }
}

export function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(readInitial);

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, collapsed ? "1" : "0");
    } catch {
      /* ignoré — voir plus haut */
    }
  }, [collapsed]);

  const toggle = useCallback(() => setCollapsed((v) => !v), []);
  return [collapsed, toggle];
}
