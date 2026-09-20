import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * LE 500 DES APPELS À L'ACTION, SUR LES SURFACES PUBLIQUES.
 *
 * `AuthModal` appelle `useAuth()`, qui LÈVE quand aucun fournisseur n'est
 * monté au-dessus. Sur `/`, l'application en pose un et tout va bien. Mais
 * `/fr` et `/pricing` rendent la même modale HORS de l'arbre applicatif :
 * « Commencer », « Se connecter » et le choix d'une offre y remontaient
 * l'exception jusqu'à la frontière d'erreur, donc un écran 500 sur le clic
 * le plus important du site.
 *
 * Le défaut ne se voyait qu'en français, parce qu'il faut passer par `/fr`
 * pour l'atteindre - et `/fr` est exactement là où le sélecteur de langue
 * emmène.
 *
 * ── CE QUE CE TEST GARDE ──────────────────────────────────────────────────
 *
 * Deux choses, et elles se complètent :
 *
 *   1. La modale pose elle-même son fournisseur. C'est ce qui rend toute
 *      surface future sûre sans qu'elle ait à y penser.
 *   2. Le fournisseur posé est l'IDEMPOTENT. Un `AuthProvider` nu y
 *      créerait une seconde session dans l'application - deux abonnements
 *      `onAuthStateChange`, deux vérités sur qui est connecté.
 *
 * Un test de source plutôt qu'un rendu : c'est une règle de MONTAGE, elle se
 * lit dans le fichier, et la vérifier ne demande ni DOM ni Supabase.
 */
const lire = (p: string) => readFileSync(new URL(p, import.meta.url), "utf-8");

const MODALE = lire("../src/app/pages/landing/AuthModal.tsx");
const CONTEXTE = lire("../src/app/contexts/AuthContext.tsx");

describe("la modale d'authentification est montable partout", () => {
  test("elle enveloppe son contenu dans un fournisseur d'auth", () => {
    expect(MODALE).toContain("EnsureAuthProvider");
    // L'ordre compte : le fournisseur doit ENTOURER le composant qui
    // consomme, pas vivre à côté de lui.
    const i = MODALE.indexOf("<EnsureAuthProvider>");
    const j = MODALE.indexOf("<AuthModalInterne");
    const k = MODALE.indexOf("</EnsureAuthProvider>");
    expect(i, "<EnsureAuthProvider> absent").toBeGreaterThan(-1);
    expect(j, "<AuthModalInterne> absent").toBeGreaterThan(i);
    expect(k).toBeGreaterThan(j);
  });

  test("seul le composant INTERNE consomme le contexte", () => {
    // Si l'export public appelait `useAuth()`, il le ferait au-dessus de son
    // propre fournisseur : exactement le bug d'origine, réintroduit.
    const exportPublic = MODALE.slice(
      MODALE.indexOf("export function AuthModal("),
      MODALE.indexOf("function AuthModalInterne"),
    );
    expect(exportPublic).not.toContain("useAuth(");
  });

  test("le fournisseur idempotent ne double pas la session", () => {
    const bloc = CONTEXTE.slice(CONTEXTE.indexOf("export function EnsureAuthProvider"));
    // Il rend les enfants TELS QUELS quand un contexte existe déjà.
    expect(bloc).toContain("useContext(AuthContext)");
    expect(bloc).toMatch(/if \(existant\) return <>\{children\}<\/>;/);
  });
});

describe("les surfaces publiques qui montent la modale", () => {
  // `/fr` rend la vitrine SANS `ClientOnly`, donc sans l'application, donc
  // sans fournisseur. C'est la route par laquelle le bug arrivait ; qu'elle
  // reste ainsi est un choix (une page de vente n'a pas à charger
  // l'application), et c'est justement pour ça que la modale doit être
  // autonome.
  for (const [nom, chemin] of [
    ["la vitrine", "../src/app/pages/Landing.tsx"],
    ["la page des tarifs", "../src/app/pages/PricingPage.tsx"],
  ] as const) {
    test(`${nom} monte la modale sans fournisseur à elle`, () => {
      const src = lire(chemin);
      expect(src).toContain("<AuthModal");
      expect(src, "un fournisseur en double recréerait une seconde session").not.toContain(
        "<AuthProvider",
      );
    });
  }
});
