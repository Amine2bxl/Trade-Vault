import { createFileRoute } from "@tanstack/react-router";
import LegalPage from "../app/pages/LegalPage";
import { getCookiesDoc } from "../app/pages/legal-content";
import { pageSeo } from "../shared/seo";

/**
 * `/cookies` — la page que le pied de page promettait depuis toujours.
 *
 * Le lien « Cookies » existait et menait à `/privacy`, qui ne mentionnait pas
 * un seul cookie. Un lien qui annonce un document et en sert un autre est un
 * lien mort qui n'en a pas l'air : il ne casse rien, il trompe.
 */
export const Route = createFileRoute("/cookies")({
  head: () =>
    pageSeo({
      title: "Cookies et stockage local — TradeVault",
      description:
        "L'inventaire complet de ce que TradeVault stocke dans ton navigateur : ta session, tes préférences, ton travail en cours. Aucune publicité, aucune mesure d'audience tierce.",
      path: "/cookies",
      type: "article",
    }),
  component: CookiesPage,
});

function CookiesPage() {
  return <LegalPage pick={getCookiesDoc} path="/cookies" />;
}
