import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { readSource, stripComments } from "./helpers/source";

/**
 * GLISSE — LE VERRE LIQUIDE D'iOS 26, BRANCHÉ PROPREMENT.
 *
 * La bibliothèque `glisse` (MIT) fournit les contrôles. Ce qui ne doit pas
 * dériver autour d'elle :
 *   1. elle n'entre que par les primitives de `shared/ui` (une seule porte) ;
 *   2. sa version est épinglée, et notre correctif lui est appliqué ;
 *   3. ses styles sont rangés en couche, et sa copie injectée est neutralisée ;
 *   4. son thème sombre et le pont de jetons vers TradeVault sont en place ;
 *   5. aucun texte anglais codé en dur de Glisse n'atteint l'écran.
 */

const ROOT = join(import.meta.dir, "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const css = stripComments(readSource(import.meta.dir, "../src/styles.css"));
const root = readSource(import.meta.dir, "../src/routes/__root.tsx");

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sources(path));
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

describe("Glisse", () => {
  test("n'est importé que par les primitives de shared/ui", () => {
    const fautifs = sources(join(ROOT, "src"))
      .filter((file) => /from "glisse"/.test(readFileSync(file, "utf8")))
      .map((file) => relative(ROOT, file))
      .filter((file) => !file.startsWith("src/shared/ui/"));
    expect(fautifs).toEqual([]);
  });

  test("version épinglée, correctif appliqué", () => {
    expect(pkg.dependencies.glisse).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.patchedDependencies?.[`glisse@${pkg.dependencies.glisse}`]).toBe(
      `patches/glisse@${pkg.dependencies.glisse}.patch`,
    );
    const patch = readFileSync(
      join(ROOT, `patches/glisse@${pkg.dependencies.glisse}.patch`),
      "utf8",
    );
    // Les trois moteurs à geste attendent leurs nœuds (mode strict + Suspense).
    expect(patch).toContain("waiting = requestAnimationFrame(start)");
    expect(patch).toContain("waitingSlider = requestAnimationFrame(startSlider)");
    expect(patch).toContain("waitingSwitch = requestAnimationFrame(startSwitch)");
    // La ref de la barre passe APRÈS les props : une `ref` reçue en prop
    // (React 19, outils de développement) ne l'écrase plus.
    expect(patch).toMatch(/-\s*ref: barRef,/);
    expect(patch).toMatch(/\.\.\.props,\n(?:\+[^\n]*\n){0,4}\+\s*ref: barRef,/);
    // Aucune réfraction du fond vivant : un filtre SVG recalculé sous chaque
    // bouton à chaque image de défilement rendait le site lent.
    expect(patch).toContain("+const refractsBackdrop = () => false;");
    // Le gonflement à l'appui reste celui de Glisse (iOS), sans surenchère.
    expect(patch).not.toMatch(/\+\s*grow:/);
  });

  test("ses styles sont rangés en couche, sa copie injectée neutralisée", () => {
    expect(readSource(import.meta.dir, "../src/styles.css")).toContain(
      '@import "glisse/styles.css" layer(components);',
    );
    expect(root).toContain('<style id="glisse-styles" />');
  });

  test("version sombre et pont de jetons vers TradeVault", () => {
    expect(root).toContain('<body data-theme="dark">');
    for (const token of ["--lg-fill", "--lg-on", "--lg-destructive", "--lg-ring"]) {
      expect(css, token).toMatch(new RegExp(`${token}:\\s*(var\\(--tv-|rgb\\(var\\(--tv-)`));
    }
  });

  test("aucun texte anglais en dur de Glisse à l'écran", () => {
    // `SearchField` de Glisse écrit « Search » et « Clear » : on utilise le
    // nôtre, qui prend ses textes de l'appelant.
    const controls = readSource(import.meta.dir, "../src/shared/ui/GlassControls.tsx");
    expect(controls).not.toMatch(/SearchField as|SearchField,\s*\n?\s*\} from "glisse"/);
    expect(controls).toContain("clearLabel");
  });

  test("la bulle, sobre : verre plat, liseré fin, aucun flou sur les contrôles", () => {
    // Le bloc « LA BULLE, SOBRE » de styles.css (commentaires retirés).
    const debut = css.indexOf(".lg-glass,\n.rail-glass::before {");
    expect(debut).toBeGreaterThan(-1);
    const bloc = css.slice(debut, css.indexOf(".lg-button.tv-mobile-action {", debut));
    // Ni flou ni réfraction sous les contrôles de Glisse et le rail : c'est ce
    // qui coûtait des images à chaque défilement.
    expect(bloc).toMatch(/\.lg-glass,\s*\.rail-glass::before\s*\{[^}]*backdrop-filter:\s*none/);
    // Ni éclat, ni dégradé, ni ombre portée : propre, pas brillant.
    expect(bloc).not.toContain("linear-gradient(");
    expect(bloc).not.toContain("box-shadow");
    // Un liseré discret et un verre à peine plus clair que la carte.
    const shine = Number(css.match(/--lg-rim-shine:\s*(0\.\d+)/)?.[1]);
    expect(shine).toBeLessThanOrEqual(0.3);
    const verre = Number(css.match(/--lg-glass:\s*rgb\(255 255 255 \/ (0\.\d+)\)/)?.[1]);
    expect(verre).toBeLessThanOrEqual(0.08);
  });
});
