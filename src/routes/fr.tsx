import { createFileRoute } from "@tanstack/react-router";
import Landing from "@/app/pages/Landing";
import { LANDING_ALTERNATES, pageSeo } from "../shared/seo";

/**
 * LA VITRINE FRANÇAISE — la même page, à son adresse.
 *
 * ── POURQUOI CETTE ROUTE EXISTE ─────────────────────────────────────────────
 *
 * Le dictionnaire français de la landing était intégralement écrit — plusieurs
 * centaines de chaînes traduites — et n'apparaissait qu'après un clic sur le
 * sélecteur EN/FR, À LA MÊME URL que l'anglais.
 *
 * Un moteur de recherche n'indexe pas un état d'interface, il indexe des
 * adresses. Tout ce contenu était donc introuvable : zéro requête française
 * pouvait mener au site, sur le marché que le produit adresse — les CGU, la
 * politique de confidentialité et la voix du produit (le tutoiement) sont en
 * français, mais la seule page indexable était en anglais.
 *
 * ── CE QUI DIFFÈRE DE `/` ───────────────────────────────────────────────────
 *
 * Le composant. C'est tout. `Landing` reçoit `lang="fr"`, ce qui rend la page
 * en français DÈS LE SSR (`LandingLangProvider pinned`), au lieu de rendre
 * l'anglais puis de basculer. Aucune duplication de mise en page, aucun
 * dictionnaire supplémentaire : la même vitrine, servie dans l'autre langue.
 *
 * ── CE QUI N'EST PAS UN CONTENU DUPLIQUÉ ────────────────────────────────────
 *
 * Deux pages qui disent la même chose dans deux langues ne sont pas un doublon,
 * à une condition : qu'elles se déclarent mutuellement. `LANDING_ALTERNATES`
 * porte la paire, et `pageSeo` en tire une grappe `hreflang` réciproque
 * (`en`, `fr`, `x-default`) émise des DEUX côtés. Sans cette réciprocité,
 * Google ignore la grappe entière et traite bien les deux pages comme des
 * concurrentes.
 *
 * `/` reste `x-default` : c'est la version servie à qui n'a exprimé aucune
 * préférence.
 */

const SEO_TITLE = "TradeVault — Journal de trading et coach IA pour traders";
// ≤ 155 caractères, comme la version anglaise de `routes/index.tsx`. Ce n'est
// pas la traduction mot à mot de l'anglaise : une description est écrite pour
// les requêtes de sa langue, pas décalquée de l'autre.
const SEO_DESCRIPTION =
  "Journal de trading avec coach IA : analyse tes performances, suis ton plan de trading et tiens ta discipline. Analytics, calendrier économique et checklist pré-market.";

export const Route = createFileRoute("/fr")({
  head: () =>
    pageSeo({
      title: SEO_TITLE,
      description: SEO_DESCRIPTION,
      path: "/fr",
      lang: "fr",
      alternates: LANDING_ALTERNATES,
    }),
  component: FrenchLanding,
});

function FrenchLanding() {
  // Pas de `ClientOnly` ici, contrairement à `/`. Cette route est une PAGE DE
  // VENTE, pas le point d'entrée de l'application : un visiteur connecté
  // n'atterrit jamais dessus depuis le produit, il arrive d'un résultat de
  // recherche. Monter le shell authentifié par-dessus n'aurait servi personne
  // et aurait chargé l'application entière pour une page publique.
  return <Landing lang="fr" />;
}
