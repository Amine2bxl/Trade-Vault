import { createFileRoute } from "@tanstack/react-router";
import LegalPage from "../app/pages/LegalPage";
import { getPrivacyDoc } from "../app/pages/legal-content";
import { pageSeo } from "../shared/seo";

export const Route = createFileRoute("/privacy")({
  head: () =>
    pageSeo({
      title: "Politique de confidentialité — TradeVault",
      description:
        "Quelles données TradeVault collecte, pourquoi, où elles sont stockées, ce qui est transmis à l'IA, et comment supprimer ton compte et toutes tes données à tout moment.",
      path: "/privacy",
      type: "article",
    }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return <LegalPage pick={getPrivacyDoc} />;
}
