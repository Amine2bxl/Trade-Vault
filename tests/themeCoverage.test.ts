import { describe, expect, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { readSource, stripComments } from "./helpers/source";

/**
 * CE QUE LE STUDIO DE THÈMES REPEINT VRAIMENT.
 *
 * `computeThemeVars` pose `--tv-accent`, `--tv-accent-2` et `--tv-highlight`
 * sur la racine du document. Tout ce qui les référence suit donc le thème
 * choisi — et tout ce qui écrit le cyan par défaut en dur ne le suit PAS.
 *
 * Le produit faisait les deux : `Analytics`, `Dashboard` et `TradingPlan`
 * passaient déjà par les variables, pendant que l'anneau de compte à rebours
 * de la checklist, la jauge de crédits de Jarvis et le graphe de Monte-Carlo
 * restaient cyan quel que soit le thème. Un trader qui se choisit un thème
 * violet gardait trois taches cyan, sans savoir pourquoi.
 *
 * ── CE QUI RESTE ÉCRIT EN DUR, VOLONTAIREMENT ───────────────────────────────
 *
 * Toutes les couleurs ne sont pas de la marque. Les recenser ici oblige à
 * décider, plutôt qu'à laisser passer : ajouter un cyan en dur dans le produit
 * fait échouer ce fichier.
 */

const APP = resolve(import.meta.dir, "..", "src", "app");

/** Les trois couleurs par défaut du thème — celles que le studio remplace. */
const BRAND_HEX = /#(?:22d3ee|06b6d4|14b8a6|2dd4bf)/gi;

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full));
    else if (/\.tsx?$/.test(full) && !full.includes("/tests/")) out.push(full);
  }
  return out;
}

const read = (abs: string) => readSource(import.meta.dir, relative(import.meta.dir, abs));

describe("les surfaces réparées suivent le thème", () => {
  const FIXED = {
    "components/jarvis/components/CreditsBar.tsx": ["var(--tv-highlight)", "var(--tv-accent-2)"],
    "pages/MonteCarlo.tsx": ["var(--tv-highlight)"],
    "pages/Checklist.tsx": ["var(--tv-highlight)"],
  };

  for (const [file, expected] of Object.entries(FIXED)) {
    test(`${file} n'a plus de cyan en dur`, () => {
      const code = stripComments(read(join(APP, file)));
      expect(code.match(BRAND_HEX) ?? []).toEqual([]);
      for (const v of expected) expect(code).toContain(v);
    });
  }
});

describe("le lien entre la variable et le studio est réel", () => {
  test("les variables référencées sont bien celles que le studio écrit", () => {
    // Une variable que personne ne pose ne repeint rien : le composant
    // afficherait alors du transparent, pas du cyan — un « thème appliqué »
    // pire que le défaut.
    const themes = readSource(import.meta.dir, "../src/app/utils/themes.ts");
    for (const v of ["--tv-accent", "--tv-accent-2", "--tv-highlight"]) {
      expect(themes, v).toContain(`"${v}": theme.`);
    }
    expect(themes).toContain("root.style.setProperty");
  });
});

describe("l'inventaire de ce qui reste en dur", () => {
  test("chaque couleur de marque écrite en dur est une décision, pas un oubli", () => {
    /**
     * Fichier → pourquoi la variable serait FAUSSE ici.
     *
     * La vitrine (`pages/Landing.tsx`, `pages/landing/`) est hors périmètre :
     * elle s'affiche avant toute connexion, donc avant tout thème.
     */
    const DELIBERATE: Record<string, string> = {
      "utils/themes.ts":
        "la définition des thèmes intégrés — c'est la SOURCE des variables, elle ne peut pas s'y référer",
      "components/ThemeStudioModal.tsx":
        "les valeurs de repli des trois sélecteurs de couleur : leur rôle est précisément d'être un littéral",
      "onboarding/Onboarding.tsx":
        "les couleurs de départ d'un thème que le trader va créer — un thème neuf part du thème par défaut",
      "store/accounts.ts":
        "la couleur par défaut d'un COMPTE, écrite en base : une donnée, pas un style",
      "components/UpgradeSuccessOverlay.tsx":
        "la palette des confettis : décorative et multicolore, la réduire à l'accent l'appauvrirait",
      "pages/dashboard/CopilotBlock.tsx":
        "une échelle SÉMANTIQUE (rouge → ambre → cyan → vert selon le score) : ici le cyan veut dire « moyen », pas « marque »",
      "pages/Dashboard.tsx": "même échelle sémantique, sur le ratio risque/rendement",
      "components/ErrorScreen.tsx":
        "l'écran d'erreur double `shared/error-page.ts`, rendu par le serveur sans CSS de l'application : les deux doivent rester identiques",
    };

    const found: string[] = [];
    for (const file of filesUnder(APP)) {
      const rel = relative(APP, file);
      if (rel === "pages/Landing.tsx" || rel.startsWith("pages/landing/")) continue;
      if (stripComments(read(file)).match(BRAND_HEX)) found.push(rel);
    }

    expect(found.sort()).toEqual(Object.keys(DELIBERATE).sort());
  });
});
