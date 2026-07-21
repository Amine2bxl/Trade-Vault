import { test, expect } from "bun:test";
import { buildCoachMessages, isReviewIntent, runCoach } from "../src/modules/ai/agents/coach.agent";
import type { AIProvider, AIRequest, AIResponse } from "../src/modules/ai/infra";

test("coach prompt grounds on the trader's real data (stats, trades, mistakes, goals)", () => {
  const messages = buildCoachMessages({
    question: "Where am I losing money?",
    language: "en",
    stats: { winRate: 0.42, profitFactor: 0.9 },
    trades: [
      {
        date: "2026-07-01",
        symbol: "ES",
        direction: "long",
        pnl: -120,
        rMultiple: -1,
        strategy: "breakout",
        mistakes: ["overtrading"],
        setupQuality: 2,
        confluences: [],
      },
    ],
    mistakes: [{ name: "overtrading", count: 7, totalPnl: -840 }],
    goals: [{ kind: "winRate", target: 0.55, current: 0.42 }],
  });

  const system = messages[0];
  expect(system.role).toBe("system");
  // Persona + the non-negotiable "never invent" contract are both present.
  expect(system.content).toContain("performance coach");
  expect(system.content).toContain("STRICT DATA RULE");

  const grounded = messages.map((m) => m.content).join("\n");
  expect(grounded).toContain("RECURRING MISTAKES");
  expect(grounded).toContain("overtrading");
  expect(grounded).toContain("PRECOMPUTED STATS");
  expect(grounded).toContain("ACTIVE GOALS");
  expect(grounded).toContain("Where am I losing money?");
});

test("coach handles missing data without fabricating context blocks", () => {
  const messages = buildCoachMessages({ question: "How am I doing?" });
  // The user turn carries the grounded context blocks; with no data it must
  // carry none (the block *markers* below only appear when data is injected —
  // unlike the rule text in the system prompt, which merely names them).
  const userTurn = messages[messages.length - 1].content;
  expect(userTurn).not.toContain("trust these numbers");
  expect(userTurn).not.toContain("RECENT TRADES (");
  expect(userTurn).toContain("How am I doing?");
});

test("runCoach returns the provider's answer via the injected provider", async () => {
  const fake: AIProvider = {
    id: "fake",
    isConfigured: () => true,
    async complete(_req: AIRequest): Promise<AIResponse> {
      return { text: "## 💡 Bottom Line\n**Cut overtrading.**", provider: "fake", model: "m" };
    },
  };
  const res = await runCoach(
    { question: "help", stats: { winRate: 0.5 } },
    { provider: fake },
  );
  expect(res.text).toContain("Bottom Line");
  expect(res.provider).toBe("fake");
});

test("V2: memory and the trader's own rules are injected as grounded blocks", () => {
  const messages = buildCoachMessages({
    question: "What should I focus on?",
    memory: [{ kind: "profile", content: "style: scalping; main weakness to watch: overtrading" }],
    rules: [{ kind: "max_trades", text: "Max 3 trades per day", enabled: true }],
    goals: [{ kind: "win_rate", target: 55, current: 42 }],
  });
  const grounded = messages.map((m) => m.content).join("\n");
  expect(grounded).toContain("LONG-TERM MEMORY");
  expect(grounded).toContain("main weakness to watch: overtrading");
  expect(grounded).toContain("THE TRADER'S OWN RULES");
  expect(grounded).toContain("Max 3 trades per day");
});

test("V2: default format is conversational (no report sections imposed)", () => {
  const messages = buildCoachMessages({ question: "Why did I lose on Friday?" });
  const system = messages[0].content;
  expect(system).toContain("like a coach in conversation");
  expect(system).not.toContain("Stats Snapshot");
  // Coaching doctrine is part of the persona.
  expect(system).toContain("AT MOST 2 concrete actions");
  expect(system).toContain("fewer than 10 relevant trades");
});

test("V2: an explicit review request triggers the structured report format", () => {
  for (const q of ["Give me a full review of my trading", "Fais le bilan complet de mon mois"]) {
    const system = buildCoachMessages({ question: q })[0].content;
    expect(system).toContain("Stats Snapshot");
  }
});

test("V2: review-intent detection is deterministic and conservative", () => {
  expect(isReviewIntent("full review please")).toBe(true);
  expect(isReviewIntent("fais le point sur ma semaine")).toBe(true);
  expect(isReviewIntent("why do I overtrade?")).toBe(false);
  expect(isReviewIntent("quel est mon winrate ?")).toBe(false);
});
