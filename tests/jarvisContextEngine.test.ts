import { describe, expect, test } from "bun:test";
import { routeQuestion } from "../src/modules/ai/router/route";
import {
  compactOutput,
  executePrefetch,
  planContext,
  prefetchBlocks,
  registerContextSource,
  UNAVAILABLE_NOTICE,
} from "../src/modules/ai/context-engine";
import { registerTool, type ToolContext } from "../src/modules/ai/tools/types";
import { selectInputForPlan } from "../src/modules/ai/agents/coach.orchestrator";
import { buildCoachMessages } from "../src/modules/ai/agents/coach.agent";
import { fullCoachInput } from "./helpers/coachInput";

/**
 * LOT 2 — LE CONTEXT ENGINE : n'envoyer que ce que la question demande.
 *
 * Avant, chaque question partait avec TOUT le contexte client (statistiques,
 * 25 trades, erreurs, signaux, objectifs, règles, souvenirs, 20 tours de
 * conversation) — « salut » compris. Le plan choisit désormais les blocs, les
 * lectures à préparer et les outils à offrir. Ces tests figent ces choix et
 * mesurent ce qu'ils retirent.
 */

const TODAY = "2026-10-01";
const plan = (q: string, opts?: { hasEdgeBlock?: boolean }) =>
  planContext(routeQuestion(q, { today: TODAY }), opts);

describe("plans par question", () => {
  test("bavardage : aucun outil, aucune lecture, historique court", () => {
    const p = plan("salut");
    expect(p.tools).toEqual([]);
    expect(p.prefetch).toEqual([]);
    expect(p.blocks).toEqual(["profile"]);
    expect(p.conversationTurns).toBe(4);
    expect(p.notices).toEqual([]);
  });

  test("produit : aucune donnée du journal, et l'absence de source vérifiée est DITE", () => {
    const p = plan("What does the free plan include?");
    expect(p.blocks).toEqual([]);
    expect(p.tools).toEqual([]);
    expect(p.notices).toEqual([UNAVAILABLE_NOTICE.product!]);
  });

  test("marché : aucune lecture inventée, l'avertissement « non branché » part au modèle", () => {
    const p = plan("What are today's important news?");
    expect(p.prefetch).toEqual([]);
    expect(p.notices).toEqual([UNAVAILABLE_NOTICE.market!]);
  });

  test("une période nommée : les stats de CETTE période sont lues, celles de tout l'historique retirées", () => {
    const p = plan("Combien j'ai gagné en septembre ?");
    expect(p.blocks).not.toContain("stats");
    expect(p.prefetch).toEqual([
      {
        tool: "get_stats",
        args: { since: "2026-09-01", until: "2026-09-30" },
        label: "stats 2026-09-01..2026-09-30",
      },
    ]);
  });

  test("comparaison : stats + erreurs des DEUX périodes, en parallèle", () => {
    const p = plan("What changed between August and September?");
    expect(p.prefetch.map((c) => `${c.tool} ${c.args.since}`)).toEqual([
      "get_stats 2026-08-01",
      "get_mistakes 2026-08-01",
      "get_stats 2026-09-01",
      "get_mistakes 2026-09-01",
    ]);
    expect(p.conversationTurns).toBe(12);
  });

  test("une journée : get_day pour la date, rien d'autre de préchargé", () => {
    const p = plan("Qu'est-ce que j'avais noté le 12 ?");
    expect(p.prefetch).toEqual([
      { tool: "get_day", args: { date: "2026-09-12" }, label: "day le 12" },
    ]);
  });

  test("« pourquoi » : les signaux de comportement accompagnent les chiffres", () => {
    const p = plan("Why did I lose today?");
    expect(p.blocks).toContain("signals");
    expect(p.blocks).toContain("mistakes");
    for (const s of ["byWeekday", "bySession", "bySymbol", "byStrategy"])
      expect(p.signalKeys).toContain(s);
  });

  test("diagnostic (niveau ≥ 3) : tous les outils de lecture sont offerts", () => {
    const p = plan("Are my losses concentrated around specific sessions?");
    for (const t of [
      "get_profile",
      "get_day",
      "get_stats",
      "get_trades",
      "get_mistakes",
      "search_memory",
    ])
      expect(p.tools).toContain(t);
  });

  test("Edge Score déjà envoyé par le client : l'outil serveur (sans checklist) n'est pas offert", () => {
    const q = "Are my losses concentrated around specific sessions?";
    expect(plan(q).tools).toContain("get_edge_score");
    expect(plan(q, { hasEdgeBlock: true }).tools).not.toContain("get_edge_score");
  });

  test("lectures dédoublonnées et plafonnées à 6", () => {
    const p = plan(
      "Fais-moi une analyse complète de mon trading, mes erreurs, mon plan, mes règles et mon risque",
    );
    const keys = p.prefetch.map((c) => `${c.tool}:${JSON.stringify(c.args)}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(p.prefetch.length).toBeLessThanOrEqual(6);
  });
});

describe("sources branchables (LOT 5 : calendrier, news) sans nouvelle architecture", () => {
  test("une source branchée lève l'avertissement et ajoute ses lectures et outils", () => {
    const off = registerContextSource({
      domain: "market",
      prefetch: () => [{ tool: "get_calendar", args: { hours: 2 }, label: "calendar next 2h" }],
      tools: ["get_calendar"],
    });
    try {
      const p = plan("What's coming in the next two hours?");
      expect(p.notices).toEqual([]);
      expect(p.prefetch.map((c) => c.tool)).toEqual(["get_calendar"]);
      expect(p.tools).toEqual(["get_calendar"]);
    } finally {
      off();
    }
    expect(plan("What's coming in the next two hours?").notices).toEqual([
      UNAVAILABLE_NOTICE.market!,
    ]);
  });
});

describe("préchargement", () => {
  function fakeTool(
    name: string,
    opts: { delayMs?: number; sideEffect?: boolean; fail?: string; seen?: ToolContext[] },
  ) {
    return registerTool({
      name,
      description: "test tool",
      inputSchema: { type: "object" },
      sideEffect: opts.sideEffect ?? false,
      source: "local",
      async execute(input, ctx) {
        opts.seen?.push(ctx);
        if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
        if (opts.fail) throw new Error(opts.fail);
        return { echo: input };
      },
    });
  }

  test("les lectures partent EN PARALLÈLE, sous l'identité et le compte de la requête", async () => {
    const seen: ToolContext[] = [];
    const offs = [
      fakeTool("test_pf_a", { delayMs: 120, seen }),
      fakeTool("test_pf_b", { delayMs: 120, seen }),
      fakeTool("test_pf_c", { delayMs: 120, seen }),
    ];
    try {
      const started = Date.now();
      const res = await executePrefetch(
        ["test_pf_a", "test_pf_b", "test_pf_c"].map((tool) => ({
          tool,
          args: { x: 1 },
          label: tool,
        })),
        { userId: "u1", accountId: "acc1" },
      );
      const elapsed = Date.now() - started;
      expect(res.every((r) => r.ok)).toBe(true);
      // En série : ≥ 360 ms. En parallèle : ~120 ms.
      expect(elapsed).toBeLessThan(300);
      expect(seen.map((c) => `${c.userId}/${c.accountId}`)).toEqual([
        "u1/acc1",
        "u1/acc1",
        "u1/acc1",
      ]);
    } finally {
      offs.forEach((off) => off());
    }
  });

  test("ne lève jamais : échec, délai dépassé, outil inconnu et outil d'écriture sont rendus comme tels", async () => {
    const offs = [
      fakeTool("test_pf_fail", { fail: "db down" }),
      fakeTool("test_pf_slow", { delayMs: 500 }),
      fakeTool("test_pf_write", { sideEffect: true }),
    ];
    try {
      const res = await executePrefetch(
        ["test_pf_fail", "test_pf_slow", "test_pf_write", "test_pf_missing"].map((tool) => ({
          tool,
          args: {},
          label: tool,
        })),
        { userId: "u1" },
        80,
      );
      expect(res.map((r) => r.ok)).toEqual([false, false, false, false]);
      expect(res[0].error).toBe("db down");
      expect(res[1].error).toBe("prefetch timeout");
      expect(res[2].error).toBe("side-effecting tool refused");
      expect(res[3].error).toBe("unknown tool test_pf_missing");
      const text = prefetchBlocks(res);
      expect(text).toContain("UNAVAILABLE — test_pf_fail");
      expect(text).toContain('Do NOT treat it as "no data"');
    } finally {
      offs.forEach((off) => off());
    }
  });

  test("un bloc préchargé dit sa provenance et son compte", () => {
    const text = prefetchBlocks([
      {
        call: { tool: "get_stats", args: {}, label: "stats 2026-09-01..2026-09-30" },
        ok: true,
        output: { totalPnl: 120 },
        durationMs: 4,
      },
    ]);
    expect(text).toContain("MEASURED — stats 2026-09-01..2026-09-30");
    expect(text).toContain("active account");
    expect(text).toContain('{"totalPnl":120}');
  });

  test("une sortie longue est raccourcie en le DISANT, jamais coupée en silence", () => {
    const output = {
      matched: 400,
      trades: Array.from({ length: 400 }, (_, i) => ({
        id: i,
        symbol: "NQ",
        pnl: i,
        notes: "x".repeat(40),
      })),
    };
    const json = compactOutput(output, 8_000);
    expect(json.length).toBeLessThanOrEqual(8_000);
    const parsed = JSON.parse(json) as {
      matched: number;
      trades: unknown[];
      tradesShownForBrevity: string;
    };
    expect(parsed.matched).toBe(400);
    expect(parsed.tradesShownForBrevity).toBe(`${parsed.trades.length} of 400`);
    expect(compactOutput({ a: 1 })).toBe('{"a":1}');
  });
});

describe("aucun contexte massif inutile", () => {
  const size = (q: string) => {
    const input = fullCoachInput(q);
    const full = buildCoachMessages(input).reduce((n, m) => n + m.content.length, 0);
    const p = planContext(routeQuestion(q, { today: TODAY }), { hasEdgeBlock: true });
    const kept = buildCoachMessages(selectInputForPlan(input, p)).reduce(
      (n, m) => n + m.content.length,
      0,
    );
    return { full, kept, ratio: kept / full };
  };

  test("« salut » n'emporte plus le journal", () => {
    const s = size("salut");
    expect(s.ratio).toBeLessThan(0.6);
    const kept = selectInputForPlan(fullCoachInput("salut"), plan("salut"));
    expect(kept.trades).toBeUndefined();
    expect(kept.stats).toBeUndefined();
    expect(kept.signals).toBeUndefined();
    expect(kept.conversation?.length).toBe(4);
  });

  test("une question produit n'emporte aucune donnée du trader", () => {
    const kept = selectInputForPlan(
      fullCoachInput("What does the free plan include?"),
      plan("What does the free plan include?"),
    );
    for (const k of [
      "stats",
      "trades",
      "mistakes",
      "signals",
      "goals",
      "rules",
      "memory",
      "profile",
    ] as const)
      expect(kept[k]).toBeUndefined();
  });

  test("une analyse garde ce qu'elle exige, et seulement les signaux visés", () => {
    const q = "Pourquoi je perds autant le lundi ?";
    const kept = selectInputForPlan(fullCoachInput(q), plan(q, { hasEdgeBlock: true }));
    expect(kept.mistakes?.length).toBe(4);
    expect(Object.keys(kept.signals ?? {})).toContain("byWeekday");
    expect(kept.trades).toBeUndefined();
  });

  test("l'échelle du compte suit toujours, elle ne se retire jamais", () => {
    const kept = selectInputForPlan(fullCoachInput("salut"), plan("salut"));
    expect(kept.calibration?.scale).toBe(0.5);
  });
});
