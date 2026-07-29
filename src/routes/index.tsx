import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import App from "@/tradevault/App";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/site";

const SEO_TITLE = "TradeVault — The Data-Driven Trading Journal";
const SEO_DESCRIPTION =
  "Log every trade, get quant-grade analytics (Sharpe, Sortino, expectancy), AI coaching, a Forex Factory economic calendar and a pre-market discipline checklist. Free during early access.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: SEO_TITLE },
      { name: "description", content: SEO_DESCRIPTION },
      { property: "og:title", content: SEO_TITLE },
      { property: "og:description", content: SEO_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: absoluteUrl("/icon-512.png") },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: SEO_TITLE },
      { name: "twitter:description", content: SEO_DESCRIPTION },
      { name: "twitter:image", content: absoluteUrl("/icon-512.png") },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
  }),
  component: Index,
});

function Index() {
  return (
    <ClientOnly fallback={<div className="min-h-screen" />}>
      <App />
    </ClientOnly>
  );
}
