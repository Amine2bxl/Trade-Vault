import { describe, it, expect } from "bun:test";
import {
  readHistory,
  writeHistory,
  appendToday,
  dayOverDayDelta,
  trend,
  edgeHistoryKey,
  MAX_DAYS,
  type EdgeStore,
  type EdgePoint,
} from "../edgeHistory";

/** Stockage en mémoire — le contrat `EdgeStore` rend le module testable sans navigateur. */
function memoryStore(
  initial: Record<string, string> = {},
): EdgeStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

const USER = "u1";

describe("readHistory", () => {
  it("convertit le FORMAT HÉRITÉ au lieu de le jeter", () => {
    // Régression protégée : un utilisateur existant ne doit pas voir sa
    // trajectoire repartir de zéro à cause du changement de format.
    const store = memoryStore({
      [edgeHistoryKey(USER)]: JSON.stringify({ date: "2026-08-01", score: 62 }),
    });
    expect(readHistory(store, USER)).toEqual([{ date: "2026-08-01", score: 62 }]);
  });

  it("renvoie un historique vide sur donnée corrompue plutôt que de lever", () => {
    // Le Dashboard ne doit jamais tomber à cause d'une entrée de stockage abîmée.
    const store = memoryStore({ [edgeHistoryKey(USER)]: "{pas du json" });
    expect(readHistory(store, USER)).toEqual([]);
  });

  it("écarte les points malformés et trie par date", () => {
    const store = memoryStore({
      [edgeHistoryKey(USER)]: JSON.stringify([
        { date: "2026-08-03", score: 70 },
        { date: "pas-une-date", score: 50 },
        { date: "2026-08-01", score: 60 },
        { date: "2026-08-02", score: null },
      ]),
    });
    expect(readHistory(store, USER)).toEqual([
      { date: "2026-08-01", score: 60 },
      { date: "2026-08-03", score: 70 },
    ]);
  });

  it("absence de donnée = historique vide", () => {
    expect(readHistory(memoryStore(), USER)).toEqual([]);
  });
});

describe("appendToday", () => {
  it("RÉÉCRIT le score du jour au lieu de le dupliquer", () => {
    // L'Edge Score bouge à chaque trade : c'est la valeur de fin de journée qui fait foi.
    let h: EdgePoint[] = [{ date: "2026-08-05", score: 40 }];
    h = appendToday(h, "2026-08-05", 55);
    expect(h).toEqual([{ date: "2026-08-05", score: 55 }]);
  });

  it("borne l'historique à MAX_DAYS (protection du quota de stockage)", () => {
    let h: EdgePoint[] = [];
    for (let i = 1; i <= MAX_DAYS + 10; i++) {
      h = appendToday(h, `2026-08-${String(i).padStart(2, "0")}`, i);
    }
    expect(h.length).toBe(MAX_DAYS);
    // Ce sont les jours les plus RÉCENTS qui sont conservés.
    expect(h[h.length - 1].score).toBe(MAX_DAYS + 10);
  });
});

describe("dayOverDayDelta", () => {
  it("compare au dernier jour antérieur — comportement d'origine préservé", () => {
    const h: EdgePoint[] = [
      { date: "2026-08-03", score: 50 },
      { date: "2026-08-04", score: 60 },
    ];
    expect(dayOverDayDelta(h, "2026-08-05", 72)).toBe(12);
  });

  it("ignore l'entrée du jour même", () => {
    const h: EdgePoint[] = [
      { date: "2026-08-04", score: 60 },
      { date: "2026-08-05", score: 90 },
    ];
    expect(dayOverDayDelta(h, "2026-08-05", 90)).toBe(30);
  });

  it("null quand aucun jour antérieur n'existe", () => {
    expect(dayOverDayDelta([{ date: "2026-08-05", score: 70 }], "2026-08-05", 70)).toBeNull();
  });
});

describe("trend", () => {
  it("null tant qu'il n'y a qu'un point — on n'affirme pas une tendance sans preuve", () => {
    expect(trend([{ date: "2026-08-05", score: 70 }])).toBeNull();
  });

  it("mesure la progression sur la fenêtre", () => {
    const h: EdgePoint[] = [
      { date: "2026-08-01", score: 40 },
      { date: "2026-08-02", score: 55 },
      { date: "2026-08-03", score: 68 },
    ];
    expect(trend(h)).toEqual({ delta: 28, from: 40, to: 68, points: 3 });
  });

  it("une tendance négative est rapportée telle quelle, sans adoucissement", () => {
    const h: EdgePoint[] = [
      { date: "2026-08-01", score: 80 },
      { date: "2026-08-02", score: 52 },
    ];
    expect(trend(h)?.delta).toBe(-28);
  });
});

describe("writeHistory", () => {
  it("persiste sous la clé attendue", () => {
    const store = memoryStore();
    writeHistory(store, USER, [{ date: "2026-08-05", score: 61 }]);
    expect(JSON.parse(store.data[edgeHistoryKey(USER)])).toEqual([
      { date: "2026-08-05", score: 61 },
    ]);
  });

  it("un stockage indisponible ne lève pas (navigation privée, quota plein)", () => {
    const failing: EdgeStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(() => writeHistory(failing, USER, [{ date: "2026-08-05", score: 61 }])).not.toThrow();
  });
});
