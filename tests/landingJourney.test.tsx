import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { JourneyCurve, type Milestone } from "../src/app/pages/landing/Sections";
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
