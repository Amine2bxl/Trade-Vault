import { createFileRoute, ClientOnly, redirect, notFound } from "@tanstack/react-router";
import App from "@/app/App";
import Landing from "@/app/pages/Landing";
import { pageSeo } from "../shared/seo";
import { isPage } from "@/app/types";
import { resolveLocation, pathForPage } from "@/app/utils/pageUrl";

/**
 * Route unique des écrans authentifiés : `/journal`, `/settings`, `/analytics`…
 *
 * POURQUOI UNE SEULE ROUTE PARAMÉTRÉE plutôt que 18 fichiers. Toutes ces pages
 * partagent le MÊME shell (barre latérale, navigation mobile, Jarvis, modales,
 * garde d'onboarding, contextes). Dix-huit fichiers de route auraient dupliqué
 * ce montage dix-huit fois, ou exigé un layout partagé — pour un gain nul,
 * puisque le rendu diffère uniquement par le composant de contenu.
 *
 * La liste des pages valides vient de `PAGES` (`app/types.ts`), l'unique source
 * du produit : ajouter une page ne demande donc pas de toucher au routage.
 *
 * NOINDEX. Ces écrans sont derrière authentification ; un crawler n'y verra
 * jamais que le squelette. Les indexer diluerait le référencement sur des URL
 * vides. Seules les routes publiques (landing, contact, mentions) sont
 * indexables.
 */

export const Route = createFileRoute("/$page")({
  // La validation se fait AVANT le rendu : une URL inconnue rend un 404 franc
  // au lieu d'un écran vide, et une ancienne URL `?p=` est réécrite ici même,
  // côté serveur, donc sans clignotement pour l'utilisateur.
  beforeLoad: ({ params, location }) => {
    const { page, redirectTo } = resolveLocation(`/${params.page}`, location.searchStr ?? "");
    if (redirectTo) throw redirect({ to: redirectTo, replace: true });
    if (!page) throw notFound();
  },
  head: ({ params }) => {
    // Le garde est appliqué INLINE : stocker son résultat dans un booléen
    // ferait perdre le rétrécissement de type à TypeScript sur la ligne
    // suivante, et `pathForPage` n'accepte qu'une page réelle.
    const path = isPage(params.page) ? pathForPage(params.page) : "/";
    return pageSeo({
      title: "TradeVault",
      description: "Journal de trading et coach IA.",
      path,
      index: false,
    });
  },
  component: AppPage,
});

function AppPage() {
  // Même contrat que la route racine : le shell authentifié ne monte que côté
  // client, une fois l'auth résolue. Le repli SSR reste la landing publique —
  // un visiteur non connecté qui ouvre `/journal` voit la page de vente, pas
  // un écran blanc.
  return (
    <ClientOnly fallback={<Landing />}>
      <App />
    </ClientOnly>
  );
}
