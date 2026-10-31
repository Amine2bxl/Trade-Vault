import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { en } from "../src/app/i18n/translations";
import fr from "../src/app/i18n/locales/fr";

/**
 * Les libellés des types d'objectif sont lus par clé calculée
 * (`goals.kind.${kind}`) : le typage ne les vérifie pas. Chaque type déclaré
 * dans `KIND_META` doit donc avoir son libellé et sa description, en anglais
 * (repli) et en français.
 */
describe("libellés des types d'objectif", () => {
  const src = readFileSync(resolve(import.meta.dir, "../src/app/features/goals/views.tsx"), "utf8");
  const block = src.slice(
    src.indexOf("const KIND_META"),
    src.indexOf("\n};\n", src.indexOf("const KIND_META")),
  );
  const kinds = [...block.matchAll(/\n {2}(\w+): \{/g)].map((m) => m[1]);

  it("lit bien les sept types", () => {
    expect(kinds.length).toBe(7);
  });

  for (const kind of kinds) {
    it(`${kind} : libellé et description en EN et FR`, () => {
      for (const key of [`goals.kind.${kind}`, `goals.kind.${kind}.desc`]) {
        expect((en as Record<string, string>)[key] ?? "").not.toBe("");
        expect((fr as Record<string, string>)[key] ?? "").not.toBe("");
      }
    });
  }
});
