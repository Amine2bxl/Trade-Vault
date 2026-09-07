import { describe, expect, test } from "bun:test";
import { readSource, stripComments } from "./helpers/source";

/**
 * LES PASTILLES D'UNE LIGNE DOIVENT FORMER UNE COLONNE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * Sur « Setups manqués », chaque ligne alignait quatre éléments dans un même
 * flux : symbole, date, pastille de R manqué, pastille de captures. Les deux
 * pastilles commençaient donc APRÈS le symbole et la date, dont la largeur
 * change à chaque ligne — « US30 » contre « GBPJPY », « 3 mars » contre
 * « 12 mars ».
 *
 * Résultat : les pastilles zigzaguaient d'une ligne à l'autre, une fois plus à
 * gauche, une fois plus à droite, alors qu'elles portent exactement la même
 * information sur toutes les lignes. L'œil ne peut pas comparer une colonne qui
 * n'en est pas une — c'est le seul travail que ces pastilles ont à faire.
 *
 * ── CE QUI EST VÉRIFIÉ ──────────────────────────────────────────────────────
 *
 * Une largeur FIXE et un alignement à droite : le bord droit de chaque
 * pastille tombe au même pixel sur toutes les lignes. Et la case reste réservée
 * même quand la pastille est absente — sinon la ligne suivante vient combler le
 * trou, et la colonne se rompt exactement là où il y a le moins de données.
 */

const SRC = stripComments(readSource(import.meta.dir, "../src/app/pages/MissedOpportunities.tsx"));

/**
 * Le fragment de la ligne d'en-tête, de la zone élastique jusqu'aux boutons
 * d'action. Il commence AVANT le symbole : la classe qui absorbe la variation
 * vit sur la balise qui le porte, pas après elle.
 */
const LIGNE = SRC.slice(
  SRC.indexOf('<div className="flex items-center gap-2 min-w-0 flex-1">'),
  SRC.indexOf("onClick={() => setViewing(m)}"),
);

describe("les deux pastilles tiennent une colonne", () => {
  test("chacune vit dans une case de largeur fixe", () => {
    // Sans largeur fixe, la case se dimensionne sur son contenu et l'alignement
    // dépend à nouveau de ce qu'il y a à gauche.
    const cases = [...LIGNE.matchAll(/className="flex w-\[(\d+)px\][^"]*justify-end/g)];
    expect(cases.length).toBe(2);
    for (const c of cases) expect(Number(c[1])).toBeGreaterThan(0);
  });

  test("elles s'alignent à DROITE dans leur case", () => {
    // « +2.5 R » et « +12.5 R » n'ont pas la même largeur : aligner à gauche
    // ferait à nouveau flotter le bord droit.
    const justifications = [...LIGNE.matchAll(/w-\[\d+px\][^"]*justify-(\w+)/g)].map((m) => m[1]);
    expect(justifications).toEqual(["end", "end"]);
  });

  test("la case reste réservée quand la pastille est absente", () => {
    // C'est le point qui casse le plus facilement : rendre la case seulement
    // `{cond && <case>}` ferait remonter la pastille suivante, donc romprait la
    // colonne pile sur les lignes sans donnée.
    for (const garde of ["m.estimatedR > 0 &&", "m.screenshots.length > 0 &&"]) {
      const i = LIGNE.indexOf(garde);
      expect(i, garde).toBeGreaterThan(-1);
      // La garde est DANS la case, jamais autour : la balise ouvrante de la
      // case la précède immédiatement.
      const avant = LIGNE.slice(0, i);
      expect(avant.lastIndexOf("justify-end"), garde).toBeGreaterThan(avant.lastIndexOf("</span>"));
    }
  });

  test("le symbole et la date absorbent la variation", () => {
    // Quelque chose doit céder : c'est le couple symbole + date, qui tronque.
    expect(LIGNE).toContain("min-w-0 flex-1 truncate");
  });
});

describe("l'icône de captures", () => {
  test("ce n'est plus un émoji", () => {
    // Un émoji est rendu par la police du système : dessin, taille et couleur
    // changent d'une machine à l'autre, au milieu d'une interface qui n'en
    // utilise nulle part ailleurs.
    expect(SRC).not.toContain("📷");
    expect(LIGNE).toContain("<Camera ");
  });
});
