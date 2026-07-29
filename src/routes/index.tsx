import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import App from "@/app/App";
import { pageSeo } from "../shared/seo";

const SEO_TITLE = "TradeVault — The Data-Driven Trading Journal";
const SEO_DESCRIPTION =
  "Log every trade, get quant-grade analytics (Sharpe, Sortino, expectancy), AI coaching, an economic calendar and a pre-market discipline checklist. Free during early access.";

export const Route = createFileRoute("/")({
  // Routed through the shared SEO builder so the home page gets a single,
  // self-referential canonical, an absolute og:image and og:url — the same
  // contract as every other public route, domain-independent via SITE_URL.
  head: () => pageSeo({ title: SEO_TITLE, description: SEO_DESCRIPTION, path: "/" }),
  component: Index,
});

function Index() {
  return (
    <ClientOnly fallback={<div className="min-h-screen" />}>
      <App />
    </ClientOnly>
  );
}
