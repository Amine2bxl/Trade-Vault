import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import App from "@/app/App";
import { pageSeo } from "../shared/seo";
import Landing from "@/app/pages/Landing";

// The brand comes first and stands alone before the separator, so the browser
// tab, search results and Google's brand review all read "TradeVault" first.
// The suffix stays because a bare one-word title loses the SEO keywords, and it
// is what the page actually is.
const SEO_TITLE = "TradeVault — Journal de trading et coach IA pour traders";
// French: the landing page it describes is French, and a description in another
// language than the page is a mismatch both for search engines and for a
// reviewer comparing the site against the consent screen. ≤ 155 caractères.
const SEO_DESCRIPTION =
  "Journal de trading et coach IA : analyse tes performances, suis ton plan et gagne en discipline. Analytics, calendrier économique et checklist pré-market.";

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
