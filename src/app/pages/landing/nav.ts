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
  /**
   * Une vraie route, quand l'entrée ne désigne pas une section de la page.
   * Présente, elle l'emporte sur `id` : on NAVIGUE au lieu de défiler.
   * `id` reste renseigné pour que le scrollspy garde un identifiant stable.
   */
  href?: string;
}

export const LIENS_NAV: readonly LienNav[] = [
  { key: "nav.problem", id: "problem" },
  { key: "nav.product", id: "product" },
  /* « Edge Score » est parti avec sa section. Elle ouvrait sur « un score
     qui ne regarde pas ton P&L » - une affirmation qui demande d'avoir déjà
     adhéré à la philosophie du produit pour ne pas sonner comme un reproche,
     et qui arrivait avant qu'on ait montré quoi que ce soit. Le score existe
     toujours dans le produit, et le tableau de bord du héros le montre. */
  /* « Ce que tu obtiens vraiment » est parti AVEC sa section : elle résumait
     en quatre puces ce que la visite venait de MONTRER en cinq écrans, donc
     elle répondait deux fois à la même objection. Cinq entrées au lieu de
     six - une barre se juge à ce qu'on peut en retirer. */
  /* Les tarifs ne sont plus une ancre mais une PAGE. Le lien mène donc
     ailleurs, pas plus bas - et c'est justement ce qu'on veut : la grille
     noyée en bas d'une page de vente ne se démarquait pas. `href` gagne
     sur `id` quand les deux sont là. */
  { key: "pricing.tag", id: "pricing", href: "/pricing" },
  { key: "faq.tag", id: "faq" },
];
