import { describe, expect, test } from "bun:test";
import { readSource, stripComments } from "./helpers/source";

/**
 * LE VERROU DE LA CHECKLIST DOIT POUVOIR S'OUVRIR SUR PLACE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * Une fois la séance verrouillée, décocher un item « ne faisait rien ». Rien
 * n'était pourtant bloqué : la case changeait bel et bien d'état — mais
 * `day.locked` restait vrai. L'écran continuait donc d'afficher le bandeau
 * « mode exécution », le bouton restait « edge verrouillé », et la seule chose
 * qui bougeait était une pastille au milieu d'une liste.
 *
 * Deux problèmes en un :
 *
 *   1. UN CLIC SANS CONSÉQUENCE VISIBLE SE LIT COMME UN CLIC MORT. C'est le
 *      symptôme rapporté : « il faut sortir de la checklist et revenir ».
 *   2. L'ÉTAT DEVENAIT INCOHÉRENT — verrouillé alors que la préparation ne
 *      l'autorisait plus. Aucun écran ne représentait cette combinaison, et le
 *      seul moyen d'en sortir était de quitter la page.
 *
 * ── CE QUI EST VÉRIFIÉ ──────────────────────────────────────────────────────
 *
 * Deux chemins de sortie, tous deux SUR la page : toute correction rouvre le
 * verrou, et un bouton nommé le fait explicitement sans rien effacer.
 *
 * On teste par lecture de source parce que la règle vit dans un composant de
 * 2 200 lignes branché sur l'audio, la synthèse vocale et un canvas : le
 * monter coûterait plus cher que ce que le test protège. Ce qui compte ici est
 * qu'aucune des quatre entrées de porte ne puisse repasser en `setDay` direct
 * sans que la CI le voie.
 */

const SRC = stripComments(readSource(import.meta.dir, "../src/app/pages/Checklist.tsx"));

describe("corriger sa préparation rouvre le verrou", () => {
  test("la règle existe en UN seul endroit", () => {
    // Quatre écritures dispersées auraient divergé : la première oubliée
    // ramène exactement le bug.
    expect(SRC).toContain("const rouvrirSiVerrouille");
    expect(SRC).toMatch(/rouvrirSiVerrouille\s*=\s*\(d: DayState\)/);
  });

  test("les quatre entrées de porte passent toutes par elle", () => {
    // Items, mental, motivation, engagement : ce sont exactement les quatre
    // valeurs dont `gates` dépend. Une seule qui l'ignore recrée l'état
    // incohérent — verrouillé sans que la préparation l'autorise.
    for (const champ of ["checked: next", "motiv: i", "fomo: i", "assume: !d.assume"]) {
      const i = SRC.indexOf(champ);
      expect(i, champ).toBeGreaterThan(-1);
      // La règle enveloppe l'objet écrit : elle apparaît juste avant, sur la
      // même expression `setDay`.
      const debutLigne = SRC.lastIndexOf("setDay(", i);
      expect(SRC.slice(debutLigne, i), champ).toContain("rouvrirSiVerrouille");
    }
  });
});

describe("la porte de sortie explicite", () => {
  test("elle rouvre sans rien effacer", () => {
    // `resetAll` vide la journée entière ; ce n'est pas ce qu'on veut quand on
    // souhaite seulement revenir sur une case.
    const i = SRC.indexOf("const rouvrirChecklist");
    expect(i).toBeGreaterThan(-1);
    const corps = SRC.slice(i, SRC.indexOf("};", i));
    expect(corps).toContain("locked: false");
    expect(corps).not.toContain("emptyDay");
  });

  test("elle est atteignable depuis la page, pas seulement depuis la fenêtre de verrouillage", () => {
    // « Retour au poste » n'existait que dans l'overlay — donc plus nulle part
    // une fois cet overlay confirmé.
    expect(SRC).toContain("onClick={rouvrirChecklist}");
    // Et elle est posée sur le bandeau d'exécution, le seul endroit qui
    // signale l'état verrouillé une fois l'overlay parti.
    const banniere = SRC.slice(SRC.indexOf("chk.execMode"));
    expect(banniere.slice(0, 800)).toContain("rouvrirChecklist");
  });

  test("les deux actions restent distinctes", () => {
    // Confondre « rouvrir » et « nouvelle session » ferait perdre au trader
    // toute sa préparation pour corriger une case.
    expect(SRC).toContain("const resetAll");
    const reset = SRC.slice(SRC.indexOf("const resetAll"));
    expect(reset.slice(0, 300)).toContain("emptyDay");
  });
});
