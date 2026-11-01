import { describe, expect, test } from "bun:test";
import { readSource, stripComments } from "./helpers/source";
import { pressScale } from "../src/shared/ui/press";

/**
 * LE MOUVEMENT LIQUID — CE QUI NE DOIT PAS DÉRIVER.
 *
 * Les gestes d'iOS 27 et de Revolut ne tiennent que s'ils restent les mêmes
 * partout : un seul moteur d'appui, une seule pilule qui glisse, une sortie
 * pour chaque modale, et la loi du mouvement (transform/opacity, mouvement
 * réduit) respectée par chacun.
 */

const css = stripComments(readSource(import.meta.dir, "../src/styles.css"));
const press = readSource(import.meta.dir, "../src/shared/ui/press.ts");
const glide = readSource(import.meta.dir, "../src/shared/ui/useGlidingIndicator.ts");
const modal = readSource(import.meta.dir, "../src/shared/ui/Modal.tsx");
const root = readSource(import.meta.dir, "../src/routes/__root.tsx");

describe("l'appui", () => {
  test("l'amplitude suit la taille de l'objet, bornée", () => {
    // Un bouton : le jeton `--tv-press`.
    expect(pressScale(44, 44)).toBe(0.97);
    expect(pressScale(120, 40)).toBe(0.97);
    // Une rangée pleine largeur s'enfonce moins…
    expect(pressScale(400, 56)).toBeCloseTo(0.988, 3);
    // …et une très grande surface garde un enfoncement lisible.
    expect(pressScale(1600, 300)).toBe(0.992);
    // Jamais plus profond que 0,97, quoi qu'il arrive.
    expect(pressScale(0, 0)).toBe(0.97);
  });

  test("un seul moteur, posé une fois à la racine", () => {
    expect(root).toContain("installPressFeedback()");
  });

  test("il n'anime que `scale`, sur les jetons de durée", () => {
    const keyframes = [...press.matchAll(/animate\(\s*\[([^\]]*)\]/g)].map((m) => m[1]);
    expect(keyframes.length).toBeGreaterThan(0);
    for (const k of keyframes) {
      const props = [...k.matchAll(/(\w+):/g)].map((m) => m[1]);
      expect(props.every((p) => p === "scale")).toBe(true);
    }
    expect(press).toContain("const PRESS_MS = 120;");
    expect(press).toContain("const RELEASE_MS = 340;");
  });

  test("il respecte le mouvement réduit et le désactivé", () => {
    expect(press).toContain("(prefers-reduced-motion: reduce)");
    expect(press).toContain("reduce.matches");
    expect(press).toContain('"[disabled]"');
    expect(press).toContain("'[aria-disabled=\"true\"]'");
  });

  test("aucune pression CSS ne double celle du moteur", () => {
    // Les objets que le moteur enfonce ne gardent pas leur ancien
    // `:active { transform: scale(…) }` : l'enfoncement serait appliqué deux
    // fois (0,97 × 0,97).
    for (const sel of [
      ".btn-primary:active",
      ".btn-ghost:active",
      ".jarvis-suggestion:active",
      ".tv-interactive:active",
      ".trade-card:active",
      ".cal-nav-btn:active",
    ]) {
      const re = new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^{]*\\{([^}]*)\\}`, "g");
      for (const m of css.matchAll(re)) expect(m[1]).not.toMatch(/transform\s*:/);
    }
  });
});

describe("la pilule qui glisse", () => {
  test("les trois contrôles segmentés la partagent", () => {
    for (const file of [
      "../src/app/shell/SectionTabs.tsx",
      "../src/shared/ui/SubNav.tsx",
      "../src/app/features/dashboard/Dashboard.tsx",
    ]) {
      const src = readSource(import.meta.dir, file);
      expect(src).toContain("useGlidingIndicator");
      expect(src).toContain("tv-glide-ready");
    }
  });

  test("elle se lit sur l'état ARIA, sans seconde vérité", () => {
    expect(glide).toContain('[aria-selected="true"]');
    expect(glide).toContain('[aria-pressed="true"]');
  });

  test("elle glisse sur le ressort, et s'arrête sous mouvement réduit", () => {
    expect(css).toMatch(
      /\.tv-glide-ready\s*\{[^}]*transform var\(--tv-dur-spring\) var\(--tv-spring\)/,
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.tv-glide-ready\s*\{\s*transition:\s*none/,
    );
  });
});

describe("l'interrupteur", () => {
  test("le pouce s'étire sous le doigt, sauf sous mouvement réduit", () => {
    expect(css).toMatch(
      /\.tv-switch:not\(:disabled\):active \.tv-switch-knob\s*\{\s*scale:\s*1\.18 1/,
    );
    expect(css).toMatch(
      /prefers-reduced-motion: reduce[^@]*\.tv-switch:not\(:disabled\):active \.tv-switch-knob\s*\{\s*scale:\s*none/,
    );
  });
});

describe("la sortie des modales", () => {
  const ghost = readSource(import.meta.dir, "../src/shared/ui/exitGhost.ts");

  test("chaque fermeture passe par le fantôme, pris avant le retrait du DOM", () => {
    // Ouverte ou démontée par son parent, la modale passe par sa surface, dont
    // le nettoyage de mise en page prend la copie.
    expect(modal).toContain('if (!props.open || typeof document === "undefined") return null;');
    expect(modal).toMatch(
      /useLayoutEffect\(\(\) => \{\s*const wrap = wrapRef\.current;\s*return \(\) => snapshotExit\(wrap\);/,
    );
  });

  test("le fantôme est inerte, borné dans le temps, et absent en mode strict", () => {
    expect(ghost).toContain('ghost.setAttribute("inert", "")');
    expect(ghost).toContain("if (wrap.isConnected) return;");
    expect(ghost).toMatch(/setTimeout\(remove, GHOST_MAX_MS\)/);
  });

  test("la sortie dure ~70 % de l'entrée, en transform/opacity, hors mouvement réduit", () => {
    expect(ghost).toContain("dialog: 140, sheet: 240");
    expect(ghost).toContain("(prefers-reduced-motion: reduce)");
    const frames = [...ghost.matchAll(/\{ opacity: [01](?:, transform: "[^"]*")? \}/g)];
    expect(frames.length).toBeGreaterThanOrEqual(4);
    // Les images-clés de sortie ne touchent que `opacity` et `transform`.
    for (const name of ["DIALOG_OUT", "SHEET_OUT"]) {
      const body =
        ghost.match(new RegExp(`const ${name}: Keyframe\\[\\] = \\[([^\\]]*)\\]`))?.[1] ?? "";
      const keys = [...body.matchAll(/(\w+):/g)].map((m) => m[1]);
      expect(keys.length).toBeGreaterThan(0);
      expect(keys.every((k) => k === "opacity" || k === "transform")).toBe(true);
    }
  });
});

describe("la cascade des listes", () => {
  test("elle utilise la seule entrée autorisée, plafonnée, hors mouvement réduit", () => {
    const m = css.match(
      /@media \(prefers-reduced-motion: no-preference\)\s*\{\s*:is\(\.dash-list, \.tv-missed-list, \.tv-set-list\)[^@]*/,
    );
    expect(m).not.toBeNull();
    const block = m![0];
    expect(block).toContain("animation: fade-in-up");
    expect(block).toContain(":nth-child(n + 6)");
    // `backwards` : la rangée arrivée rend son `transform` à l'appui.
    expect(block).toContain("backwards");
  });
});

describe("la loi du mouvement", () => {
  test("jamais `transition: all`", () => {
    expect(css).not.toMatch(/transition:\s*all\b/);
    expect(css).not.toMatch(/transition-property:\s*all\b/);
  });
});
