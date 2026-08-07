import { describe, it, expect } from "bun:test";
import {
  computeChecklistStreak,
  checklistKey,
  MAX_LOOKBACK_DAYS,
  type ChecklistStore,
} from "../checklistStreak";

/**
 * Série de checklist — non-régression.
 *
 * Les deux règles produit (week-ends neutres, sursis du jour courant) sont ce
 * qui sépare une mécanique motivante d'une mécanique punitive. Une série qui
 * casse à tort décourage exactement le comportement qu'elle est censée
 * renforcer — d'où une couverture serrée de ces deux cas.
 */

const USER = "u1";

/** Construit un stockage où seuls les jours listés sont complétés. */
function storeWith(doneDays: string[], extra: Record<string, string> = {}): ChecklistStore {
  const data: Record<string, string> = { ...extra };
  for (const iso of doneDays) data[checklistKey(USER, iso)] = JSON.stringify({ locked: true });
  return { getItem: (k) => data[k] ?? null };
}

// Repères : 2026-08-05 est un MERCREDI.
const WED = new Date("2026-08-05T12:00:00Z");
// 2026-08-10 est un LUNDI ; 08-08 samedi, 08-09 dimanche.
const MON = new Date("2026-08-10T12:00:00Z");

describe("règles de base", () => {
  it("compte les jours consécutifs complétés", () => {
    const store = storeWith(["2026-08-05", "2026-08-04", "2026-08-03"]);
    const r = computeChecklistStreak(store, USER, WED);
    expect(r.current).toBe(3);
    expect(r.doneToday).toBe(true);
    expect(r.atRisk).toBe(false);
  });

  it("un jour manqué CASSE la série", () => {
    // 08-04 manquant → seul aujourd'hui compte.
    const store = storeWith(["2026-08-05", "2026-08-03"]);
    expect(computeChecklistStreak(store, USER, WED).current).toBe(1);
  });

  it("aucun historique = série à zéro, sans exception", () => {
    const r = computeChecklistStreak(storeWith([]), USER, WED);
    expect(r).toEqual({ current: 0, doneToday: false, atRisk: false });
  });

  it("une checklist OUVERTE mais non verrouillée ne compte pas", () => {
    // Seul l'engagement compte : cocher trois cases sans valider n'est pas le rituel.
    const store: ChecklistStore = {
      getItem: (k) =>
        k === checklistKey(USER, "2026-08-05")
          ? JSON.stringify({ locked: false, checked: [true, true] })
          : null,
    };
    expect(computeChecklistStreak(store, USER, WED).current).toBe(0);
  });

  it("une entrée corrompue ne fait pas tomber le calcul", () => {
    const store = storeWith(["2026-08-04"], { [checklistKey(USER, "2026-08-05")]: "{pas du json" });
    expect(() => computeChecklistStreak(store, USER, WED)).not.toThrow();
    expect(computeChecklistStreak(store, USER, WED).current).toBe(1);
  });
});

describe("RÈGLE 1 — les week-ends ne cassent jamais la série", () => {
  it("enjambe samedi et dimanche", () => {
    // Lundi 10 + vendredi 7 + jeudi 6 : le week-end (8 et 9) est ignoré.
    const store = storeWith(["2026-08-10", "2026-08-07", "2026-08-06"]);
    expect(computeChecklistStreak(store, USER, MON).current).toBe(3);
  });

  it("un week-end non travaillé ne compte pas comme un jour de série", () => {
    // Seul le lundi est fait : les jours de marché fermé n'ajoutent rien.
    const store = storeWith(["2026-08-10"]);
    expect(computeChecklistStreak(store, USER, MON).current).toBe(1);
  });
});

describe("RÈGLE 2 — sursis du jour courant", () => {
  it("ne remet PAS la série à zéro tant qu'aujourd'hui n'est pas terminé", () => {
    // Rien fait aujourd'hui, mais les deux jours précédents le sont.
    // Une série tombant à 0 dès 9h punirait un jour pas encore vécu.
    const store = storeWith(["2026-08-04", "2026-08-03"]);
    const r = computeChecklistStreak(store, USER, WED);
    expect(r.current).toBe(2);
    expect(r.doneToday).toBe(false);
  });

  it("signale la série EN RISQUE — l'état qui justifie de pousser à agir", () => {
    const store = storeWith(["2026-08-04", "2026-08-03"]);
    expect(computeChecklistStreak(store, USER, WED).atRisk).toBe(true);
  });

  it("pas « en risque » quand il n'y a aucune série à perdre", () => {
    expect(computeChecklistStreak(storeWith([]), USER, WED).atRisk).toBe(false);
  });
});

describe("bornes", () => {
  it("s'arrête à MAX_LOOKBACK_DAYS même sur un historique parfait", () => {
    // Tout jour interrogé est considéré comme fait : la boucle doit terminer.
    const store: ChecklistStore = { getItem: () => JSON.stringify({ locked: true }) };
    const r = computeChecklistStreak(store, USER, WED);
    expect(r.current).toBeGreaterThan(0);
    expect(r.current).toBeLessThanOrEqual(MAX_LOOKBACK_DAYS);
  });
});
