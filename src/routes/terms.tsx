import { createFileRoute } from "@tanstack/react-router";
import LegalPage from "../app/pages/LegalPage";
import { getTermsDoc } from "../app/pages/legal-content";
import { pageSeo } from "../shared/seo";

export const Route = createFileRoute("/terms")({
  head: () =>
    pageSeo({
      title: "Conditions d'utilisation — TradeVault",
      description:
        "Les conditions d'utilisation de TradeVault : ce que le service fait, ce qu'il ne fait pas, tes droits sur tes données, et pourquoi rien ici n'est un conseil financier.",
      path: "/terms",
      type: "article",
    }),
  component: TermsPage,
});

function TermsPage() {
  return <LegalPage pick={getTermsDoc} />;
}
