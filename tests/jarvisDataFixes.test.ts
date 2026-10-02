import { describe, expect, test } from "bun:test";
import { ensureJarvisTools } from "../src/backend/ai-tools";
import {
  loadTradesWithMeta,
  rowToTrade,
  TRADES_HARD_CAP,
  TRADES_PAGE_SIZE,
} from "../src/backend/ai-tools/trades";
import { serviceClient } from "../src/backend/billing.server";
import { getTool } from "../src/modules/ai/tools/types";
import { resultsToMessage } from "../src/modules/ai/tools/runtime";
import { buildCoachMessages } from "../src/modules/ai/agents/coach.agent";
import { computeEdgeScore } from "../src/domain/edgeScore";
import { recentTrades, withoutProfileWhenSent } from "../src/app/features/jarvis/aiContext";
import { todayLocalDate } from "../src/shared/calendar-date";
import type { Trade } from "../src/app/types";
import { withFakePostgrest, type Row } from "./helpers/fakePostgrest";
import { readSource, requireIndex, stripComments } from "./helpers/source";

/**
 * LOT 2 — LES CORRECTIFS DE DONNÉES DE JARVIS (audit B1→B8, B12, B13, B15).
 *
 * Aucune intelligence ne tient sur des données fausses : chaque test ci-dessous
 * reproduit un bug constaté à l'audit et vérifie qu'il ne revient pas. Les
 * outils serveur sont exercés contre un PostgREST en mémoire qui contient AUSSI
 * les lignes d'un autre trader et d'un autre compte — c'est ce qui prouve le
 * cloisonnement, pas la lecture du code.
 */

ensureJarvisTools();

const U1 = "u1";
const U2 = "u2";

/** Une date de marché il y a `n` jours, en date LOCALE (jamais un découpage ISO). */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayLocalDate(d);
}

function tradeRow(i: number, over: Row = {}): Row {
  return {
    id: `t${String(i).padStart(6, "0")}`,
    user_id: U1,
    account_id: "acc1",
    trade_date: daysAgo(i % 300),
    symbol: "NQ",
    direction: "long",
    pnl: i % 3 === 0 ? -50 : 100,
    risk_amount: 50,
    r_multiple: i % 3 === 0 ? -1 : 2,
    strategy: "ORB",
    mistakes: i % 5 === 0 ? ["FOMO"] : [],
    setup_quality: 3,
    entry_time: "09:35",
    exit_time: "10:05",
    confluences: [],
    confidence: 3,
    mae: null,
    mfe: null,
    notes: null,
    ...over,
  };
}

/** Lignes triées comme la vraie requête : date décroissante, puis id décroissant. */
function sorted(rows: Row[]): Row[] {
  return [...rows].sort((a, b) =>
    a.trade_date === b.trade_date
      ? String(b.id).localeCompare(String(a.id))
      : String(b.trade_date).localeCompare(String(a.trade_date)),
  );
}

async function run(tool: string, args: Record<string, unknown>, accountId: string | null) {
  return (await getTool(tool)!.execute(args, { userId: U1, accountId })) as Record<string, unknown>;
}

// ── B7 — l'historique entier, pas les 1 000 premières lignes ─────────────────

describe("B7 — pagination de l'historique", () => {
  test("au-delà de 1 000 trades, tout l'historique est lu, page par page", async () => {
    const rows = sorted([
      ...Array.from({ length: 2_500 }, (_, i) => tradeRow(i)),
      ...Array.from({ length: 40 }, (_, i) => tradeRow(9_000 + i, { user_id: U2 })),
    ]);
    await withFakePostgrest({ trades: rows }, async (db) => {
      const { trades, truncated } = await loadTradesWithMeta(serviceClient()!, U1);
      expect(trades.length).toBe(2_500);
      expect(truncated).toBe(false);
      const pages = db.callsTo("trades");
      expect(pages.map((c) => c.params.offset)).toEqual(["0", "1000", "2000"]);
      for (const c of pages) {
        expect(c.params.limit).toBe(String(TRADES_PAGE_SIZE));
        expect(c.params.user_id).toBe(`eq.${U1}`);
        // Tri stable : sans départage par id, deux pages se chevauchent.
        expect(c.params.order).toBe("trade_date.desc,id.desc");
      }
    });
  });

  test("get_stats compte les 2 500 trades — le même total que le tableau de bord", async () => {
    const rows = sorted(Array.from({ length: 2_500 }, (_, i) => tradeRow(i)));
    await withFakePostgrest({ trades: rows }, async () => {
      const out = await run("get_stats", { days: 1825 }, null);
      expect(out.totalTrades).toBe(2_500);
      expect((out.window as Record<string, unknown>).historyTruncated).toBeUndefined();
    });
  });

  test("au-delà du garde-fou, la coupure est DITE au modèle", async () => {
    const rows = Array.from({ length: TRADES_HARD_CAP + 5 }, (_, i) =>
      tradeRow(i, { trade_date: "2026-01-15" }),
    );
    await withFakePostgrest({ trades: rows }, async () => {
      const out = await run("get_stats", { since: "2026-01-01", until: "2026-01-31" }, null);
      expect(out.totalTrades).toBe(TRADES_HARD_CAP);
      expect((out.window as Record<string, unknown>).historyTruncated).toBe(true);
    });
  });
});

// ── Cloisonnement : utilisateur ET compte actif, pour chaque outil ───────────

describe("compte actif — chaque lecture est cloisonnée", () => {
  const db = () => ({
    trades: sorted([
      ...Array.from({ length: 12 }, (_, i) => tradeRow(i + 1, { account_id: "acc1" })),
      ...Array.from({ length: 7 }, (_, i) => tradeRow(100 + i, { account_id: "acc2", pnl: 9_999 })),
      ...Array.from({ length: 5 }, (_, i) =>
        tradeRow(200 + i, { user_id: U2, account_id: "acc1", pnl: 7_777 }),
      ),
    ]),
    profiles: [
      { id: U1, trading_plan: { risk: { maxRiskPerTradePct: "1" } }, starting_balance: 25_000 },
    ],
    accounts: [
      { id: "acc1", user_id: U1, starting_balance: 50_000 },
      { id: "acc2", user_id: U1, starting_balance: 10_000 },
    ],
  });

  test.each(["get_stats", "get_trades", "get_mistakes", "get_edge_score"])(
    "%s ne lit que les trades de l'utilisateur, sur le compte actif",
    async (tool) => {
      await withFakePostgrest(db(), async (pg) => {
        const out = await run(tool, {}, "acc1");
        const reads = pg.callsTo("trades").filter((c) => c.params.select?.includes("trade_date"));
        expect(reads.length).toBeGreaterThan(0);
        for (const c of reads) {
          expect(c.params.user_id).toBe(`eq.${U1}`);
          expect(c.params.account_id).toBe("eq.acc1");
        }
        // Aucun montant d'un autre compte ou d'un autre trader ne remonte.
        expect(JSON.stringify(out)).not.toContain("9999");
        expect(JSON.stringify(out)).not.toContain("7777");
      });
    },
  );

  test("sans compte actif, la lecture couvre tous les comptes DE L'UTILISATEUR seulement", async () => {
    await withFakePostgrest(db(), async (pg) => {
      const out = await run("get_trades", { limit: 50 }, null);
      expect(out.matched).toBe(19);
      for (const c of pg.callsTo("trades")) {
        expect(c.params.user_id).toBe(`eq.${U1}`);
        expect(c.params.account_id).toBeUndefined();
      }
      expect(JSON.stringify(out)).not.toContain("7777");
    });
  });

  test("Edge Score : mêmes entrées que le tableau de bord (risque du plan, solde du compte)", async () => {
    await withFakePostgrest(db(), async (pg) => {
      const out = await run("get_edge_score", {}, "acc1");
      const trades = (db().trades as Row[])
        .filter((r) => r.user_id === U1 && r.account_id === "acc1")
        .map((r) => rowToTrade(r as unknown as Parameters<typeof rowToTrade>[0]));
      const attendu = computeEdgeScore(trades, { maxRiskPct: 1, startingBalance: 50_000 });
      expect(out.score).toBe(attendu.score);
      expect(out.subs).toEqual(attendu.subs);
      // Le solde est lu sous user_id : un identifiant de compte forgé ne rend rien.
      const compte = pg.callsTo("accounts")[0];
      expect(compte.params.id).toBe("eq.acc1");
      expect(compte.params.user_id).toBe(`eq.${U1}`);
    });
  });
});

// ── B2 — les notes promises sont rendues ─────────────────────────────────────

describe("B2 — notes des trades", () => {
  test("get_trades rend les notes des lignes renvoyées, lues sous user_id", async () => {
    const rows = sorted([
      tradeRow(1, { notes: "Entrée trop tôt, j'ai anticipé la cassure." }),
      tradeRow(2, { notes: "   " }),
      tradeRow(3),
    ]);
    await withFakePostgrest({ trades: rows }, async (pg) => {
      const out = await run("get_trades", { limit: 10 }, null);
      const trades = out.trades as { notes: string | null }[];
      const notes = trades.map((t) => t.notes);
      expect(notes).toContain("Entrée trop tôt, j'ai anticipé la cassure.");
      // Une note vide reste `null` : jamais un faux « tu as écrit "" ».
      expect(notes.filter((n) => n === null).length).toBe(2);
      const lecture = pg.callsTo("trades").find((c) => c.params.select === "id,notes");
      expect(lecture).toBeDefined();
      expect(lecture!.params.user_id).toBe(`eq.${U1}`);
      expect(lecture!.params.id.startsWith("in.(")).toBe(true);
    });
  });
});

// ── B3 — profil : règles et plan jsonb, objectifs du compte actif ────────────

describe("B3 — get_profile", () => {
  const tables = {
    profiles: [
      {
        id: U1,
        name: "Amine",
        trading_rules: [
          { kind: "max_trades", value: "3", text: "Pas plus de 3 trades par jour", enabled: true },
          { kind: "custom", text: "Pas de trade pendant les news", enabled: false },
        ],
        trading_plan: { mission: "Trader propre", risk: { maxRiskPerTradePct: "0.5" } },
        active_account_id: "acc1",
      },
    ],
    accounts: [
      { id: "acc1", user_id: U1, name: "Perso", created_at: "2026-01-01" },
      { id: "acc2", user_id: U1, name: "Prop", created_at: "2026-02-01" },
      { id: "acc9", user_id: U2, name: "Autre", created_at: "2026-02-01" },
    ],
    goal_plans: [
      {
        user_id: U1,
        account_id: "acc1",
        goals: [{ kind: "net_pnl", targetValue: 1_000 }],
        started_at: "2026-01-01",
        horizon_months: 6,
      },
      {
        user_id: U1,
        account_id: "acc2",
        goals: [{ kind: "max_drawdown", targetValue: 5 }],
        started_at: "2026-02-01",
        horizon_months: 3,
      },
      {
        user_id: U2,
        account_id: "acc2",
        goals: [{ kind: "win_rate", targetValue: 99 }],
        started_at: "2026-02-01",
        horizon_months: 1,
      },
    ],
    subscriptions: [{ user_id: U1, plan: "pro", status: "active" }],
  };

  test("règles et plan sont lus comme du jsonb, pas comme du texte", async () => {
    await withFakePostgrest(tables, async () => {
      const out = await run("get_profile", {}, "acc2");
      const rules = out.rules as { text: string; enabled: boolean }[];
      expect(rules.map((r) => r.text)).toEqual([
        "Pas plus de 3 trades par jour",
        "Pas de trade pendant les news",
      ]);
      expect(rules[1].enabled).toBe(false);
      const plan = out.plan as { mission: string; risk: { maxRiskPerTradePct: number } };
      expect(plan.mission).toBe("Trader propre");
      expect(plan.risk.maxRiskPerTradePct).toBe(0.5);
    });
  });

  test("les objectifs viennent de goal_plans, pour le compte REGARDÉ", async () => {
    await withFakePostgrest(tables, async (pg) => {
      const out = await run("get_profile", {}, "acc2");
      const goalPlan = out.goalPlan as { goals: { kind: string; direction: string }[] };
      expect(goalPlan.goals.length).toBe(1);
      expect(goalPlan.goals[0].kind).toBe("max_drawdown");
      expect(goalPlan.goals[0].direction).toBe("down");
      const lecture = pg.callsTo("goal_plans")[0];
      expect(lecture.params.user_id).toBe(`eq.${U1}`);
      expect(lecture.params.account_id).toBe("eq.acc2");
      // L'ancienne table, que plus aucun code n'écrit, n'est plus lue.
      expect(pg.callsTo("six_month_goals").length).toBe(0);
    });
  });

  test("le compte actif est celui de la requête, pas la dernière sélection en base", async () => {
    await withFakePostgrest(tables, async () => {
      const out = await run("get_profile", {}, "acc2");
      const accounts = out.accounts as { name: string; active: boolean }[];
      expect(accounts.map((a) => a.name)).toEqual(["Perso", "Prop"]);
      expect(accounts.filter((a) => a.active).map((a) => a.name)).toEqual(["Prop"]);
    });
  });

  test("une lecture d'objectifs en échec est DITE, le profil reste servi", async () => {
    await withFakePostgrest(
      tables,
      async () => {
        const out = await run("get_profile", {}, "acc1");
        expect(out.goalPlan).toBeNull();
        expect(out.unavailable).toEqual(["goalPlan"]);
        expect(out.firstName).toBe("Amine");
      },
      { fail: ["goal_plans"] },
    );
  });
});

// ── B6 — get_day : plus de table fantôme, des échecs nommés ──────────────────

describe("B6 — get_day", () => {
  const jour = daysAgo(3);
  const tables = {
    trades: sorted([
      tradeRow(3, { trade_date: jour, notes: "Revenge après le stop." }),
      tradeRow(4, { trade_date: jour, account_id: "acc2" }),
    ]),
    trading_sessions: [
      { user_id: U1, account_id: "acc1", session_date: jour, daily_objective: "2 trades max" },
      { user_id: U1, account_id: "acc2", session_date: jour, daily_objective: "autre compte" },
    ],
    missed_opportunities: [],
    trade_intent: [],
    trade_reflection: [],
  };

  test("la checklist est déclarée locale à l'appareil, aucune table inexistante n'est lue", async () => {
    await withFakePostgrest(tables, async (pg) => {
      const out = await run("get_day", { date: jour }, "acc1");
      expect(out.checklist).toBe("device-local — not readable server-side");
      expect(pg.callsTo("discipline_days").length).toBe(0);
      expect(out.unavailable).toBeUndefined();
      expect(out.tradeCount).toBe(1);
      const trades = out.trades as { notes: string | null }[];
      expect(trades[0].notes).toBe("Revenge après le stop.");
      const sessions = out.sessions as { daily_objective: string }[];
      expect(sessions.map((s) => s.daily_objective)).toEqual(["2 trades max"]);
      expect(pg.callsTo("trading_sessions")[0].params.account_id).toBe("eq.acc1");
      expect(pg.callsTo("missed_opportunities")[0].params.account_id).toBe("eq.acc1");
    });
  });

  test("une section illisible est listée dans `unavailable`, jamais rendue vide en silence", async () => {
    await withFakePostgrest(
      tables,
      async () => {
        const out = await run("get_day", { date: jour }, "acc1");
        expect(out.unavailable).toEqual(["sessions", "missedOpportunities"]);
      },
      { fail: ["trading_sessions", "missed_opportunities"] },
    );
  });
});

// ── B1 — les trades RÉCENTS ──────────────────────────────────────────────────

describe("B1 — trades récents envoyés au coach", () => {
  function t(id: string, date: string, entryTime = "10:00"): Trade {
    return { ...rowToTrade(tradeRow(1) as never), id, date, entryTime };
  }

  test("les plus récents d'abord, quel que soit l'ordre reçu", () => {
    const trades = [
      t("a", "2026-01-02"),
      t("b", "2026-03-01", "09:00"),
      t("c", "2026-03-01", "15:00"),
      t("d", "2025-12-31"),
    ];
    expect(recentTrades(trades, 2).map((x) => x.id)).toEqual(["c", "b"]);
    expect(recentTrades(trades).length).toBe(4);
  });

  test("la conversation n'utilise plus `slice(-25)` pour choisir les trades", () => {
    const src = stripComments(
      readSource(
        import.meta.dir,
        "../src/app/features/jarvis/workspaces/ConversationWorkspace.tsx",
      ),
    );
    expect(src).toContain("recentTrades(context.trades)");
    expect(src).not.toMatch(/trades\.slice\(-\s*\d+\)/);
  });
});

// ── B4 — objectifs du compte actif côté client ───────────────────────────────

test("B4 — useGoalProgress reçoit le compte actif", () => {
  const src = stripComments(
    readSource(import.meta.dir, "../src/app/features/jarvis/workspaces/ConversationWorkspace.tsx"),
  );
  expect(src.replace(/\s+/g, " ")).toContain(
    "useGoalProgress( context.trades, userId, activeAccountId, )",
  );
});

// ── B5 — échelle et simulation arrivent dans le prompt ───────────────────────

describe("B5 — calibration et simulation", () => {
  test("le schéma de la requête les accepte", () => {
    const src = stripComments(readSource(import.meta.dir, "../src/backend/coach.functions.ts"));
    const shape = src.slice(
      requireIndex(src, "const CoachAskShape"),
      requireIndex(src, "const CoachAsk ="),
    );
    expect(shape).toContain("calibration:");
    expect(shape).toContain("simulation:");
  });

  test("une échelle ≠ 1 et une simulation sont posées dans le prompt", () => {
    const messages = buildCoachMessages({
      question: "et si je risquais moitié moins ?",
      calibration: { originalBalance: 100_000, currentBalance: 50_000, scale: 0.5 },
      simulation: {
        engineVersion: "mc-1",
        method: "bootstrap",
        sampleSize: 120,
        passProbability: 0.62,
        riskOfRuin: 0.04,
        medianPnl: 1_250,
        medianDrawdown: 800,
        horizonTrades: 60,
        scenario: "risk ×0.5",
      },
    });
    const all = messages.map((m) => m.content).join("\n");
    expect(all).toContain("0.5× scale");
    expect(all).toContain("SIMULATION");
    expect(all).toContain("risk ×0.5");
  });

  test("une échelle de 1 n'ajoute rien", () => {
    const messages = buildCoachMessages({
      question: "mon P&L ?",
      calibration: { originalBalance: 50_000, currentBalance: 50_000, scale: 1 },
    });
    expect(messages.map((m) => m.content).join("\n")).not.toContain("× scale");
  });
});

// ── B8 — le message de résultats n'invite plus à boucler ─────────────────────

test("B8 — les résultats d'outils demandent de répondre, pas de rappeler l'outil", () => {
  const msg = resultsToMessage([{ id: "c1", name: "get_stats", output: { totalTrades: 3 } }]);
  expect(msg.content).toContain("TOOL RESULTS");
  expect(msg.content).toContain("use it to answer");
  expect(msg.content).toContain("only with different arguments");
  expect(msg.toolResults?.[0]).toMatchObject({ id: "c1", name: "get_stats" });
});

// ── B12 — « Demander à Jarvis » ouvre la fenêtre ─────────────────────────────

test("B12 — askJarvis ouvre le panneau en plus de poser la question", () => {
  const src = stripComments(
    readSource(import.meta.dir, "../src/app/features/jarvis/AiAssistant.tsx"),
  );
  const start = requireIndex(src, "const askJarvis = useCallback(");
  const body = src.slice(start, start + 600);
  expect(body).toContain("setPendingPrompt(prompt)");
  expect(body).toContain("setOpen(true)");
});

// ── B13 — l'extraction mémoire ne coûte pas de quota pour rien ───────────────

describe("B13 — quotas de l'extraction mémoire", () => {
  test("le garde latéral ne compte aucun quota ; le quota horaire est appliqué APRÈS les filtres", () => {
    const guard = stripComments(readSource(import.meta.dir, "../src/backend/require-pro.ts"));
    const side = guard.slice(requireIndex(guard, "export const requireJarvisSideAccess"));
    expect(side.slice(0, 200).replace(/\s+/g, " ")).toContain(
      "accessGuard({ entitlement: false, daily: false, hourly: false",
    );
    expect(guard).toContain("export async function enforceHourlyAiQuota");

    const mem = stripComments(readSource(import.meta.dir, "../src/backend/memory.functions.ts"));
    const quota = requireIndex(mem, "await enforceHourlyAiQuota(");
    expect(requireIndex(mem, "if (!isEnabled())")).toBeLessThan(quota);
    expect(requireIndex(mem, 'skipped: "no_marker"')).toBeLessThan(quota);
  });

  test("le client ne déclenche l'extraction que pour une phrase qui peut en porter une", () => {
    const src = stripComments(
      readSource(
        import.meta.dir,
        "../src/app/features/jarvis/workspaces/ConversationWorkspace.tsx",
      ),
    );
    expect(src).toContain("if (!shouldAttemptExtraction(question)) return;");
  });
});

// ── B15 — le profil n'est envoyé qu'une fois ─────────────────────────────────

describe("B15 — profil en double", () => {
  test("client : le souvenir `profile` est retiré quand le profil part dans son champ", () => {
    const memory = [
      { kind: "profile", content: "Scalpeur NQ" },
      { kind: "commitment", content: "2 trades max" },
    ];
    expect(withoutProfileWhenSent(memory, "Scalpeur NQ").map((m) => m.kind)).toEqual([
      "commitment",
    ]);
    expect(withoutProfileWhenSent(memory, undefined).length).toBe(2);
  });

  test("serveur : même dédoublonnage, le prompt ne porte le profil qu'une fois", () => {
    const messages = buildCoachMessages({
      question: "salut",
      profile: "Scalpeur NQ, 2 ans d'expérience",
      memory: [
        { kind: "profile", content: "Scalpeur NQ (souvenir)" },
        { kind: "commitment", content: "Je coupe après 2 pertes" },
      ],
    });
    const all = messages.map((m) => m.content).join("\n");
    expect(all).toContain("Scalpeur NQ, 2 ans d'expérience");
    expect(all).not.toContain("Scalpeur NQ (souvenir)");
    expect(all).toContain("Je coupe après 2 pertes");
  });
});
