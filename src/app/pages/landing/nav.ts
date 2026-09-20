import type { LandingKey } from "./i18n";

/**
 * LES ENTRÉES DE NAVIGATION — une seule liste, pour de bon.
 *
 * Il y en avait DEUX : `LINKS` dans `MegaNav.tsx`, qui dessinait la barre, et
 * `NAV` dans `Landing.tsx`, qui pilotait le scrollspy. Elles ont divergé à la
 * première restructuration : la barre proposait encore « Features » vers une
 * ancre supprimée, pendant que le scrollspy suivait une liste à jour. Le
 * visiteur qui cliquait atterrissait en bas de page, sans explication.
 *
 * Une entrée = un libellé + une ancre. Les deux surfaces lisent ce tableau, et
 * le test de `seo.test.ts` vérifie que chaque ancre de pied de page désigne une
 * `<section id>` réelle — ce qui ferme la boucle.
 */
export interface LienNav {
  key: LandingKey;
  /** L'`id` de la `<section>` visée. Pas de `#`, il est ajouté à l'usage. */
  id: string;
}

export const LIENS_NAV: readonly LienNav[] = [
  { key: "nav.problem", id: "problem" },
  { key: "nav.product", id: "product" },
  { key: "nav.edge", id: "edge" },
  { key: "pricing.tag", id: "pricing" },
  { key: "faq.tag", id: "faq" },
];
