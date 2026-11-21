import { describe, expect, test } from "bun:test";
import type { Trade } from "@/domain/trade";
import type { NewsEvent } from "@/domain/tradeNews";
import {
  addDiscoveriesToGraph,
  buildKnowledgeGraph,
  ForceLayout3D,
  KnowledgeGraph,
  mentions,
  runDiscoveries,
  sessionBlockDiff,
  visibleGraph,
  NODE_KINDS,
  RELATIONS,
  type ViewState,
} from "../index";

/** Neural Brain : un graphe qui ne relie que ce qui se prouve, et des
 *  découvertes qui ne sortent qu'au-dessus des seuils. */

let seq = 0;
function trade(over: Partial<Trade> = {}): Trade {
  seq++;
  return {
    id: `t${seq}`,
    date: "2026-03-02",
    symbol: "NQ",
    direction: "long",
    pnl: 100,
    riskAmount: 100,
    rMultiple: 1,
    strategy: "ORB",
    mistakes: [],
    setupQuality: 3,
    notes: "",
    screenshots: [],
    entryTime: "09:35",
    exitTime: "09:50",
    confluences: [],
    confidence: 70,
    accountId: "acc",
    ...over,
  };
}

/** Jours ouvrés successifs à partir du 2 mars 2026. */
function day(i: number): string {
  const d = new Date(Date.UTC(2026, 2, 2));
  let added = 0;
  while (added < i) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

const NOW = "2026-04-01T00:00:00.000Z";

describe("construction du graphe", () => {
  const trades = [
    trade({ id: "a", strategy: "ORB", mistakes: ["FOMO entry"], screenshots: ["u/1.png"] }),
    trade({ id: "b", strategy: "ORB", date: "2026-03-03", pnl: -100 }),
    // Import broker pas encore relu : ni setup confirmé, ni séance prouvée.
    trade({ id: "c", strategy: "Default", broker: "tradovate", reviewPending: true }),
  ];
  const g = buildKnowledgeGraph({ trades, now: NOW, account: { id: "acc", name: "Main" } });

  test("chaque lien relie deux nœuds existants et porte sa provenance", () => {
    expect(g.edges.size).toBeGreaterThan(0);
    for (const e of g.edges.values()) {
      expect(g.nodes.has(e.source)).toBe(true);
      expect(g.nodes.has(e.target)).toBe(true);
      expect(RELATIONS[e.type]).toBeDefined();
      expect(e.provenance.methodology.length).toBeGreaterThan(0);
      expect(e.provenance.confidence).toBeGreaterThan(0);
      expect(e.provenance.confidence).toBeLessThanOrEqual(1);
    }
    for (const n of g.nodes.values()) expect(NODE_KINDS[n.kind].category).toBe(n.category);
  });

  test("les faits lus sont reliés, avec la source", () => {
    const uses = g.edges.get("uses_setup|trade:a|strategy:ORB");
    expect(uses?.provenance.validation).toBe("fact");
    expect(uses?.provenance.sources).toEqual([{ table: "trades", id: "a" }]);
    expect(g.edges.has("has_mistake|trade:a|mistake:FOMO entry")).toBe(true);
    expect(g.edges.has("has_screenshot|trade:a|screenshot:u/1.png")).toBe(true);
    expect(g.nodes.get("trade:a")?.source).toEqual({ table: "trades", id: "a" });
  });

  test("ce qui ne se prouve pas n'est pas relié", () => {
    expect(g.nodes.has("strategy:Default")).toBe(false);
    expect(g.edgesOf("trade:c").some((e) => e.type === "in_session")).toBe(false);
    expect(g.edgesOf("trade:a").some((e) => e.type === "in_session")).toBe(true);
  });

  test("les agrégats ne donnent un taux qu'au-dessus de l'échantillon minimum", () => {
    const orb = g.nodes.get("strategy:ORB")!.metrics!;
    expect(orb.n).toBe(2);
    expect(orb.pnl).toBe(0);
    expect(orb.winRate).toBeNull();
    expect(orb.avgR).toBeNull();
  });

  test("les identifiants sont stables d'un calcul à l'autre", () => {
    const again = buildKnowledgeGraph({ trades, now: NOW, account: { id: "acc", name: "Main" } });
    expect([...again.nodes.keys()].sort()).toEqual([...g.nodes.keys()].sort());
    expect([...again.edges.keys()].sort()).toEqual([...g.edges.keys()].sort());
  });

  test("un lien vers un nœud absent est refusé", () => {
    const k = new KnowledgeGraph();
    k.addNode({ id: "symbol:NQ", kind: "symbol", key: "NQ", label: "NQ" });
    expect(
      k.addEdge({
        source: "symbol:NQ",
        target: "symbol:ES",
        type: "mentions",
        weight: 1,
        provenance: {
          origin: "text_match",
          validation: "hypothesis",
          methodology: "x",
          confidence: 0.5,
          createdAt: NOW,
          sources: [],
        },
      }),
    ).toBeNull();
  });

  test("l'enchaînement n'est posé que sur un ordre de clôture prouvé", () => {
    const seqTrades = [
      trade({ id: "s1", date: "2026-03-05", entryTime: "09:30", exitTime: "09:40", pnl: -50 }),
      trade({ id: "s2", date: "2026-03-05", entryTime: "09:45", exitTime: "09:55" }),
      trade({ id: "s3", date: "2026-03-05", entryTime: "", exitTime: "" }),
    ];
    const k = buildKnowledgeGraph({ trades: seqTrades, now: NOW });
    const e = k.edges.get("followed_by|trade:s1|trade:s2");
    expect(e?.provenance.evidence?.previous).toBe("loss");
    expect(k.edgesOf("trade:s3").some((x) => x.type === "followed_by")).toBe(false);
  });

  test("les bandes de risque suivent la médiane du trader, pas une norme", () => {
    const list = Array.from({ length: 12 }, (_, i) =>
      trade({ id: `r${i}`, date: day(i), riskAmount: i === 11 ? 300 : 100 }),
    );
    const k = buildKnowledgeGraph({ trades: list, now: NOW });
    expect(k.edges.has("in_risk_band|trade:r11|risk_band:oversized")).toBe(true);
    expect(k.edges.has("in_risk_band|trade:r0|risk_band:typical")).toBe(true);
    // Sous MIN_GROUP risques mesurés : aucune bande.
    const few = buildKnowledgeGraph({ trades: list.slice(0, 5), now: NOW });
    expect([...few.nodes.values()].some((n) => n.kind === "risk_band")).toBe(false);
  });

  test("deux erreurs cochées ensemble : un total toujours, un lift seulement à partir de MIN_GROUP", () => {
    const list = [
      trade({ mistakes: ["FOMO entry", "Size too large"] }),
      trade({ mistakes: ["FOMO entry", "Size too large"] }),
      trade({ mistakes: ["FOMO entry"] }),
    ];
    const k = buildKnowledgeGraph({ trades: list, now: NOW });
    const e = k.edges.get("co_occurs_with|mistake:FOMO entry|mistake:Size too large");
    expect(e?.provenance.evidence?.together).toBe(2);
    expect(e?.provenance.evidence?.lift).toBeNull();
    expect(e?.provenance.validation).toBe("fact");
  });
});

describe("sources secondaires", () => {
  test("un setup manqué se relie au jour, au symbole et aux trades pris ce jour-là", () => {
    const g = buildKnowledgeGraph({
      trades: [trade({ id: "x", date: "2026-03-10" })],
      missed: [
        {
          id: "m1",
          date: "2026-03-10",
          symbol: "nq",
          reasonNotTaken: "Peur après le FOMO entry de la veille",
          whatHappened: "",
          lessonLearned: "",
          nextTimePlan: "",
          estimatedR: 2,
          screenshots: [],
        },
      ],
      now: NOW,
    });
    expect(g.edges.has("same_day_as|missed:m1|trade:x")).toBe(true);
    expect(g.edges.has("on_symbol|missed:m1|symbol:NQ")).toBe(true);
    expect(g.nodes.get("missed:m1")?.data?.hypothetical).toBe(true);
  });

  test("une conversation ne se relie qu'à ce qu'elle nomme, comme hypothèse", () => {
    const g = buildKnowledgeGraph({
      trades: [trade({ symbol: "ES", strategy: "Silver Bullet" })],
      conversations: [
        {
          id: "c1",
          title: "Revue",
          createdAt: "2026-03-11T10:00:00Z",
          updatedAt: "2026-03-11T10:05:00Z",
          userText: "Pourquoi mes silver bullet perdent ? tu es sûr ?",
        },
      ],
      now: NOW,
    });
    const e = g.edges.get("mentions|conversation:c1|strategy:Silver Bullet");
    expect(e?.provenance.validation).toBe("hypothesis");
    // « tu es » n'est pas une mention du symbole ES.
    expect(g.edges.has("mentions|conversation:c1|symbol:ES")).toBe(false);
  });

  test("mentions : mot entier, accents ignorés, noms courts en capitales", () => {
    expect(mentions("j'ai pris un ORB", "ORB")).toBe(true);
    expect(mentions("absorbé", "ORB")).toBe(false);
    expect(mentions("mon Revenge Trade d'hier", "revenge trade")).toBe(true);
    expect(mentions("tu es là", "ES")).toBe(false);
    expect(mentions("ES a gappé", "ES")).toBe(true);
  });

  test("une annonce forte n'est reliée au trade que si elle tombe pendant la position", () => {
    const clock = {
      dayOf: (iso: string) => iso.slice(0, 10),
      timeOf: (iso: string) => iso.slice(11, 16),
    };
    const events: NewsEvent[] = [
      {
        id: "cpi",
        startsAt: "2026-03-12T09:40:00",
        currency: "USD",
        title: "CPI",
        impact: "high",
        allDay: false,
        source: "forexfactory",
      },
      {
        id: "late",
        startsAt: "2026-03-12T14:00:00",
        currency: "USD",
        title: "FOMC",
        impact: "high",
        allDay: false,
        source: "forexfactory",
      },
    ];
    const g = buildKnowledgeGraph({
      trades: [trade({ id: "n1", date: "2026-03-12", entryTime: "09:30", exitTime: "09:50" })],
      events,
      clock,
      now: NOW,
    });
    expect(g.edges.get("during_event|trade:n1|economic_event:cpi")?.provenance.validation).toBe(
      "fact",
    );
    expect(g.edges.has("during_event|trade:n1|economic_event:late")).toBe(false);
    expect(g.edges.has("occurred_on|economic_event:late|day:2026-03-12")).toBe(true);
  });

  test("simulation, rapport, recherche : rattachés à leur cible, jamais flottants", () => {
    const g = buildKnowledgeGraph({
      trades: [trade()],
      simulations: [
        {
          id: "plan",
          name: "Plan A",
          updatedAt: "2026-03-01T00:00:00Z",
          riskPerTrade: 100,
          winRate: null,
          avgWinR: null,
          avgLossR: null,
          seed: 42,
          origin: "lab_plan",
        },
      ],
      reports: [{ id: "r1", month: "2026-02", createdAt: "2026-03-01T00:00:00Z" }],
      research: [
        {
          id: "n1",
          createdAt: "2026-03-01T00:00:00Z",
          archived: false,
          hypothesis: "ORB tient",
          dimension: "strategy",
          cellKey: "ORB",
          verdict: null,
        },
      ],
      now: NOW,
    });
    for (const id of ["simulation:plan", "report:2026-02", "research_note:n1"]) {
      expect(g.degree(id)).toBeGreaterThan(0);
    }
    expect(g.edges.has("studies|research_note:n1|strategy:ORB")).toBe(true);
  });
});

describe("requêtes", () => {
  const g = buildKnowledgeGraph({
    trades: [
      trade({ id: "q1", mistakes: ["Overtrading"] }),
      trade({ id: "q2", strategy: "Breakout" }),
    ],
    now: NOW,
  });

  test("plus court chemin entre une erreur et un setup", () => {
    const path = g.shortestPath("mistake:Overtrading", "strategy:Breakout");
    expect(path?.[0]).toBe("mistake:Overtrading");
    expect(path?.at(-1)).toBe("strategy:Breakout");
  });

  test("recherche insensible à la casse et aux accents, moyeux d'abord", () => {
    expect(g.search("overtr")[0].id).toBe("mistake:Overtrading");
    expect(g.search("")).toEqual([]);
  });
});

describe("niveau de détail", () => {
  const trades = Array.from({ length: 6 }, (_, i) =>
    trade({ id: `v${i}`, date: day(i), strategy: i % 2 ? "ORB" : "Breakout" }),
  );
  const g = buildKnowledgeGraph({ trades, now: NOW });
  const base: ViewState = {
    hiddenCategories: new Set(),
    hiddenRelations: new Set(),
    expanded: new Set(),
    showLeaves: false,
    maxNodes: 1000,
  };

  test("les feuilles sont masquées tant qu'aucun moyeu n'est déplié", () => {
    const v = visibleGraph(g, base);
    expect(v.nodes.some((n) => n.kind === "trade")).toBe(false);
    const open = visibleGraph(g, { ...base, expanded: new Set(["strategy:ORB"]) });
    expect(
      open.nodes
        .filter((n) => n.kind === "trade")
        .map((n) => n.id)
        .sort(),
    ).toEqual(["trade:v1", "trade:v3", "trade:v5"]);
  });

  test("vue d'ensemble : les moyeux qui partagent des trades masqués sont reliés, avec le compte", () => {
    const v = visibleGraph(g, base);
    const e = v.edges.find((x) => x.id === "shares_trades|strategy:ORB|symbol:NQ");
    expect(e?.provenance.evidence?.trades).toBe(3);
    expect(e?.provenance.sources.length).toBe(3);
    const off = visibleGraph(g, { ...base, hiddenRelations: new Set(["shares_trades"]) });
    expect(off.edges.some((x) => x.type === "shares_trades")).toBe(false);
  });

  test("le focus garde le nœud et son voisinage", () => {
    const v = visibleGraph(g, { ...base, focus: "trade:v0" });
    const ids = v.nodes.map((n) => n.id);
    expect(ids).toContain("trade:v0");
    expect(ids).toContain("strategy:Breakout");
    // v1 suit v0 (ordre prouvé) : voisin direct ; v2 ne l'est pas.
    expect(ids).toContain("trade:v1");
    expect(ids).not.toContain("trade:v2");
  });

  test("au-delà du plafond, la vue dit combien elle cache", () => {
    const v = visibleGraph(g, { ...base, showLeaves: true, maxNodes: 5 });
    expect(v.nodes.length).toBe(5);
    expect(v.truncated).toBeGreaterThan(0);
    for (const e of v.edges) {
      expect(v.nodes.some((n) => n.id === e.source)).toBe(true);
    }
  });

  test("la frise écarte les entités datées hors fenêtre, pas les moyeux", () => {
    const v = visibleGraph(g, { ...base, showLeaves: true, from: day(4), to: day(5) });
    expect(v.nodes.filter((n) => n.kind === "trade").length).toBe(2);
    expect(v.nodes.some((n) => n.id === "strategy:ORB")).toBe(true);
  });
});

describe("disposition 3D", () => {
  const nodes = [
    { id: "a", category: "trading" as const },
    { id: "b", category: "trading" as const },
    { id: "c", category: "behavior" as const },
    { id: "d", category: "market" as const },
  ];
  const edges = [{ source: "a", target: "b", weight: 1 }];

  test("même graine, mêmes positions", () => {
    const l1 = new ForceLayout3D(nodes, edges, { seed: 7 });
    const l2 = new ForceLayout3D(nodes, edges, { seed: 7 });
    l1.run();
    l2.run();
    expect(Array.from(l1.pos)).toEqual(Array.from(l2.pos));
    expect(l1.settled).toBe(true);
  });

  test("les nœuds déjà placés gardent leur place", () => {
    const first = new ForceLayout3D(nodes, edges, { seed: 7 });
    first.run();
    const snap = first.snapshot();
    const next = new ForceLayout3D(nodes, edges, { seed: 99, initial: snap });
    expect(next.settled).toBe(true);
    expect(next.positionOf("a")).toEqual(snap.get("a")!);
  });

  test("ce qui est relié finit plus près que ce qui ne l'est pas", () => {
    const l = new ForceLayout3D(nodes, edges, { seed: 3 });
    l.run();
    const dist = (x: string, y: string) => {
      const p = l.positionOf(x)!;
      const q = l.positionOf(y)!;
      return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    };
    expect(dist("a", "b")).toBeLessThan(dist("a", "d"));
  });
});

describe("écart entre deux groupes", () => {
  test("bootstrap reproductible, intervalle autour de l'écart réel", () => {
    const a = Array.from({ length: 12 }, (_, i) => [100 + (i % 3) * 10, 90]);
    const b = Array.from({ length: 12 }, (_, i) => [-50 + (i % 4) * 5]);
    const r1 = sessionBlockDiff(a, b, { seed: 1 })!;
    const r2 = sessionBlockDiff(a, b, { seed: 1 })!;
    expect(r1).toEqual(r2);
    expect(r1.low).toBeGreaterThan(0);
    expect(r1.diff).toBeGreaterThan(r1.low);
    expect(r1.diff).toBeLessThan(r1.high);
    expect(r1.p).toBeLessThan(0.05);
  });

  test("un groupe d'une seule séance ne se rééchantillonne pas", () => {
    expect(sessionBlockDiff([[1, 2, 3]], [[1], [2]], { seed: 1 })).toBeNull();
  });
});

describe("découvertes", () => {
  /** 40 séances : une paire d'erreurs systématiquement coûteuse, le reste bruité. */
  function dataset(): Trade[] {
    const out: Trade[] = [];
    for (let i = 0; i < 40; i++) {
      const d = day(i);
      const noise = ((i * 37) % 11) - 5;
      out.push(
        trade({
          id: `p${i}a`,
          date: d,
          entryTime: "09:31",
          exitTime: "09:40",
          pnl: i % 2 ? -150 + noise : -140 + noise,
          mistakes: i % 2 ? ["FOMO entry", "Size too large"] : ["FOMO entry"],
          strategy: i % 2 ? "Breakout" : "ORB",
        }),
        trade({
          id: `p${i}b`,
          date: d,
          entryTime: "10:15",
          exitTime: "10:30",
          pnl: i % 2 ? -260 + noise : 40 + noise,
          mistakes: i % 2 ? ["FOMO entry", "Size too large"] : ["Size too large"],
          strategy: "ORB",
        }),
      );
    }
    return out;
  }

  test("une paire d'erreurs coûteuse sort, avec son n, son intervalle et son q", () => {
    const run = runDiscoveries({ trades: dataset() });
    const pair = run.discoveries.find((d) => d.id === "mistake_pair:FOMO entry|Size too large");
    expect(pair).toBeDefined();
    expect(pair!.evidence.n).toBe(40);
    expect(pair!.evidence.high!).toBeLessThan(0);
    expect(pair!.evidence.q!).toBeLessThanOrEqual(run.alpha);
    expect(pair!.direction).toBe("lower");
    expect(pair!.alternatives).toContain("labeling");
    expect(run.tests).toBeGreaterThan(0);
  });

  test("reproductible au chiffre près", () => {
    expect(runDiscoveries({ trades: dataset() })).toEqual(runDiscoveries({ trades: dataset() }));
  });

  test("sous les minimums, rien n'est publié — pas même un chiffre", () => {
    const few = dataset().slice(0, 12);
    const run = runDiscoveries({ trades: few });
    expect(run.discoveries.filter((d) => d.evidence.p !== null)).toEqual([]);
  });

  test("du bruit pur ne produit aucune découverte testée", () => {
    const noise: Trade[] = [];
    for (let i = 0; i < 60; i++) {
      const v = ((i * 7919) % 200) - 100;
      noise.push(
        trade({
          id: `z${i}`,
          date: day(i),
          pnl: v,
          mistakes:
            i % 3 === 0
              ? ["FOMO entry", "Overtrading"]
              : i % 3 === 1
                ? ["FOMO entry"]
                : ["Overtrading"],
        }),
      );
    }
    const tested = runDiscoveries({ trades: noise }).discoveries.filter(
      (d) => d.evidence.p !== null,
    );
    expect(tested.filter((d) => d.detector === "mistake_pair")).toEqual([]);
  });

  test("une lacune de données est un constat, compté", () => {
    const list = Array.from({ length: 12 }, (_, i) =>
      trade({ id: `g${i}`, date: day(i), riskAmount: 0 }),
    );
    const gap = runDiscoveries({ trades: list }).discoveries.find((d) => d.id === "data_gap:risk");
    expect(gap?.category).toBe("knowledge_gap");
    expect(gap?.evidence.value).toBe(0);
  });

  test("une simulation qui suppose moins de risque que celui pris est signalée, comme hypothèse", () => {
    const list = Array.from({ length: 30 }, (_, i) =>
      trade({ id: `k${i}`, date: day(i), riskAmount: 200 }),
    );
    const run = runDiscoveries({
      trades: list,
      simulations: [
        {
          id: "plan",
          name: "Plan",
          updatedAt: NOW,
          riskPerTrade: 100,
          winRate: null,
          avgWinR: null,
          avgLossR: null,
          seed: 1,
          origin: "lab_plan",
        },
      ],
    });
    const d = run.discoveries.find((x) => x.id === "simulation_risk:plan");
    expect(d?.hypothetical).toBe(true);
    expect(d?.evidence.value).toBe(200);
    expect(d?.evidence.baseline).toBe(100);
  });

  test("les découvertes se posent dans le graphe, reliées à leurs moyeux", () => {
    const trades = dataset();
    const g = buildKnowledgeGraph({ trades, now: NOW });
    const run = runDiscoveries({ trades });
    addDiscoveriesToGraph(g, run, NOW);
    const id = "discovery:mistake_pair:FOMO entry|Size too large";
    expect(g.nodes.get(id)?.kind).toBe("discovery");
    expect(g.edges.has(`supported_by|${id}|mistake:FOMO entry`)).toBe(true);
    for (const d of run.discoveries) expect(g.degree(`discovery:${d.id}`)).toBeGreaterThan(0);
  });
});
