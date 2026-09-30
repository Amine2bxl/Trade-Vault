import { createFileRoute } from "@tanstack/react-router";
import LegalPage from "../app/public/LegalPage";
import { getCguDoc } from "../app/public/legal-content";
import { pageSeo } from "../shared/seo";

export const Route = createFileRoute("/cgu")({
  head: () =>
    pageSeo({
      title: "Conditions Générales d'Utilisation — TradeVault",
      description:
        "Les Conditions Générales d'Utilisation de TradeVault : le service, ton compte, la gratuité, tes données, et pourquoi rien ici n'est un conseil financier.",
      path: "/cgu",
      type: "article",
    }),
  component: CguPage,
});

function CguPage() {
  return <LegalPage pick={getCguDoc} path="/cgu" />;
}
