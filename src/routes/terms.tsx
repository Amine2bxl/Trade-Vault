import { createFileRoute } from "@tanstack/react-router";
import LegalPage from "../app/pages/LegalPage";
import { getTermsDoc } from "../app/pages/legal-content";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — TradeVault" },
      { name: "description", content: "TradeVault Terms of Service." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return <LegalPage pick={getTermsDoc} />;
}
