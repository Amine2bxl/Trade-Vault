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
 * produit, et les chiffres de ces dessins (« +$4,218.50 », « 64 % », « 2.31 »,
 * « −$1,240 ») sont fabriqués. Un visiteur ne distingue pas une capture d'un
 * dessin soigné — c'est exactement ce qui rend le dessin inacceptable.
 *
 * ── LA RÈGLE S'EST DURCIE ───────────────────────────────────────────────────
 *
 * Ces dessins ont longtemps été tolérés COMME REPLI : ils ne s'affichaient que
 * si la capture manquait. C'était une fausse sécurité. `AnalyticsSection`
 * portait un repli pour `monthly-reports.webp`, une capture que le harnais
 * refuse d'encoder parce que la page tombe sur son état vide : le dessin
 * n'attendait donc aucune panne, il était le seul rendu possible de ce bloc.
 * Les trois autres se seraient affichés au premier fichier supprimé par
 * mégarde.
 *
 * Les quatre sont partis. La règle n'est plus « derrière un repli » mais
 * « nulle part » : sur la vitrine, tout chiffre affiché vient d'une capture du
 * produit ou du catalogue d'offres. Un repli vaut `null`, et une capture
 * absente ne montre rien — un trou se voit et se corrige, un faux tableau de
 * bord non.
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
  test("la landing réserve les emplacements qu'elle sait remplir", () => {
    // `monthly-reports` a quitté cette liste avec la section analytics qui le
    // montait : sa capture n'est pas encodée (état vide sur le compte
    // vitrine), donc réserver l'emplacement ne réservait qu'un dessin.
    expect(NOMS).toContain("dashboard");
    expect(NOMS).toContain("mistakes");
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

describe("aucun chiffre fabriqué n'atteint la vitrine", () => {
  /* Les montants témoins des quatre maquettes supprimées. Les chercher
     nommément plutôt que par motif : un motif attraperait aussi les prix du
     catalogue, qui eux sont légitimes. */
  const TEMOINS = ["+$4,218.50", "−$1,240", "−$890", "−$670", "2.31", "+0.68R", "1.96"];

  test("les montants des anciennes maquettes ont disparu", () => {
    for (const t of TEMOINS) {
      expect(LANDING, `${t} est un chiffre inventé`).not.toContain(t);
    }
  });

  test("plus aucun repli ne dessine le produit", () => {
    // `repli` n'accepte plus que `null` : un JSX en repli, c'est un dessin
    // qui attend sa panne pour s'afficher.
    const replis = [...LANDING.matchAll(/repli[=:]\s*(\{?)([^,\n]*)/g)].map((m) =>
      m[2].trim().replace(/\}$/, ""),
    );
    expect(replis.length).toBeGreaterThan(0);
    for (const r of replis) {
      expect(r, `repli « ${r} » doit valoir null`).toBe("null");
    }
  });

  test("aucun montant en dur sur la vitrine", () => {
    // Un prix vient du catalogue (`eur(...)`), jamais d'une chaîne écrite à
    // la main : c'est ce qui garantit qu'il ne diverge pas de Stripe.
    const enDur = [...LANDING.matchAll(/["'>][^"'<]*\$\s?\d[\d.,]*/g)].map((m) => m[0]);
    expect(enDur).toEqual([]);
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
