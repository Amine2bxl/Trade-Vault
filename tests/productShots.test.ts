import { describe, expect, test } from "bun:test";
import { readSource, stripComments } from "./helpers/source";

/**
 * LES CAPTURES DU PRODUIT SUR LA LANDING.
 *
 * ── CE QUI EST EN JEU ───────────────────────────────────────────────────────
 *
 * `DESIGN.md` demande deux choses en même temps : que chaque section soit menée
 * par une capture du produit, et que rien ne soit inventé — « NEVER invent
 * testimonials, user counts, logos, revenue or performance claims ».
 *
 * La landing tenait la première en violant la seconde : elle DESSINAIT le
 * produit, et les chiffres de ces dessins (« +$4,218.50 », « 64 % », « 2.31 »)
 * sont fabriqués. Un visiteur ne distingue pas une capture d'un dessin soigné —
 * c'est exactement ce qui rend le dessin inacceptable.
 *
 * Le dessin ne peut donc subsister QUE comme repli, le temps que la vraie
 * capture soit déposée. Ces tests interdisent les deux dérives possibles : un
 * dessin qui reste affiché à côté d'une capture disponible, et une capture
 * attendue que personne ne sait nommer.
 */

const read = (p: string) => stripComments(readSource(import.meta.dir, p));
const LANDING = read("../src/app/pages/Landing.tsx");
const README = readSource(import.meta.dir, "../src/assets/product/README.md");
/* Lu BRUT, sans retirer les commentaires : le motif du glob contient
   `product/*.{png,…}`, dont le `/*` ouvre un commentaire de bloc aux yeux d'un
   nettoyeur naïf — qui avale alors l'appel entier. */
const SHOTS = readSource(import.meta.dir, "../src/app/pages/landing/shots.ts");
const I18N = read("../src/app/pages/landing/i18n.tsx");

/** Les captures que la landing sait afficher, dans l'ordre où elle les monte. */
const NOMS = [...LANDING.matchAll(/<ShotOuVisuel\s[^>]*?nom="([^"]+)"/gs)].map((m) => m[1]);

describe("le mécanisme des captures", () => {
  test("la landing réserve au moins les deux emplacements connus", () => {
    expect(NOMS).toContain("dashboard");
    expect(NOMS).toContain("monthly-reports");
  });

  test("la présence d'un fichier est connue au BUILD, pas à l'exécution", () => {
    // C'est toute la différence avec un chemin sous `public/` : là-bas, une
    // capture manquante ne se voit qu'une fois la page publiée, sous la forme
    // d'une image cassée en haut de l'accueil. Ici, le bundler sait.
    expect(SHOTS).toContain("import.meta.glob");
    expect(SHOTS).toContain("eager: true");
  });

  test("une capture absente rend `null`, jamais un chemin de remplacement", () => {
    // Rendre une URL bidon ferait exactement ce que le glob évite : une requête
    // vers un fichier qui n'existe pas.
    expect(SHOTS).toMatch(/return CAPTURES\[nom\] \?\? null/);
  });
});

describe("aucun dessin ne survit à sa capture", () => {
  test("le visuel inventé du héros n'est monté QUE comme repli", () => {
    // `<HeroProductVisual />` posé ailleurs qu'en `repli` réafficherait des
    // chiffres fabriqués à côté de la vraie capture.
    const montages = [...LANDING.matchAll(/<HeroProductVisual\s*\/>/g)];
    expect(montages.length).toBe(1);
    const avant = LANDING.slice(0, LANDING.indexOf("<HeroProductVisual />"));
    expect(avant.slice(-40)).toContain("repli={");
  });

  test("les montants fabriqués vivent tous derrière un repli", () => {
    // Le chiffre témoin, présent deux fois : dans le héros et dans la section
    // analytics. Deux abris légitimes, et deux seulement :
    //
    //   • le corps de `HeroProductVisual`, dont le test ci-dessus prouve qu'il
    //     n'est monté QUE comme repli ;
    //   • un `repli={…}` écrit sur place.
    //
    // Toute autre position remettrait un montant inventé à l'écran à côté de
    // la vraie capture.
    const debutHero = LANDING.indexOf("function HeroProductVisual(");
    expect(debutHero).toBeGreaterThan(-1);
    const finHero = LANDING.indexOf("\nfunction ", debutHero + 1);

    const occurrences = [...LANDING.matchAll(/\+\$4,218\.50/g)];
    expect(occurrences.length).toBeGreaterThan(0);

    for (const m of occurrences) {
      const i = m.index!;
      if (i > debutHero && i < finHero) continue;
      const avant = LANDING.slice(0, i);
      const dernierRepli = avant.lastIndexOf("repli={");
      const dernierShot = avant.lastIndexOf("<ShotOuVisuel");
      expect(dernierRepli).toBeGreaterThan(-1);
      // Le `repli={` le plus proche appartient bien au `<ShotOuVisuel` ouvert
      // juste avant : sinon le montant serait hors de tout repli.
      expect(dernierRepli).toBeGreaterThan(dernierShot);
    }
  });
});

describe("ce qu'on attend est écrit quelque part", () => {
  test("chaque capture attendue par la landing est nommée dans le README", () => {
    // Sans ça, il faut lire le JSX pour savoir quel fichier déposer — donc
    // personne ne le dépose.
    for (const nom of NOMS) {
      expect(README).toContain(`\`${nom}\``);
    }
  });

  test("chaque capture porte un texte alternatif traduit", () => {
    // Une image sans `alt` sur la page d'accueil coûte à l'accessibilité ET au
    // référencement, les deux d'un coup.
    for (const nom of NOMS) {
      const bloc = LANDING.slice(LANDING.indexOf(`nom="${nom}"`));
      const cle = bloc.match(/alt=\{t\("([^"]+)"\)\}/);
      expect(cle).not.toBeNull();
      expect(I18N).toContain(`"${cle![1]}"`);
    }
  });

  test("le texte alternatif décrit l'ÉCRAN, pas une performance", () => {
    // Une capture montre le compte d'un trader ; l'`alt` ne doit pas en faire
    // une promesse de résultat. Le contrôle porte sur ce qui se lirait comme
    // un gain chiffré.
    const alts = [...I18N.matchAll(/"shot\.[^"]*\.alt":\s*\{([^}]*)\}/gs)].map((m) => m[1]);
    expect(alts.length).toBeGreaterThan(0);
    for (const bloc of alts) {
      expect(bloc).not.toMatch(/[$€]\s?\d/);
      expect(bloc).not.toMatch(/\d+\s?%/);
    }
  });
});
