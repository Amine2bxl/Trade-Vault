import { describe, expect, it } from "bun:test";
import { evaluateNotificationRules, type RuleContext } from "./rules";

// Un trader fictif — données stables, règles prévisibles.
function baseContext(overrides: Partial<RuleContext> = {}): RuleContext {
  const today = new Date().toISOString().slice(0, 10);
  return {
    trades: [
      { date: today, pnl: -120, mistakes: ["overtrading"] },
      { date: today, pnl: -80, mistakes: ["overtrading"] },
      { date: today, pnl: -55, mistakes: ["revenge_trading"] },
    ],
    stats: {
      totalPnl: -255,
      winRate: 0.2,
      tradeCount: 12,
      mistakeStats: {
        overtrading: { count: 6, totalPnl: -420 },
        revenge_trading: { count: 3, totalPnl: -90 },
      },
    },
    rulesEnabled: 2,
    ...overrides,
  };
}

const keyOf = (rules: ReturnType<typeof evaluateNotificationRules>, key: string) =>
  rules.some((r) => r.key.startsWith(key));

describe("coded notification rules", () => {
  it("flags a 3+ losing streak under Risk", () => {
    const rules = evaluateNotificationRules(baseContext());
    const streak = rules.find((r) => r.key.startsWith("risk_loss_streak"));
    expect(streak).toBeDefined();
    expect(streak!.input.kind).toBe("risk_loss_streak");
    expect(streak!.input.severity).toBe("warning");
    expect(streak!.input.category).toBe("risk");
  });

  it("does NOT flag a streak when recent trades win", () => {
    const today = new Date().toISOString().slice(0, 10);
    const rules = evaluateNotificationRules(
      baseContext({
        trades: [
          { date: today, pnl: 140, mistakes: [] },
          { date: today, pnl: -30, mistakes: [] },
          { date: today, pnl: 90, mistakes: [] },
        ],
      }),
    );
    expect(keyOf(rules, "risk_loss_streak")).toBe(false);
  });

  it("surfaces the most expensive mistake as a leak", () => {
    const rules = evaluateNotificationRules(baseContext());
    const leak = rules.find((r) => r.key.startsWith("risk_leak"));
    expect(leak).toBeDefined();
    expect(leak!.input.data?.["mistake"]).toBe("overtrading");
  });

  it("fires an activity lull when the last trade is 5+ days old", () => {
    const old = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
    const rules = evaluateNotificationRules(
      baseContext({ trades: [{ date: old, pnl: 40, mistakes: [] }] }),
    );
    expect(keyOf(rules, "activity_lull")).toBe(true);
  });

  it("does not fire a lull when trades are recent", () => {
    const rules = evaluateNotificationRules(baseContext());
    expect(keyOf(rules, "activity_lull")).toBe(false);
  });

  it("signs discipline is armed when rules are enabled", () => {
    const rules = evaluateNotificationRules(baseContext());
    expect(keyOf(rules, "discipline_armed")).toBe(true);
    const none = evaluateNotificationRules(baseContext({ rulesEnabled: 0 }));
    expect(keyOf(none, "discipline_armed")).toBe(false);
  });

  it("carries a short action plan and CTA on every rule", () => {
    for (const rule of evaluateNotificationRules(baseContext())) {
      expect(typeof rule.input.data?.["plan"]).toBe("string");
      expect(typeof rule.input.data?.["ctaLabel"]).toBe("string");
      expect(typeof rule.input.data?.["ctaPage"]).toBe("string");
      expect(rule.input.channels).toContain("dashboard");
    }
  });
});
