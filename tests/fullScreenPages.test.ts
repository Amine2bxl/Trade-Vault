import { describe, expect, test } from "bun:test";
import { readSource, stripComments } from "./helpers/source";

/**
 * UNE APP, PAS DES PAGES QUI DÉFILENT — SANS RIEN ÉCRASER.
 *
 * ── LA DÉCISION ─────────────────────────────────────────────────────────────
 *
 * Sur ordinateur, une page de TradeVault tient dans la fenêtre : son cadre
 * reçoit la hauteur MESURÉE par `useAvailableHeight()` (`PageContainer fit`),
 * l'en-tête et les commandes restent en place, et ce qui est long par nature
 * défile DANS sa région (`ScrollArea` / `tv-scroll`, ou une carte en
 * `overflow-y-auto`). Téléphone et fenêtres basses : flux normal.
 *
 * ── LE BUG QUI NE DOIT PAS REVENIR ──────────────────────────────────────────
 *
 * La première tentative d'ajuster le calendrier avait écrasé son contenu :
 * `style={{ height }}` + `overflow-hidden` + `min-h-0` le long de la chaîne
 * flex — les lignes de semaine tombaient à quelques pixels pendant que leurs
 * cellules gardaient leur hauteur, et rien ne pouvait défiler pour compenser.
 * La règle d'alors (« la hauteur est un minimum, le cadre défile ») est
 * remplacée par celle-ci, qui garde la même garantie : la hauteur est celle de
 * la PAGE, et une région INTERNE défile — le contenu n'est jamais comprimé
 * sous son plancher.
 */

const read = (p: string) => stripComments(readSource(import.meta.dir, p));

/** Les pages ajustées à l'écran par `PageContainer fit`. */
const PAGES = [
  { nom: "Calendrier", chemin: "../src/app/features/calendar/CalendarPage.tsx" },
  { nom: "Monte-Carlo", chemin: "../src/app/features/monte-carlo/MonteCarlo.tsx" },
  { nom: "Erreurs", chemin: "../src/app/features/mistakes/Mistakes.tsx" },
  { nom: "Saisonnalité", chemin: "../src/app/features/seasonality/Seasonality.tsx" },
  { nom: "Analytics", chemin: "../src/app/features/analytics/Analytics.tsx" },
  { nom: "Rapport mensuel", chemin: "../src/app/features/reports/Reports.tsx" },
  { nom: "Calendrier économique", chemin: "../src/app/features/news/EconomicNews.tsx" },
  { nom: "Calculateur", chemin: "../src/app/features/calculator/LotSizeCalculator.tsx" },
  { nom: "Objectifs", chemin: "../src/app/features/goals/Goals.tsx" },
  { nom: "Apparence", chemin: "../src/app/features/settings/Appearance.tsx" },
  { nom: "Brokers", chemin: "../src/app/features/brokers/Brokers.tsx" },
] as const;

describe("les pages ajustées à l'écran", () => {
  for (const { nom, chemin } of PAGES) {
    describe(nom, () => {
      const src = read(chemin);

      test("mesure sa hauteur au lieu de la deviner", () => {
        expect(src).toContain("useAvailableHeight()");
      });

      test("le cadre mesuré est la page ajustée", () => {
        // Le cadre est le premier élément à porter `ref={boxRef}` : c'est lui
        // qui reçoit la hauteur, en mode `fit`.
        const cadre = src.slice(src.indexOf("ref={boxRef}"));
        const finDuCadre = cadre.slice(0, cadre.indexOf(">"));
        expect(finDuCadre).toContain("fit");
        expect(finDuCadre).toContain("height={height}");
        expect(finDuCadre).not.toContain("overflow-hidden");
      });

      test("ce qui dépasse défile dans une région interne, jamais écrasé", () => {
        const region = /ScrollArea|tv-scroll|overflow-y-auto/.test(src);
        expect(region).toBe(true);
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
  const chart = read("../src/app/features/monte-carlo/StrategyChart.tsx");
  const details = read("../src/app/features/monte-carlo/StrategyDetails.tsx");
  test("le nuage raster et le SVG principal ont une hauteur réelle, indépendante du parent", () => {
    expect(chart).toMatch(/const PLOT_HEIGHT = [1-9]\d*/);
    expect(chart).toContain("style={{ height: PLOT_HEIGHT }}");
    expect(chart).toContain("height={PLOT_HEIGHT}");
    expect(chart).toContain("pixelHeight = Math.round(PLOT_HEIGHT * dpr)");
    expect(chart).toContain("height: pixelHeight");
    const raster = read("../src/app/features/monte-carlo/cloud.worker.ts");
    expect(raster).toContain("new OffscreenCanvas(width, height)");
  });
  test("les graphes détaillés gardent des parents de hauteur définie", () => {
    const parts = details.split("<ResponsiveContainer");
    expect(parts.length - 1).toBeGreaterThanOrEqual(2);
    expect(details).toMatch(/const H_DISTRIB = "h-\[\d+px\]"/);
    for (let i = 1; i < parts.length; i++) expect(parts[i - 1].slice(-300)).toContain("H_DISTRIB");
  });
  test("les cinq percentiles calculés atteignent les bandes et la médiane", () => {
    const engine = read("../src/modules/probability/strategy.ts");
    for (const [p, q] of [
      ["p5", "0.05"],
      ["p25", "0.25"],
      ["p50", "0.5"],
      ["p75", "0.75"],
      ["p95", "0.95"],
    ])
      expect(engine).toContain(`${p}: percentile(column, ${q})`);
    expect(chart).toContain('area("p5", "p95")');
    expect(chart).toContain('area("p25", "p75")');
    expect(chart).toContain('path("p50")');
  });
});

describe("la grille du calendrier", () => {
  const src = read("../src/app/features/calendar/CalendarPage.tsx");

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
