import { describe, expect, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { readSource, stripComments } from "./helpers/source";

/**
 * LA RÈGLE DES CARTES STATIQUES, RENDUE VÉRIFIABLE.
 *
 * Une surface qui affiche un libellé, un chiffre et une mention — et qui n'a
 * AUCUNE interaction — est compacte : c'est `Kpi`, la primitive de
 * `shared/ui`. Elle n'a pas le rembourrage d'une carte pleine, pas de survol
 * (il n'y a rien à survoler) et pas le rayon d'une carte. Ce qui a le droit de
 * grandir, ce sont les surfaces qui portent une action, un graphe ou une vraie
 * complexité.
 *
 * ── POURQUOI UN TEST, ET PAS SEULEMENT UNE CONVENTION ─────────────────────
 *
 * Parce que la convention a déjà échoué une fois. `Kpi` existait, documentée,
 * et six pages continuaient de redessiner la même case à la main — Journal
 * (`SummaryTile`), Setups manqués (`MissedTile`), Simulateur (`Stat`),
 * Calendrier, Saisonnalité (`HighlightCard`), et les deux blocs chiffrés de
 * Jarvis. Chaque copie avait sa propre plaque, son propre rembourrage et sa
 * propre dérive ; deux d'entre elles s'éclaircissaient même au survol, ce qui
 * dans ce produit annonce « je réponds au clic » alors qu'elles ne répondent à
 * rien.
 *
 * Redessiner la case est facile et invisible en revue : c'est une poignée
 * d'utilitaires Tailwind qui ressemblent à ceux d'à côté. Ce test rend le
 * raccourci VISIBLE — une page listée ici qui perdrait `Kpi` échoue, et
 * l'auteur doit décider explicitement plutôt que laisser filer.
 */

const APP = resolve(import.meta.dir, "..", "src", "app");

/**
 * Les surfaces qui affichent une rangée de cases statiques. Le jour où l'une
 * d'elles cesse d'en afficher, on retire la ligne — c'est une décision, pas un
 * test à contourner.
 */
const PORTENT_KPI = [
  "pages/Analytics.tsx",
  "pages/CalendarPage.tsx",
  "pages/Journal.tsx",
  "pages/MissedOpportunities.tsx",
  "pages/MonteCarlo.tsx",
  "pages/Reports.tsx",
  "pages/Seasonality.tsx",
  "pages/Simulator.tsx",
  "pages/Subscription.tsx",
  "components/jarvis/BlockRenderer.tsx",
];

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full));
    else if (/\.tsx$/.test(full) && !full.includes("/tests/")) out.push(full);
  }
  return out;
}

const read = (rel: string) => stripComments(readSource(APP, rel));

describe("les cases statiques passent par la primitive", () => {
  for (const file of PORTENT_KPI) {
    test(`${file} affiche ses chiffres avec Kpi`, () => {
      const code = read(file);
      expect(code).toContain("<Kpi");
      // Importée depuis le design system, jamais redéfinie localement.
      expect(code).toMatch(/import\s*\{[^}]*\bKpi\b[^}]*\}\s*from\s*"@\/shared\/ui"/);
    });
  }
});

describe("aucune copie locale de la case", () => {
  /**
   * `.tv-kpi` EST la plaque de la case : `var(--tv-plate-1)` + `var(--tv-border)`
   * + un rayon. Le motif interdit ici est la SIGNATURE de l'ancienne copie —
   * `stat-card` accompagné d'un rembourrage serré écrit à la main. C'est ce
   * qu'écrivaient `SummaryTile` et les six cases du Calendrier, et c'est ce
   * qu'un prochain contributeur réécrira s'il ne trouve pas `Kpi`.
   *
   * On ne teste pas les tuiles HÉROS : `Metric` porte une jauge, un pied et un
   * survol, et le Tableau de bord en est la référence assumée.
   */
  const COPIE = /\bstat-card\b[^"'`]*\bp[xy]?-[123](?:\.5)?\b/;

  test("personne ne redessine la plaque de `Kpi` à la main", () => {
    const coupables = filesUnder(APP)
      .filter((f) => COPIE.test(stripComments(readSource(APP, relative(APP, f)))))
      .map((f) => relative(APP, f));
    expect(coupables).toEqual([]);
  });
});
