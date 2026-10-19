import { describe, expect, test } from "bun:test";
import { createAutosaveGuard, stableStringify } from "../src/app/utils/autosaveGuard";

/**
 * LE GARDE DES ÉDITEURS AUTO-ENREGISTRÉS.
 *
 * Tant qu'une modification locale n'est pas confirmée par la base, ce qui
 * arrive d'ailleurs (écho d'une sauvegarde plus ancienne, rattrapage au retour
 * du réseau) ne doit pas remplacer ce que le trader a tapé. Et un
 * enregistrement qui ÉCHOUE laisse l'éditeur « sale » : au retour du réseau, on
 * renvoie la saisie au lieu de la jeter.
 */
describe("garde d'enregistrement", () => {
  test("propre au départ", () => {
    const g = createAutosaveGuard();
    expect(g.isDirty()).toBe(false);
    expect(g.hasFailed()).toBe(false);
  });

  test("une modification rend sale jusqu'à la réussite de SON enregistrement", () => {
    const g = createAutosaveGuard();
    const a = g.begin();
    expect(g.isDirty()).toBe(true);
    g.settle(a, true);
    expect(g.isDirty()).toBe(false);
  });

  test("la réussite d'un enregistrement plus ancien ne nettoie pas une frappe plus récente", () => {
    const g = createAutosaveGuard();
    const a = g.begin();
    g.begin(); // frappe B, encore dans son délai
    g.settle(a, true);
    expect(g.isDirty()).toBe(true);
  });

  test("un échec garde la saisie et le signale", () => {
    const g = createAutosaveGuard();
    const a = g.begin();
    g.settle(a, false);
    expect(g.isDirty()).toBe(true);
    expect(g.hasFailed()).toBe(true);
  });

  test("après un échec, le renvoi réussi nettoie", () => {
    const g = createAutosaveGuard();
    g.settle(g.begin(), false);
    const retry = g.begin();
    expect(g.hasFailed()).toBe(false);
    g.settle(retry, true);
    expect(g.isDirty()).toBe(false);
  });
});

describe("comparaison stable", () => {
  test("l'ordre des clés ne compte pas (jsonb les réordonne)", () => {
    expect(stableStringify({ title: "a", desc: "b", items: [{ y: 1, x: 2 }] })).toBe(
      stableStringify({ items: [{ x: 2, y: 1 }], desc: "b", title: "a" }),
    );
  });

  test("l'ordre d'un tableau compte", () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });
});
