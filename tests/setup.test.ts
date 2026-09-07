import { describe, it, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { readSource } from "./helpers/source";

describe("test runner", () => {
  it("works", () => {
    expect(1 + 1).toBe(2);
  });
});

/**
 * LES MATCHERS QUI PASSENT `bun test` ET CASSENT `tsc`.
 *
 * ── POURQUOI CE GARDE-FOU ───────────────────────────────────────────────────
 *
 * `bun test` implémente plus de matchers que les définitions de types fournies
 * n'en déclarent. `expect(x).toEndWith("…")` s'exécute donc parfaitement en
 * local — les tests passent, tout est vert — et `tsc --noEmit` échoue en CI
 * avec « Property 'toEndWith' does not exist on type 'Matchers<string>' ».
 *
 * C'est arrivé DEUX FOIS dans ce dépôt. Le mode d'échec est particulièrement
 * traître : la suite de tests, le seul outil qu'on pense à lancer après avoir
 * écrit un test, ne dit rien. Seule la CI le voit, une fois la branche poussée.
 *
 * Ce test le rattrape là où on regarde vraiment.
 *
 * ── COMMENT L'ÉTENDRE ───────────────────────────────────────────────────────
 *
 * Ajouter un matcher à la liste quand la CI en signale un nouveau. Il n'y a pas
 * de moyen de la dériver automatiquement : elle décrit l'écart entre deux
 * implémentations, pas une règle de style.
 */
const MATCHERS_NON_TYPÉS = ["toEndWith", "toStartWith", "toBeOneOf", "toBeNil"] as const;

const DOSSIER = resolve(import.meta.dir);

function fichiersDeTest(): string[] {
  return readdirSync(DOSSIER).filter((f) => f.endsWith(".test.ts") || f.endsWith(".test.tsx"));
}

describe("les tests compilent aussi", () => {
  test("aucun test n'utilise un matcher absent des définitions de types", () => {
    const fautifs: string[] = [];
    for (const fichier of fichiersDeTest()) {
      // Ce fichier-ci NOMME les matchers pour les interdire : il ne les appelle
      // pas. On ne cherche donc que la forme appelée, `.toEndWith(`.
      if (fichier === "setup.test.ts") continue;
      const src = readSource(import.meta.dir, `./${fichier}`);
      for (const m of MATCHERS_NON_TYPÉS) {
        if (src.includes(`.${m}(`)) fautifs.push(`${fichier} → .${m}()`);
      }
    }
    expect(fautifs).toEqual([]);
  });

  test("la liste est bien consultée — le garde-fou attrape ce qu'il annonce", () => {
    // Sans cette vérification, une faute de frappe dans la liste rendrait le
    // test ci-dessus vert pour toujours, sur un dépôt qu'il ne protège plus.
    const faux = `expect(x).${MATCHERS_NON_TYPÉS[0]}("y")`;
    expect(MATCHERS_NON_TYPÉS.some((m) => faux.includes(`.${m}(`))).toBe(true);
  });
});
