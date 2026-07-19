import type { Trade } from "@/app/types";
import type { AnalysisContext, AnalysisFlag, AnalysisGrade, TradeAnalysis } from "./types";

/**
 * Trade Analysis Engine — pure, deterministic, dependency-free.
 *
 * analyzeTrade(trade, ctx) → TradeAnalysis. Same input, same output —
 * safe to run on every save, in tests, on the server or in the browser.
 * The AI Core builds its coaching ON TOP of this object; nothing here
 * ever calls a model.
 */

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

function gradeOf(score: number): AnalysisGrade {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function analyzeTrade(trade: Trade, ctx: AnalysisContext): TradeAnalysis {
  const flags: AnalysisFlag[] = [];

  // ── Risk ────────────────────────────────────────────────────────────
  const riskPct =
    ctx.accountBalance > 0 && trade.riskAmount > 0
      ? (trade.riskAmount / ctx.accountBalance) * 100
      : null;
  if (trade.riskAmount <= 0) {
    flags.push({
      code: "no_stop_defined",
      severity: "warning",
      detail: "No risk amount recorded — R multiples and risk metrics are blind on this trade.",
    });
  } else if (riskPct !== null && riskPct > 3) {
    flags.push({
      code: "oversized_risk",
      severity: riskPct > 6 ? "critical" : "warning",
      detail: `${riskPct.toFixed(1)}% of the account risked on a single trade.`,
    });
  }

  // ── R:R quality ─────────────────────────────────────────────────────
  // Winners graded on captured R; losers on containment (a loss ≤ 1R is a
  // GOOD loss — the stop did its job).
  const r = trade.rMultiple;
  let rrScore: number;
  if (trade.direction === "be") rrScore = 60;
  else if (trade.pnl >= 0) rrScore = clamp(40 + r * 20);
  else rrScore = r >= -1.05 ? 70 : clamp(70 + (r + 1.05) * 35);
  if (trade.pnl < 0 && r < -1.5) {
    flags.push({
      code: "negative_expectancy_rr",
      severity: "critical",
      detail: `Loss ran to ${r.toFixed(1)}R — stop was moved or absent.`,
    });
  }

  // ── Setup adherence ─────────────────────────────────────────────────
  let setupScore = clamp(trade.setupQuality * 20); // setupQuality is 1–5
  if (trade.confluences.length === 0) {
    setupScore = clamp(setupScore - 15);
    flags.push({
      code: "missing_confluences",
      severity: "info",
      detail: "No confluences tagged — the setup can't be audited later.",
    });
  }
  if (trade.setupQuality <= 2) {
    flags.push({
      code: "low_setup_quality",
      severity: "warning",
      detail: `Setup graded ${trade.setupQuality}/5 by the trader — below the A+ bar.`,
    });
  }

  // ── Discipline context ──────────────────────────────────────────────
  let disciplineScore = 100;
  if (trade.mistakes.length > 0) {
    disciplineScore -= Math.min(60, trade.mistakes.length * 20);
    flags.push({
      code: "tagged_mistakes",
      severity: "warning",
      detail: `Mistakes tagged: ${trade.mistakes.join(", ")}.`,
    });
  }
  const dayLosses = ctx.sameDayTrades.filter((t) => t.direction !== "be" && t.pnl < 0).length;
  if (dayLosses >= 2 && trade.direction !== "be") {
    disciplineScore -= 15;
    flags.push({
      code: "revenge_window",
      severity: "warning",
      detail: `Entered after ${dayLosses} losses today — statistically the worst decision window.`,
    });
  }
  if (ctx.sameDayTrades.length + 1 > 5) {
    disciplineScore -= 10;
    flags.push({
      code: "overtrading_day",
      severity: "info",
      detail: `Trade #${ctx.sameDayTrades.length + 1} of the day.`,
    });
  }
  disciplineScore = clamp(disciplineScore);

  // ── Execution quality ───────────────────────────────────────────────
  let executionScore = 70; // neutral when MAE/MFE unknown
  let exitEfficiency: number | null = null;
  if (trade.mfe != null && trade.mfe > 0) {
    exitEfficiency = clamp(trade.pnl / trade.mfe, 0, 1);
    executionScore = clamp(exitEfficiency * 100);
    if (exitEfficiency < 0.4 && trade.pnl >= 0) {
      flags.push({
        code: "poor_exit_efficiency",
        severity: "info",
        detail: `Captured ${(exitEfficiency * 100).toFixed(0)}% of the move's best point.`,
      });
    }
  }
  if (
    trade.slippage != null &&
    trade.riskAmount > 0 &&
    Math.abs(trade.slippage) > trade.riskAmount * 0.15
  ) {
    executionScore = clamp(executionScore - 15);
    flags.push({
      code: "high_slippage",
      severity: "info",
      detail: `Slippage ate ${((Math.abs(trade.slippage) / trade.riskAmount) * 100).toFixed(0)}% of one R.`,
    });
  }

  // ── Composite ───────────────────────────────────────────────────────
  const score = Math.round(
    rrScore * 0.3 + setupScore * 0.25 + disciplineScore * 0.3 + executionScore * 0.15,
  );
  if (flags.length === 0) {
    flags.push({
      code: "clean_execution",
      severity: "info",
      detail: "No flags raised — plan followed, risk contained.",
    });
  }

  return {
    tradeId: trade.id,
    riskPct,
    rMultiple: r,
    rrScore: Math.round(rrScore),
    setupScore: Math.round(setupScore),
    disciplineScore: Math.round(disciplineScore),
    executionScore: Math.round(executionScore),
    score,
    grade: gradeOf(score),
    flags,
    exitEfficiency,
    computedAt: new Date().toISOString(),
  };
}
