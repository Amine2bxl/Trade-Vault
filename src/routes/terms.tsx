import { createFileRoute } from "@tanstack/react-router";
import LegalPage from "../tradevault/pages/LegalPage";
import { getTermsDoc } from "../tradevault/pages/legal-content";
import { absoluteUrl } from "../lib/site";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — TradeVault" },
      { name: "description", content: "TradeVault Terms of Service." },
      { property: "og:url", content: absoluteUrl("/terms") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/terms") }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return <LegalPage pick={getTermsDoc} />;
}
