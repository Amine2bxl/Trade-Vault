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

/**
 * LE GRAPHE QUI DISPARAÎT SANS RIEN CASSER.
 *
 * ── LE BUG ──────────────────────────────────────────────────────────────────
 *
 * `ResponsiveContainer height="100%"` ne dessine RIEN quand son parent n'a pas
 * de hauteur définie. Monte-Carlo posait ses graphes dans une chaîne
 * `flex-1 → min-h-0 → 100 %`, qui fonctionnait tant que la PAGE portait une
 * hauteur fixe. En la faisant passer en `minHeight` + `overflow-y-auto` — la
 * correction juste, celle qui empêche l'écrasement testé plus haut — un maillon
 * de cette chaîne est redevenu un bloc ordinaire : la section n'était plus
 * étirée, sa hauteur est retombée sur son contenu, le conteneur a mesuré 0.
 *
 * Rien n'a échoué. Pas d'erreur, pas de typage rouge, pas de test rouge : la
 * page s'affichait entière, sans sa courbe. Le retour utilisateur a été « pas
 * de courbe ». Deux corrections structurelles justes se sont annulées l'une
 * l'autre — c'est le mode de panne le plus coûteux, parce que rien ne le
 * signale.
 *
 * ── CE QUI EST VÉRIFIÉ ──────────────────────────────────────────────────────
 *
 * Une hauteur en PIXELS ne dépend d'aucun parent : elle ne peut pas se rompre.
 * On exige donc qu'elle soit là, juste avant chaque conteneur.
 */
describe("les graphes de Monte-Carlo", () => {
  const src = read("../src/app/pages/MonteCarlo.tsx");

  test("chaque ResponsiveContainer a un parent de hauteur DÉFINIE", () => {
    const morceaux = src.split("<ResponsiveContainer");
    // Le fichier en monte au moins deux : le faisceau et la distribution.
    expect(morceaux.length - 1).toBeGreaterThanOrEqual(2);

    for (let i = 1; i < morceaux.length; i++) {
      // Le conteneur porteur de la hauteur est l'élément qui enveloppe
      // directement le graphe : il tient dans les quelques lignes qui
      // précèdent.
      const avant = morceaux[i - 1].slice(-300);
      expect(avant).toMatch(/h-\[\d+px\]|H_COURBE|H_DISTRIB/);
    }
  });

  test("les deux hauteurs nommées sont bien des pixels, pas des pourcentages", () => {
    // `H_COURBE = "h-full"` passerait le test précédent tout en reproduisant
    // exactement le bug : la constante doit résoudre en pixels.
    for (const nom of ["H_COURBE", "H_DISTRIB"]) {
      const ligne = src.match(new RegExp(`const ${nom} = "([^"]+)"`));
      expect(ligne).not.toBeNull();
      expect(ligne![1]).toMatch(/h-\[\d+px\]/);
    }
  });

  test("les cinq percentiles du faisceau sont tous TRACÉS", () => {
    // Ils existaient dans les données depuis toujours, mais quatre d'entre eux
    // étaient dessinés en aplats à 6 % d'opacité : invisibles. Le meilleur et
    // le pire cas — les deux bornes qui disent si le plan tient — n'étaient
    // donc lisibles nulle part.
    const table = src.slice(src.indexOf("const COURBES = ["));
    for (const cle of ["p5", "p25", "p50", "p75", "p95"]) {
      expect(table).toContain(`cle: "${cle}"`);
    }
  });
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
