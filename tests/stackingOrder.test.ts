import { describe, expect, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { readSource } from "./helpers/source";

/**
 * L'ORDRE D'EMPILEMENT.
 *
 * `styles.css` déclarait six jetons `--tv-z-*` — utilisés ZÉRO fois. Onze
 * composants choisissaient à la place leur propre nombre entre 50 et 200, et
 * l'ordre réel du produit n'était donc écrit nulle part : il fallait le
 * reconstituer en relevant les classes une par une.
 *
 * Ce n'est pas une question de style. Le TOAST était à 100 — sous la
 * confirmation (110), sous la modale de mise à niveau (110), sous la
 * célébration (120), sous la visionneuse et la modale d'inscription (200). Un
 * toast est un retour éphémère : caché, il n'est pas retardé, il est perdu.
 */

const src = resolve(import.meta.dir, "..", "src");
const styles = readSource(import.meta.dir, "../src/styles.css");

/** Les jetons déclarés, avec leur valeur. */
function tokens(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [, name, value] of styles.matchAll(/--tv-z-([a-z0-9-]+):\s*(\d+);/g)) {
    out[name] = Number(value);
  }
  return out;
}

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("l'échelle est déclarée en un seul endroit", () => {
  const scale = tokens();

  test("elle couvre tout le produit, du rail au toast", () => {
    expect(Object.keys(scale).sort()).toEqual(
      [
        "fab",
        "float",
        "modal",
        "modal-nested",
        "modal-top",
        "nav",
        "overlay",
        "rail",
        "sheet",
        "toast",
        "top",
      ].sort(),
    );
  });

  test("les couches sont strictement ordonnées", () => {
    // Deux couches à la même valeur, c'est un ordre décidé par l'ordre du DOM :
    // exactement ce que cette échelle existe pour éviter.
    const ladder = [
      "rail",
      "float",
      "nav",
      "fab",
      "sheet",
      "modal",
      "modal-nested",
      "modal-top",
      "overlay",
      "top",
      "toast",
    ];
    const values = ladder.map((k) => scale[k]);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(new Set(values).size).toBe(values.length);
  });

  test("le toast est AU-DESSUS DE TOUT", () => {
    // C'est le défaut corrigé, et celui qui reviendrait le plus facilement :
    // il suffit qu'une nouvelle modale se donne un nombre plus grand.
    const others = Object.entries(scale).filter(([k]) => k !== "toast");
    for (const [name, value] of others) {
      expect(scale.toast, `--tv-z-toast doit dominer --tv-z-${name}`).toBeGreaterThan(value);
    }
  });

  test("aucun jeton déclaré n'est décoratif", () => {
    // C'était l'état de départ : six jetons déclarés, aucun utilisé. Une
    // échelle que personne n'emploie ne documente rien — elle ment.
    const code = tsxFiles(src)
      .map((f) => readSource(import.meta.dir, relative(import.meta.dir, f)))
      .join("\n");
    for (const name of Object.keys(scale)) {
      expect(code, `--tv-z-${name}`).toContain(`z-[var(--tv-z-${name})]`);
    }
  });
});

describe("plus personne ne devine un nombre", () => {
  test("aucun composant ne réinvente une couche de superposition", () => {
    // Sous 30, `z-index` sert à empiler des éléments DANS une carte (un badge
    // au-dessus d'une image) : ce n'est pas de l'ordre d'application, et le
    // centraliser n'apporterait rien. Au-dessus, c'est une couche du produit —
    // et elle doit venir de l'échelle.
    const offenders: string[] = [];
    for (const file of tsxFiles(src)) {
      const code = readSource(import.meta.dir, relative(import.meta.dir, file));
      for (const [match, bracketed, bare] of code.matchAll(
        /\bz-(?:\[(\d+)\]|(\d+))(?![\w[])/g,
      ) as IterableIterator<RegExpMatchArray>) {
        const value = Number(bracketed ?? bare);
        if (value >= 30) offenders.push(`${relative(src, file)} → ${match}`);
      }
    }
    // `Analytics.tsx` garde un `z-30` : une infobulle `absolute` positionnée
    // dans sa carte, pas une couche de l'application.
    expect(offenders).toEqual(["app/pages/Analytics.tsx → z-30"]);
  });
});
