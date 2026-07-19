import { createFileRoute } from "@tanstack/react-router";
import LegalPage from "../app/pages/LegalPage";
import { getPrivacyDoc } from "../app/pages/legal-content";

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
