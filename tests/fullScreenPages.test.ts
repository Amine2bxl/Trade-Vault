import { describe, expect, test } from "bun:test";
import { readSource, stripComments } from "./helpers/source";

/**
 * LES PAGES « PLEIN ÉCRAN » NE DOIVENT PAS ÉCRASER LEUR CONTENU.
 *
 * ── LE BUG QUE CE FICHIER EMPÊCHE DE REVENIR ────────────────────────────────
 *
 * Le calendrier et Monte-Carlo remplissent la fenêtre : leur cadre reçoit une
 * hauteur MESURÉE par `useAvailableHeight()`. Cette hauteur doit être une
 * CIBLE (« remplis l'écran »), jamais un PLAFOND (« tiens dans l'écran, quoi
 * qu'il en coûte »).
 *
 * Elle est devenue un plafond, et le calendrier s'est écrasé sur lui-même.
 * Trois ingrédients, chacun anodin isolément :
 *
 *   1. `style={{ height }}` au lieu de `minHeight` ;
 *   2. `overflow-hidden` sur le cadre — donc rien ne peut défiler pour
 *      compenser ;
 *   3. `min-h-0` le long de la chaîne flex. C'est le plus vicieux :
 *      `min-height: 0` autorise EXPLICITEMENT un élément flex à rétrécir sous
 *      la taille de son contenu. Les lignes de semaine tombaient à quelques
 *      pixels pendant que leurs cellules gardaient leur hauteur — elles
 *      débordaient de leur propre ligne et se chevauchaient.
 *
 * Rien de tout cela ne lève, n'échoue au typage ni ne casse un test de rendu :
 * la page s'affiche, simplement illisible, et seulement sur les écrans assez
 * courts pour que le contenu ne rentre pas. C'est exactement le genre de
 * régression qui passe une revue.
 *
 * ── CE QUI EST VÉRIFIÉ, ET CE QUI NE L'EST PAS ──────────────────────────────
 *
 * On ne teste pas une apparence — on teste les trois décisions structurelles
 * qui la garantissent. Les `min-h-0` INTERNES aux sections de graphe ne sont
 * pas concernés : eux sont nécessaires pour qu'un `ResponsiveContainer` puisse
 * mesurer sa place au lieu de gonfler indéfiniment.
 */

const read = (p: string) => stripComments(readSource(import.meta.dir, p));

/** Les pages qui montent `useAvailableHeight`. */
const PAGES = [
  { nom: "Calendrier", chemin: "../src/app/pages/CalendarPage.tsx" },
  { nom: "Monte-Carlo", chemin: "../src/app/pages/MonteCarlo.tsx" },
] as const;

describe("les pages plein écran", () => {
  for (const { nom, chemin } of PAGES) {
    describe(nom, () => {
      const src = read(chemin);

      test("mesure sa hauteur au lieu de la deviner", () => {
        expect(src).toContain("useAvailableHeight()");
      });

      test("traite la hauteur mesurée comme un MINIMUM, pas comme une hauteur fixe", () => {
        // `{ height }` enferme le contenu ; `{ minHeight: height }` lui donne un
        // objectif tout en le laissant grandir.
        expect(src).toContain("{ minHeight: height }");
        expect(src).not.toContain("{ height }");
      });

      test("laisse le cadre défiler quand le contenu ne rentre plus", () => {
        // Le cadre est le premier élément à porter `ref={boxRef}` : c'est lui
        // qui reçoit la hauteur, donc lui qui doit pouvoir défiler.
        const cadre = src.slice(src.indexOf("ref={boxRef}"));
        const finDuCadre = cadre.slice(0, cadre.indexOf(">"));
        expect(finDuCadre).toContain("overflow-y-auto");
        expect(finDuCadre).not.toContain("overflow-hidden");
      });
    });
  }
});

describe("la grille du calendrier", () => {
  const src = read("../src/app/pages/CalendarPage.tsx");

  test("garde un plancher de hauteur sur ses cellules", () => {
    // Le plancher a existé (`md:min-h-[112px]`), puis a été remplacé par
    // `md:min-h-[0]` — ce qui revient à n'en avoir aucun. Une cellule doit
    // pouvoir porter la date, le P&L et le nombre de trades.
    const planchers = [...src.matchAll(/md:min-h-\[(\d+)px\]/g)].map((m) => Number(m[1]));
    expect(planchers.length).toBeGreaterThan(0);
    for (const p of planchers) expect(p).toBeGreaterThanOrEqual(80);
    // Et surtout : jamais un plancher nul, qui annule la protection.
    expect(src).not.toContain("md:min-h-[0]");
    expect(src).not.toContain("md:min-h-0");
  });

  test("n'autorise AUCUN maillon à rétrécir sous son contenu", () => {
    // La permission se propage le long de la chaîne flex : un seul `min-h-0`
    // entre le cadre et les cellules suffit à réécraser la grille, quel que
    // soit le plancher de celles-ci. Cette page n'a pas de graphe, donc aucun
    // `min-h-0` n'y est légitime.
    expect(src).not.toContain("min-h-0");
  });
});
