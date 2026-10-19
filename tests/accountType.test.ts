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
    // L'icône d'un compte vit dans `accountVisuals.ts` (partagée avec le
    // gestionnaire de comptes des réglages) ; le sélecteur la lit de là.
    const visuals = readFileSync(
      join(import.meta.dir, "../src/app/shell/accountVisuals.ts"),
      "utf8",
    );
    expect(visuals).toContain("TYPE_ICON[a.type] ?? User");
    const switcher = readFileSync(
      join(import.meta.dir, "../src/app/shell/AccountSwitcher.tsx"),
      "utf8",
    );
    expect(switcher).toMatch(/getAccountIcon[\s\S]*from "\.\/accountVisuals"/);
  });
});

describe("compte actif : propre à chaque appareil", () => {
  const acc = (id: string, isDefault = false) => ({ id, isDefault }) as never;
  const list = [acc("a"), acc("main", true), acc("b")];

  test("le compte choisi sur CET appareil passe en premier", async () => {
    const { pickActiveAccount } = await import("../src/app/store/accounts");
    expect(pickActiveAccount(list, "b", "a")).toBe("b");
  });

  test("compte local supprimé ailleurs : le dernier utilisé en base", async () => {
    const { pickActiveAccount } = await import("../src/app/store/accounts");
    expect(pickActiveAccount(list, "gone", "a")).toBe("a");
  });

  test("les deux invalides : le compte principal", async () => {
    const { pickActiveAccount } = await import("../src/app/store/accounts");
    expect(pickActiveAccount(list, "gone", "gone-too")).toBe("main");
    expect(pickActiveAccount(list, null, null)).toBe("main");
  });

  test("pas de principal : le premier ; liste vide : aucun", async () => {
    const { pickActiveAccount } = await import("../src/app/store/accounts");
    expect(pickActiveAccount([acc("x"), acc("y")], null, null)).toBe("x");
    expect(pickActiveAccount([], "x", "y")).toBeNull();
  });
});
