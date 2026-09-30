import { describe, expect, test } from "bun:test";
import { ACCOUNT_TYPES, parseAccountType } from "../src/app/store/accounts";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * La colonne `accounts.type` est un `text` libre : la base contient des
 * valeurs (`futures`, `replay`) qu'aucun écran ne sait afficher. Lues telles
 * quelles, elles faisaient planter le sélecteur de sous-comptes au rendu
 * (bulle qui disparaît, page 500).
 */
describe("type de compte lu en base", () => {
  test("les quatre types connus passent tels quels", () => {
    for (const t of ACCOUNT_TYPES) expect(parseAccountType(t)).toBe(t);
  });

  test("une valeur inconnue devient le type par défaut de la colonne", () => {
    for (const raw of ["futures", "replay", "", null, undefined, 42]) {
      expect(parseAccountType(raw)).toBe("personal");
    }
  });

  test("la lecture passe par la validation, pas par un cast", () => {
    const src = readFileSync(join(import.meta.dir, "../src/app/store/accounts.ts"), "utf8");
    expect(src).toContain("type: parseAccountType(r.type)");
    expect(src).not.toContain("type: (r.type as AccountType)");
  });

  test("le sélecteur a toujours une icône à rendre", () => {
    const src = readFileSync(join(import.meta.dir, "../src/app/shell/AccountSwitcher.tsx"), "utf8");
    expect(src).toContain("TYPE_ICON[a.type] ?? User");
  });
});
