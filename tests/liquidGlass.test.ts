import { describe, expect, test } from "bun:test";
import { readSource, stripComments } from "./helpers/source";
import { BUILTIN_THEMES, DEFAULT_THEME_ID } from "../src/app/utils/themes";

/**
 * LE LANGAGE « LIQUID » — CE QUI NE DOIT PAS DÉRIVER.
 *
 * Le verre est la seule matière translucide du produit, et il est réservé à la
 * COUCHE DE NAVIGATION (rail, barre mobile, en-tête collant, menus, feuilles).
 * Trois dérives se glissent facilement en revue, et aucune ne casse un rendu :
 *
 *   1. un `backdrop-filter` posé sur une CARTE de contenu — un chiffre se lit
 *      alors à travers un flou, et la page entière se re-floute au défilement ;
 *   2. un flou sans REPLI — sans `backdrop-filter` (ou avec la transparence
 *      réduite demandée par le système), le verre devient un voile illisible ;
 *   3. une ombre COLORÉE par l'accent — un halo, que la loi interdit toujours.
 *
 * On vérifie aussi que le fond SSR (`:root`) reste celui du thème par défaut.
 */

const css = stripComments(readSource(import.meta.dir, "../src/styles.css"));
const selection = stripComments(readSource(import.meta.dir, "../src/shared/ui/selection.css"));

/** Les règles `sélecteur { corps }` de premier niveau ou imbriquées d'un bloc. */
function rules(source: string): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) out.push({ selector: m[1].trim(), body: m[2] });
  return out;
}

const all = [...rules(css), ...rules(selection)];

describe("le langage Liquid", () => {
  test("le fond SSR est celui du thème par défaut", () => {
    const lucid = BUILTIN_THEMES.find((theme) => theme.id === DEFAULT_THEME_ID);
    expect(lucid?.background).toBe("#050607");
    expect(css).toMatch(/--tv-bg:\s*#050607;/);
  });

  test("le matériau verre est déclaré une fois, en jetons", () => {
    for (const token of [
      "--tv-glass-fill",
      "--tv-glass-fill-solid",
      "--tv-glass-fill-strong",
      "--tv-glass-blur",
      "--tv-glass-edge",
      "--tv-glass-specular",
      "--tv-spring",
    ]) {
      expect(css, token).toContain(`${token}:`);
    }
  });

  test("aucune carte de contenu ne porte de verre", () => {
    const cartes = /(^|[\s,])\.(glass|panel|stat-card|stat-card-elevated|card-premium)(?![\w-])/;
    const fautives = all.filter(
      (r) => /backdrop-filter:\s*blur/.test(r.body) && cartes.test(r.selector),
    );
    expect(fautives.map((r) => r.selector)).toEqual([]);
  });

  test("chaque matériau flouté a son repli opaque", () => {
    const sansFlou = css.match(
      /@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\)/g,
    );
    const transparenceReduite = css.match(/@media \(prefers-reduced-transparency: reduce\)/g);
    expect(sansFlou?.length ?? 0).toBeGreaterThanOrEqual(5);
    expect(transparenceReduite?.length ?? 0).toBeGreaterThanOrEqual(5);
    expect(selection).toContain("prefers-reduced-transparency: reduce");
  });

  test("aucune ombre ne rayonne dans la couleur de l'accent", () => {
    /* Un HALO est une couche extérieure, floutée, teintée par l'accent. Un
       anneau interne (`inset 0 0 0 1px …`) ou un anneau de focus sans flou
       restent permis : ils dessinent un contour, ils n'éclairent rien. */
    const estHalo = (couche: string) => {
      const c = couche.trim();
      if (!c.includes("--tv-accent-rgb") || c.startsWith("inset")) return false;
      const longueurs = c.split("rgb(")[0].trim().split(/\s+/);
      return parseFloat(longueurs[2] ?? "0") > 0;
    };
    const halos = all.filter((r) =>
      [...r.body.matchAll(/box-shadow:([^;]*);/g)].some((m) => m[1].split(",").some(estHalo)),
    );
    expect(halos.map((r) => r.selector)).toEqual([]);
  });

  test("le bouton d'action est la capsule pleine de Glisse, texte blanc", () => {
    // Depuis Glisse (iOS 26) : une CAPSULE pleine à l'accent du thème, texte
    // blanc porté par une ombre de lettre courte (contraste sur la menthe).
    const primary = all.find((r) => r.selector === ".btn-primary");
    expect(primary?.body).toContain("border-radius: 9999px");
    expect(primary?.body).toContain("background: var(--lg-fill)");
    expect(primary?.body).toContain("color: #ffffff");
    const shadowed = all.find((r) => r.selector.includes('.lg-button[data-variant="filled"]'));
    expect(shadowed?.body).toContain("text-shadow");
  });

  test("ActionButton est une primitive partagée", () => {
    const index = readSource(import.meta.dir, "../src/shared/ui/index.ts");
    expect(index).toContain('export { ActionButton } from "./ActionButton";');
  });
});
