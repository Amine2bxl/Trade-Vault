import { createFileRoute } from "@tanstack/react-router";
import LegalPage from "../tradevault/pages/LegalPage";
import { getPrivacyDoc } from "../tradevault/pages/legal-content";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — TradeVault" },
      { name: "description", content: "TradeVault Privacy Policy." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return <LegalPage pick={getPrivacyDoc} />;
}
