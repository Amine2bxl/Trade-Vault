import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import App from "@/app/App";
import { pageSeo } from "../shared/seo";
import Landing from "@/app/pages/Landing";

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
  head: () => pageSeo({ title: SEO_TITLE, description: SEO_DESCRIPTION, path: "/" }),
  component: Index,
});

function Index() {
  // Le HTML initial contient DIRECTEMENT la landing publique (SSR) : les
  // moteurs IA (ChatGPT, Claude, Gemini, Perplexity…) et les crawlers SEO
  // lisent le contenu sans exécuter JavaScript → meilleur GEO + LCP.
  // Le shell authentifié (App) ne monte que côté client, une fois l'auth résolue.
  return (
    <ClientOnly fallback={<Landing />}>
      <App />
    </ClientOnly>
  );
}
