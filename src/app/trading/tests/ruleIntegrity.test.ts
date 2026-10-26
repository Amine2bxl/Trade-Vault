import { describe, expect, it } from "bun:test";
import { evaluateTradeRule, type TradingRule } from "@/domain/ruleCheck";
import { computeRuleAdherence, inspectRuleAdherence } from "../ruleAdherence";
import type { Trade } from "@/app/types";

let n = 0;
const t = (date: string, time: string, pnl = 100): Trade => ({
  id: "t-" + ++n,
  date,
  entryTime: time,
  exitTime: "",
  symbol: "NQ",
  direction: pnl < 0 ? "short" : "long",
  pnl,
  riskAmount: 100,
  rMultiple: pnl / 100,
  strategy: "test",
  mistakes: [],
  notes: "",
  screenshots: [],
  confluences: [],
  confidence: 50,
  setupQuality: 3,
});
const rule = (kind: TradingRule["kind"], value: string): TradingRule => ({
  id: kind,
  kind,
  value,
  text: kind,
  enabled: true,
});

describe("quant rule correctness", () => {
  it("missing entry time is UNKNOWN, never PASS", () => {
    const one = t("2026-10-01", "");
    const target = rule("no_trade_after", "16:00");
    expect(
      evaluateTradeRule(one, target, { sameDayTrades: [], accountBalance: 25000 }).status,
    ).toBe("UNKNOWN");
    expect(computeRuleAdherence([one], [target], 25000)).toEqual([]);
  });
  it("shows UNKNOWN-only rules in the evidence report without inventing an adherence rate", () => {
    const report = inspectRuleAdherence(
      [t("2026-10-01", "")],
      [rule("no_trade_after", "16:00")],
      25000,
    );
    expect(report).toHaveLength(1);
    expect(report[0].ratePct).toBeNull();
    expect(report[0].unknown).toBe(1);
    expect(report[0].coveragePct).toBe(0);
  });
  it("tracks the real verified sample and coverage", () => {
    const rows = [
      t("2026-10-01", "10:00"),
      t("2026-10-02", ""),
      t("2026-10-03", "17:30"),
      t("2026-10-04", "11:00"),
    ];
    const [result] = inspectRuleAdherence(rows, [rule("no_trade_after", "16:00")], 25000);
    expect(result.applicable).toBe(3);
    expect(result.kept).toBe(2);
    expect(result.unknown).toBe(1);
    expect(result.observations).toBe(4);
    expect(result.ratePct).toBe(67);
    expect(result.coveragePct).toBe(75);
    expect(computeRuleAdherence(rows, [rule("no_trade_after", "16:00")], 25000)).toEqual([]);
  });
  it("does not include future losses in an earlier trade's rule status", () => {
    const date = "2026-10-01";
    const rows = [
      t(date, "12:30"),
      t(date, "11:30", -100),
      t(date, "09:30"),
      t(date, "10:30", -100),
    ];
    const [result] = computeRuleAdherence(rows, [rule("stop_after_losses", "2")], 25000);
    expect(result.kept).toBe(3);
    expect(result.applicable).toBe(4);
    expect(result.ratePct).toBe(75);
  });
  it("counts day trades by entry time, not input array position", () => {
    const date = "2026-10-01";
    const rows = [t(date, "10:15"), t(date, "09:30"), t(date, "09:45")];
    const [result] = computeRuleAdherence(rows, [rule("max_trades_day", "2")], 25000);
    expect(result.kept).toBe(2);
    expect(result.applicable).toBe(3);
  });
  it("does not invent ordering for trades with the same minute", () => {
    const date = "2026-10-01";
    const rows = [t(date, "09:30"), t(date, "09:30"), t("2026-10-02", "09:45")];
    const [result] = computeRuleAdherence(rows, [rule("max_trades_day", "2")], 25000);
    expect(result.applicable).toBe(1);
    expect(result.unknown).toBe(2);
    expect(result.coveragePct).toBe(33);
  });
  it("does not interpret an unknown initial risk as compliance", () => {
    const row = t("2026-10-01", "09:30");
    row.riskAmount = 0;
    const status = evaluateTradeRule(row, rule("max_risk_pct", "1"), {
      sameDayTrades: [],
      accountBalance: 25000,
    }).status;
    expect(status).toBe("UNKNOWN");
  });
});
