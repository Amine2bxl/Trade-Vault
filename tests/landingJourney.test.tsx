import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  JourneyCurve,
  EditorialSection,
  ProductChrome,
  SetupSplit,
  StatStrip,
  type Milestone,
} from "../src/app/pages/landing/Sections";
import { LandingLangProvider } from "../src/app/pages/landing/i18n";

/**
 * LE PARCOURS EN COURBE.
 *
 * C'est le composant le plus fragile de la vitrine, et pour une raison précise :
 * le tracé n'est pas dessiné à la main, il est CALCULÉ. `smoothPath` convertit
 * cinq points en une suite de Bézier cubiques (Catmull-Rom), et les jalons sont
 * positionnés séparément, en pourcentage, par-dessus.
 *
 * Ces deux choses peuvent diverger en silence. Une erreur de signe dans les
 * points de contrôle, un `toFixed` qui rend `NaN`, un point retiré de
 * `CURVE_POINTS` sans retirer le jalon correspondant : rien ne lève, rien
 * n'échoue au typage — la courbe s'affiche simplement de travers, ou les
 * pastilles flottent à côté du trait. Sur la première section que voit un
 * visiteur.
 *
 * Ce fichier vérifie donc les invariants que l'œil ne contrôle pas à chaque
 * déploiement : le chemin est numériquement valide, il MONTE, et les cinq
 * jalons sont bien rendus avec leur état.
 */

const MILESTONES: Milestone[] = [
  { icon: "document", title: "Trades", sub: "45 s", state: "done" },
  { icon: "chart", title: "Data", sub: "20+ métriques", state: "done" },
  { icon: "radar", title: "Patterns", sub: "Schémas détectés", state: "now" },
  { icon: "brain", title: "Insights", sub: "Biais nommés", state: "next" },
  { icon: "target", title: "Décisions", sub: "Tu progresses", state: "next" },
];

const html = renderToStaticMarkup(
  <LandingLangProvider>
    <JourneyCurve milestones={MILESTONES} />
  </LandingLangProvider>,
);

/** Le `d` du tracé principal, extrait du rendu. */
function curvePath(): string {
  const paths = [...html.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
  // Le premier chemin est la surface sous la courbe (elle se referme par un
  // `Z`) ; le second est le trait lui-même.
  const stroke = paths.find((d) => !d.includes("Z"));
  if (!stroke) throw new Error("aucun tracé de courbe dans le rendu");
  return stroke;
}

describe("la courbe du parcours", () => {
  test("produit un chemin numériquement valide", () => {
    const d = curvePath();
    // Aucun NaN, aucun undefined : c'est le mode d'échec d'un calcul de Bézier
    // qui a perdu un point, et il rend un `path` que le navigateur ignore
    // SILENCIEUSEMENT.
    expect(d).not.toMatch(/NaN|undefined|Infinity/);
    // Un M puis quatre C pour cinq points.
    expect(d.startsWith("M ")).toBe(true);
    expect((d.match(/C /g) ?? []).length).toBe(MILESTONES.length - 1);
  });

  test("MONTE — c'est tout le propos du composant", () => {
    // En SVG, l'axe Y descend : « monter » signifie donc que l'ordonnée du
    // dernier point est PLUS PETITE que celle du premier. Une inversion de
    // signe rendrait une courbe qui dégringole, sur une section qui promet une
    // progression.
    const d = curvePath();
    const nums = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    const firstY = nums[1];
    const lastY = nums[nums.length - 1];
    expect(lastY).toBeLessThan(firstY);
  });

  test("rend un jalon par étape, deux fois — la courbe et la colonne", () => {
    // Le composant rend DEUX mises en page (la courbe ≥768px, la colonne en
    // dessous) et masque l'une des deux en CSS. Chaque titre apparaît donc
    // exactement deux fois : si l'une des deux disparaît, un téléphone ou un
    // écran large se retrouve sans parcours du tout.
    for (const m of MILESTONES) {
      expect((html.match(new RegExp(m.title, "g")) ?? []).length).toBe(2);
    }
  });

  test("nomme l'état de chaque jalon", () => {
    // Les pastilles sont l'information du composant : sans elles, la courbe
    // n'est qu'une décoration.
    expect(html).toContain("Covered");
    expect(html).toContain("In progress");
    expect(html).toContain("Next");
  });

  test("n'écrit aucune couleur en dur — la vitrine a ses jetons", () => {
    // Le fond dégradé et les nœuds doivent passer par `--lp-*`, sinon la
    // vitrine cesse de se reteinter depuis `landing.css`.
    expect(html).not.toMatch(/#[0-9a-f]{6}\b/i);
    expect(html).toContain("--lp-accent");
  });
});

/**
 * LA MAQUETTE PRODUIT DU HÉROS.
 *
 * Elle porte deux choses qui peuvent mentir en silence :
 *
 *   • la JAUGE de répartition. Sa largeur et le pourcentage écrit à côté sont
 *     posés séparément. S'ils divergent, la barre affiche une part et le texte
 *     en annonce une autre — sur la première image que voit un visiteur, à
 *     propos de chiffres. C'est le genre d'écart qu'aucun typage n'attrape.
 *
 *   • le CHROME. Le rail et la barre de tête sont ce qui fait lire le visuel
 *     comme une application plutôt que comme une illustration ; s'ils
 *     disparaissent, il ne reste qu'une carte.
 */
describe("la maquette produit", () => {
  test("la jauge de répartition porte EXACTEMENT la part annoncée", () => {
    const rows = [
      { label: "Breakout", pct: 42 },
      { label: "Reversal", pct: 31 },
    ];
    const out = renderToStaticMarkup(<SetupSplit rows={rows} />);
    for (const r of rows) {
      expect(out).toContain(`width:${r.pct}%`);
      expect(out).toContain(`${r.pct}%<`);
    }
  });

  test("le chrome rend son rail et sa barre de tête", () => {
    const out = renderToStaticMarkup(
      <ProductChrome navLabels={["Analytics", "Journal", "Jarvis", "Discipline"]}>
        <p>contenu</p>
      </ProductChrome>,
    );
    expect(out).toContain("TradeVault");
    expect(out).toContain("<nav");
    for (const l of ["Analytics", "Journal", "Jarvis", "Discipline"]) expect(out).toContain(l);
    expect(out).toContain("contenu");
  });
});

/**
 * L'AGENCEMENT ÉDITORIAL.
 *
 * Deux motifs dont l'échec est SILENCIEUX — la page continue de s'afficher,
 * simplement en moins bien, ce qu'aucun typage ni aucun lint n'attrape.
 */
describe("l'agencement éditorial", () => {
  test("la bande de chiffres garde la technique des filets d'1px", () => {
    // Le liseré n'est PAS une bordure par cellule : c'est le fond du conteneur
    // qui transparaît dans les interstices de `gap-px`. Inverser les deux
    // couleurs — conteneur en fond de page, cellules en couleur de liseré —
    // rend une grille invisible, et rien ne le signale.
    const out = renderToStaticMarkup(<StatStrip items={[{ value: "2 min", label: "Setup" }]} />);
    expect(out).toMatch(/gap-px[^"]*bg-\[var\(--lp-line\)\]/);
    expect(out).toContain("bg-[var(--lp-ink)]");
  });

  test("la section coupe bien la grille en douze, de façon ASYMÉTRIQUE", () => {
    // Une coupe 6/6 redonnerait deux colonnes égales — donc aucune hiérarchie,
    // exactement ce que la refonte corrige.
    const out = renderToStaticMarkup(
      <EditorialSection eyebrow="Test" title="Titre">
        <p>contenu</p>
      </EditorialSection>,
    );
    expect(out).toContain("grid-cols-12");
    expect(out).toContain("lg:col-span-4");
    expect(out).toContain("lg:col-span-8");
    expect(out).not.toContain("lg:col-span-6");
    // Le titre reste en place pendant que le contenu défile.
    expect(out).toContain("lg:sticky");
  });
});
