import { describe, expect, test } from "bun:test";
import { readSource, stripComments } from "./helpers/source";

/**
 * L'APPLICATION N'EST MONTÉE QU'UNE FOIS, ET LA PREMIÈRE IMAGE EST LA BONNE.
 *
 * ── LES BUGS QUE CE FICHIER EMPÊCHE DE REVENIR ──────────────────────────────
 *
 * 1. LE REMONTAGE. `/` et `/$page` montaient chacune leur copie de `App`. La
 *    navigation de l'application passe par `history.pushState`, que le
 *    routeur intercepte : à chaque passage par le tableau de bord, React
 *    voyait un autre composant de route et démontait TOUTE l'application —
 *    session revérifiée, comptes rechargés, écran « Vérification du compte… »
 *    d'une image. Rien ne lève, rien ne casse un test de rendu : seule une
 *    lecture de la structure l'attrape.
 *
 * 2. LE ZOOM EN DEUX TEMPS. La barre de tête se garnissait APRÈS la peinture,
 *    et les pages plein écran mesuraient leur hauteur après la peinture puis
 *    la corrigeaient à +200 ms : la grille du calendrier passait de 556 à 688
 *    puis 698 px sous les yeux du trader.
 */
const read = (p: string) => stripComments(readSource(import.meta.dir, p));

describe("une seule instance de l'application", () => {
  test("les routes de l'application ne montent pas `App` elles-mêmes", () => {
    for (const route of ["../src/routes/index.tsx", "../src/routes/$page.tsx"]) {
      expect(read(route), route).not.toContain("@/app/shell/App");
    }
  });

  test("la racine l'héberge, pour toutes les adresses de l'application", () => {
    const root = read("../src/routes/__root.tsx");
    expect(root).toContain('import("@/app/shell/App")');
    expect(root).toContain("<AppHost");
    expect(root).toContain("isAppPath(pathname)");
  });
});

describe("la première image est la bonne", () => {
  test("la barre de tête se remplit avant la peinture", () => {
    const ctx = read("../src/app/contexts/PageActionsContext.tsx");
    expect(ctx).toContain("useLayoutEffect");
    expect(ctx).not.toMatch(/useEffect\(\(\) => \{\s*set\(/);
  });

  test("les pages plein écran mesurent avant la peinture, sans rattrapage minuté", () => {
    const hook = read("../src/app/hooks/useAvailableHeight.ts");
    expect(hook).toContain("useIsomorphicLayoutEffect(() => {");
    expect(hook).toContain("ResizeObserver");
    expect(hook).not.toContain("setTimeout(mesurer");
    const jarvis = read("../src/app/features/jarvis/Jarvis.tsx");
    expect(jarvis).toContain("observeLayout(el, mesurer)");
    expect(jarvis).not.toContain("setTimeout(mesurer");
  });

  test("le changement de page ne superpose pas deux glissements", () => {
    const css = readSource(import.meta.dir, "../src/styles.css");
    const regle = css.slice(css.indexOf(".page-in {"), css.indexOf("}", css.indexOf(".page-in {")));
    expect(regle).toContain("animation: fade-in ");
    expect(regle).not.toContain("translate");
  });
});
