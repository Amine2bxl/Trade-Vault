import { createFileRoute } from "@tanstack/react-router";
import ContactPage from "../app/pages/ContactPage";
import { pageSeo } from "../shared/seo";

export const Route = createFileRoute("/contact")({
  head: () =>
    pageSeo({
      title: "Contact — TradeVault",
      description:
        "Contacter l'équipe TradeVault : support produit, facturation, demandes RGPD et signalements de sécurité. Un humain répond sous 48 h ouvrées.",
      path: "/contact",
    }),
  component: ContactPage,
});
