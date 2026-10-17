import { createFileRoute } from "@tanstack/react-router";
import { LANDING_ALTERNATES, pageSeo } from "../shared/seo";
import Landing from "@/app/public/landing/Landing";

// The brand comes first and stands alone before the separator, so the browser
// tab, search results and Google's brand review all read "TradeVault" first.
// The suffix stays because a bare one-word title loses the SEO keywords, and it
// is what the page actually is.
const SEO_TITLE = "TradeVault — AI Trading Journal & Performance Analytics";
// Naturel, au service d'une vraie question : que fait TradeVault pour le trader
// qui veut comprendre son historique ? Les mots-clés (trading journal, analysis,
// performance) viennent du contenu visible de la page, pas d'un bourrage.
// ≤ 155 caractères.
const SEO_DESCRIPTION =
  "TradeVault is the AI trading journal that turns your history into clear performance analytics — equity curve, drawdown, expectancy, recurring mistakes. Understand your own trading, not generic advice.";

export const Route = createFileRoute("/")({
  // Routed through the shared SEO builder so the home page gets a single,
  // self-referential canonical, an absolute og:image and og:url — the same
  // contract as every other public route, domain-independent via SITE_URL.
  //
  // `alternates` déclare la paire de langues. La vitrine française vit
  // maintenant à `/fr` (`routes/fr.tsx`) ; les deux pages doivent se citer
  // MUTUELLEMENT, sinon Google ignore la grappe `hreflang` en entier. Cette
  // ligne est la moitié anglaise de cette réciprocité.
  head: () =>
    pageSeo({
      title: SEO_TITLE,
      description: SEO_DESCRIPTION,
      path: "/",
      alternates: LANDING_ALTERNATES,
    }),
  component: Index,
});

function Index() {
  // Le HTML initial contient DIRECTEMENT la landing publique (SSR) : les
  // moteurs IA (ChatGPT, Claude, Gemini, Perplexity…) et les crawlers SEO
  // lisent le contenu sans exécuter JavaScript → meilleur GEO + LCP.
  //
  // L'application (`App`) n'est PLUS montée ici : la racine l'héberge une
  // seule fois pour `/` et `/$page` (voir `AppHost`, `routes/__root.tsx`),
  // sinon chaque passage par le tableau de bord la démontait. Cette vitrine
  // reste ce que voit le serveur, et l'application la reprend telle quelle
  // pour un visiteur non connecté.
  return <Landing />;
}
