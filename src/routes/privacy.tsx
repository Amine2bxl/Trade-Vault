import { createFileRoute } from "@tanstack/react-router";
import LegalPage from "../tradevault/pages/LegalPage";
import { getPrivacyDoc } from "../tradevault/pages/legal-content";
import { absoluteUrl } from "../lib/site";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — TradeVault" },
      { name: "description", content: "TradeVault Privacy Policy." },
      { property: "og:url", content: absoluteUrl("/privacy") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/privacy") }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return <LegalPage pick={getPrivacyDoc} />;
}
