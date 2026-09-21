import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * LE PRIX QUI ROULE — les trois choses qui le cassent en silence.
 *
 * La bascule mensuel / annuel est le geste le plus commercial de la page :
 * c'est lui qui montre l'économie. Il remplaçait un chiffre par un autre
 * d'une frame à l'autre, donc il ne se voyait pas.
 *
 * Trois régressions possibles, et aucune ne fait échouer un rendu :
 *
 *   1. quelqu'un remet `{price}` en clair dans la colonne, et l'animation
 *      disparaît sans que rien ne casse ;
 *   2. la valeur sortante est retirée sur une minuterie plutôt qu'à la fin
 *      de son animation — les deux durées divergent tôt ou tard et un
 *      chiffre fantôme reste empilé derrière le bon ;
 *   3. l'animation touche une propriété de mise en page, ce que la loi de
 *      mouvement interdit (`transform` et `opacity`, rien d'autre).
 *
 * Un test de SOURCE : ce sont des règles de construction, elles se lisent
 * dans le fichier, et les vérifier ne demande ni DOM ni horloge.
 */
const lire = (p: string) => readFileSync(new URL(p, import.meta.url), "utf-8");

const COMPOSANT = lire("../src/app/components/pricing/PrixAnime.tsx");
const GRILLE = lire("../src/app/components/pricing/PricingPlans.tsx");
const STYLES = lire("../src/styles.css");

describe("le prix s'anime au changement de période", () => {
  test("la grille tarifaire passe par le composant animé", () => {
    expect(GRILLE).toContain("PrixAnime");
    expect(GRILLE).toMatch(/<PrixAnime\s/);
  });

  test("la valeur sortante part à la fin de son animation, pas sur une minuterie", () => {
    expect(COMPOSANT).toContain("onAnimationEnd");
    expect(COMPOSANT, "une minuterie finirait par diverger de la durée CSS").not.toContain(
      "setTimeout",
    );
  });

  test("le sens du roulement suit le sens du prix", () => {
    // Un prix qui baisse roule vers le bas : c'est ce qui rend l'économie
    // lisible sans légende.
    expect(COMPOSANT).toMatch(/valeurNumerique\(valeur\) < valeurNumerique\(precedent\.current\)/);
  });

  test("elle n'anime que transform et opacity", () => {
    const debut = STYLES.indexOf("@keyframes prix-entre");
    const fin = STYLES.indexOf("}", STYLES.indexOf("@keyframes prix-sort") + 40);
    const bloc = STYLES.slice(debut, STYLES.indexOf("\n}", fin) + 2);
    expect(bloc).toContain("transform");
    expect(bloc).toContain("opacity");
    for (const interdit of ["height", "width", "margin", "top:", "left:", "padding"]) {
      expect(bloc, `${interdit} déclenche une mise en page à chaque frame`).not.toContain(interdit);
    }
  });

  test("elle se tait sous prefers-reduced-motion", () => {
    // L'animation vit DANS la requête média, elle n'est pas annulée après
    // coup : c'est le patron en usage partout ailleurs dans le produit.
    const i = STYLES.indexOf(
      "@media (prefers-reduced-motion: no-preference) {\n  .prix-anime-entre",
    );
    expect(i, "l'animation du prix doit être déclarée sous no-preference").toBeGreaterThan(-1);
  });
});
