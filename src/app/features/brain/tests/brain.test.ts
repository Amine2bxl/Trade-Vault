import { describe, expect, test } from "bun:test";
import { en, type TKey } from "@/app/i18n/translations";
import fr from "@/app/i18n/locales/fr";
import {
  KnowledgeGraph,
  NODE_KINDS,
  RELATIONS,
  NODE_CATEGORIES,
  buildKnowledgeGraph,
  type Discovery,
  type NodeKind,
} from "@/modules/knowledge";
import { DEFAULT_CAMERA, clampCamera, orbit, pan, pick, project, zoom } from "../camera";
import { destinationOf } from "../destinations";
import { briefForSelection, BRIEF_MAX_CHARS } from "../jarvisBrief";
import { discoveryText } from "../presentation";

/** Neural Brain, côté écran : caméra, destinations, textes. */

const tEn = (k: TKey) => en[k] ?? k;
const tFr = (k: TKey) => fr[k] ?? en[k] ?? k;
const view = { width: 800, height: 600 };

describe("caméra orbitale", () => {
  test("la cible se projette au centre de l'écran", () => {
    const p = project(DEFAULT_CAMERA.target, DEFAULT_CAMERA, view)!;
    expect(p.x).toBeCloseTo(400, 5);
    expect(p.y).toBeCloseTo(300, 5);
    expect(p.scale).toBeCloseTo(1, 5);
  });

  test("ce qui est derrière la caméra n'est pas dessiné", () => {
    const behind = project(
      [0, 0, -DEFAULT_CAMERA.distance - 50],
      { ...DEFAULT_CAMERA, yaw: 0, pitch: 0 },
      view,
    );
    expect(behind).toBeNull();
  });

  test("le tangage est borné, le zoom aussi", () => {
    expect(orbit(DEFAULT_CAMERA, 0, 10_000).pitch).toBeLessThan(Math.PI / 2);
    expect(zoom(DEFAULT_CAMERA, 1e-6).distance).toBeGreaterThan(0);
    expect(clampCamera({ ...DEFAULT_CAMERA, distance: 1e9 }).distance).toBeLessThan(1e9);
  });

  test("le panoramique déplace la cible sous le doigt", () => {
    const c = { ...DEFAULT_CAMERA, yaw: 0, pitch: 0 };
    const moved = pan(c, 100, 0, view);
    const p = project(c.target, moved, view)!;
    expect(p.x).toBeCloseTo(500, 3);
  });

  test("le pointeur attrape le nœud le plus proche dans son rayon", () => {
    const xs = new Float32Array([10, 100]);
    const ys = new Float32Array([10, 100]);
    const rs = new Float32Array([5, 5]);
    expect(pick(98, 101, xs, ys, rs, 2)).toBe(1);
    expect(pick(300, 300, xs, ys, rs, 2)).toBe(-1);
  });
});

describe("chaque nœud mène à son original", () => {
  const g = buildKnowledgeGraph({
    trades: [
      {
        id: "t1",
        date: "2026-03-02",
        symbol: "NQ",
        direction: "long",
        pnl: 100,
        riskAmount: 50,
        rMultiple: 2,
        strategy: "ORB",
        mistakes: ["FOMO entry"],
        setupQuality: 4,
        notes: "",
        screenshots: ["u/a.png"],
        entryTime: "09:35",
        exitTime: "09:45",
        confluences: [],
        confidence: 70,
      },
    ],
    now: "2026-03-03T00:00:00Z",
  });

  test("un trade ouvre SA fiche dans le journal", () => {
    expect(destinationOf(g.nodes.get("trade:t1")!, g)).toEqual({
      type: "page",
      page: "journal",
      filter: { trades: ["t1"] },
      open: "t1",
    });
  });

  test("une erreur ouvre ses occurrences filtrées, une capture son trade", () => {
    expect(destinationOf(g.nodes.get("mistake:FOMO entry")!, g)).toMatchObject({
      page: "journal",
      filter: { mistake: "FOMO entry" },
    });
    expect(destinationOf(g.nodes.get("screenshot:u/a.png")!, g)).toMatchObject({ open: "t1" });
  });

  test("tous les types de nœud ont une destination", () => {
    for (const kind of Object.keys(NODE_KINDS) as NodeKind[]) {
      const node = {
        id: `${kind}:k`,
        kind,
        category: NODE_KINDS[kind].category,
        key: "k",
        label: "k",
      };
      expect(destinationOf(node, new KnowledgeGraph())).toBeDefined();
    }
  });
});

describe("textes", () => {
  test("chaque type, famille et relation a un libellé, en anglais et en français", () => {
    const keys = [
      ...Object.keys(NODE_KINDS).map((k) => `brain.kind.${k}`),
      ...NODE_CATEGORIES.map((c) => `brain.cat.${c}`),
      ...Object.keys(RELATIONS).map((r) => `brain.rel.${r}`),
    ] as TKey[];
    for (const k of keys) {
      // La clé elle-même en cas d'échec : le message nomme ce qui manque.
      expect(en[k] ? k : `missing en ${k}`).toBe(k);
      expect(fr[k] ? k : `missing fr ${k}`).toBe(k);
    }
  });

  test("aucune découverte ne laisse de paramètre non rempli, dans aucune langue", () => {
    const base: Omit<Discovery, "detector" | "direction" | "params" | "id"> = {
      category: "hidden_pattern",
      evidence: {
        unit: "pnl",
        n: 12,
        sessions: 8,
        nCompare: 20,
        sessionsCompare: 11,
        value: -50,
        baseline: 20,
        diff: -70,
        low: -120,
        high: -20,
        p: 0.01,
        q: 0.04,
        method: "m",
        seed: 1,
        iterations: 2000,
        version: 1,
      },
      hypothetical: false,
      fragile: false,
      entities: [],
      trades: [],
      compareTrades: [],
      alternatives: ["regime"],
      experiment: "cap_trades",
      fingerprint: "x",
      impact: -840,
      validation: "confirmed",
      confidence: "moderate",
    };
    const cases: Pick<Discovery, "detector" | "params">[] = [
      { detector: "edge_condition", params: { dimension: "weekday", key: "4" } },
      { detector: "edge_condition", params: { dimension: "session", key: "london" } },
      { detector: "mistake_pair", params: { a: "FOMO entry", b: "Size too large" } },
      { detector: "risk_after_loss", params: { median: 100 } },
      { detector: "day_rank", params: { rank: 3 } },
      { detector: "setup_grade", params: {} },
      { detector: "confidence", params: {} },
      { detector: "missed_vs_taken", params: { symbols: "NQ" } },
      { detector: "simulation_risk", params: { name: "Plan", share: 0.4 } },
      { detector: "after_loss_outcome", params: {} },
      { detector: "loss_concentration", params: { segment: "after_loss", key: "after_loss" } },
      { detector: "loss_concentration", params: { segment: "signature", key: "revenge" } },
      {
        detector: "winrate_trap",
        params: { dimension: "session", key: "london", winRate: 70, winRateRest: 50 },
      },
      { detector: "combo", params: { d1: "strategy", v1: "ORB", d2: "weekday", v2: "2" } },
      { detector: "risk_vs_quality", params: { median: 100 } },
      { detector: "process_outcome", params: { luckyWinsShare: 0.3, cleanLosses: 4 } },
      { detector: "plan_adherence", params: {} },
      { detector: "mistake_trend", params: { mistake: "FOMO entry", since: "2026-03-02" } },
      { detector: "planned_risk", params: { share: 0.4 } },
      { detector: "untagged_signature", params: { error: "revenge", tag: "Revenge trade" } },
      { detector: "missed_avoided", params: { share: 0.4 } },
    ];
    // Un sens que le détecteur ne produit jamais n'a pas de texte : on ne le teste pas.
    const ONE_WAY: Record<string, "higher" | "lower"> = {
      loss_concentration: "higher",
      winrate_trap: "lower",
      planned_risk: "higher",
      untagged_signature: "lower",
      missed_avoided: "lower",
    };
    for (const t of [tEn, tFr])
      for (const c of cases)
        for (const direction of ["higher", "lower"] as const) {
          if (ONE_WAY[c.detector] && ONE_WAY[c.detector] !== direction) continue;
          const d = { ...base, ...c, direction, id: c.detector } as Discovery;
          const { title, body } = discoveryText(d, t);
          expect(`${title} ${body}`, `${c.detector}.${direction}`).not.toMatch(/\{\w+\}|brain\./);
        }
    for (const field of ["risk", "time", "setup"]) {
      const d = {
        ...base,
        detector: "data_gap",
        direction: "lower",
        params: { field },
        id: "g",
      } as Discovery;
      const { title, body } = discoveryText(d, tFr);
      expect(`${title} ${body}`).not.toMatch(/\{\w+\}|brain\./);
    }
  });

  test("la question envoyée à Jarvis reste sous la borne d'askCoach", () => {
    const trades = Array.from({ length: 60 }, (_, i) => ({
      id: `x${i}`,
      date: "2026-03-02",
      symbol: `S${i}`,
      direction: "long" as const,
      pnl: 10,
      riskAmount: 10,
      rMultiple: 1,
      strategy: `Setup ${i}`,
      mistakes: [],
      setupQuality: 3,
      notes: "",
      screenshots: [],
      entryTime: "09:30",
      exitTime: "09:40",
      confluences: [],
      confidence: 70,
    }));
    const g = buildKnowledgeGraph({ trades, now: "2026-03-03T00:00:00Z" });
    const nodes = [...g.nodes.values()];
    const brief = briefForSelection(nodes, g, tFr, (n) => n.label);
    expect(brief.length).toBeLessThanOrEqual(BRIEF_MAX_CHARS);
    expect(brief).toContain("Neural Brain");
  });
});
