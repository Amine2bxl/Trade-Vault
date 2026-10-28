import type { Trade } from "@/domain";
import type { AnalysisContext, AnalysisFlag, AnalysisGrade, TradeAnalysis } from "./types";

/** No grade is issued without complete, verifiable coverage of the composite. */
const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

function gradeOf(score: number): AnalysisGrade {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

function minuteOf(value?: string): number | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * A reported absence of errors, an unknown stop or an unreviewed import is not
 * affirmative proof of a well-executed trade. Only the proven portion is scored.
 */
export function analyzeTrade(trade: Trade, ctx: AnalysisContext): TradeAnalysis {
  const flags: AnalysisFlag[] = [];
  const knownRisk = Number.isFinite(trade.riskAmount) && trade.riskAmount > 0;
  const entryBalance =
    ctx.balanceIsAtEntry && Number.isFinite(ctx.accountBalance) && ctx.accountBalance > 0
      ? ctx.accountBalance
      : null;
  const riskPct =
    entryBalance !== null && knownRisk ? (trade.riskAmount / entryBalance) * 100 : null;

  if (!knownRisk) {
    flags.push({
      code: "no_stop_defined",
      severity: "warning",
      detail: "Initial risk was not recorded; realized R cannot be verified.",
    });
  } else if (riskPct !== null && riskPct > 3) {
    flags.push({
      code: "oversized_risk",
      severity: riskPct > 6 ? "critical" : "warning",
      detail: "Reported risk was " + riskPct.toFixed(1) + "% of the verified entry balance.",
    });
  }

  const r = knownRisk && Number.isFinite(trade.pnl) ? trade.pnl / trade.riskAmount : null;
  let rrScore: number | null = null;
  if (r !== null) {
    if (trade.pnl === 0) rrScore = 60;
    else if (trade.pnl > 0) rrScore = clamp(40 + r * 20);
    else rrScore = r >= -1.05 ? 70 : clamp(70 + (r + 1.05) * 35);
    if (r < -1.5) {
      flags.push({
        code: "negative_expectancy_rr",
        severity: "critical",
        detail:
          "The realized loss was " +
          Math.abs(r).toFixed(1) +
          "R. The recorded result alone does not establish whether a stop was moved.",
      });
    }
  }

  const qualityKnown =
    !trade.reviewPending &&
    Number.isInteger(trade.setupQuality) &&
    trade.setupQuality >= 1 &&
    trade.setupQuality <= 5;
  let setupScore: number | null = qualityKnown ? clamp(trade.setupQuality * 20) : null;
  if (qualityKnown && trade.confluences.length === 0) {
    setupScore = clamp(setupScore! - 15);
    flags.push({
      code: "missing_confluences",
      severity: "info",
      detail: "No confluences were documented for this reviewed setup.",
    });
  }
  if (qualityKnown && trade.setupQuality <= 2) {
    flags.push({
      code: "low_setup_quality",
      severity: "warning",
      detail: "Trader-rated setup quality: " + trade.setupQuality + "/5.",
    });
  }

  // No mistake-tags is NOT proof that the trading plan was followed.
  const adherence = ctx.verifiedRuleAdherencePct;
  const disciplineScore =
    adherence !== null &&
    adherence !== undefined &&
    Number.isFinite(adherence) &&
    adherence >= 0 &&
    adherence <= 100
      ? adherence
      : null;
  if (trade.mistakes.length > 0) {
    flags.push({
      code: "tagged_mistakes",
      severity: "warning",
      detail: "Self-reported mistakes: " + trade.mistakes.join(", ") + ".",
    });
  }

  // The automation may send the entire day, including future trades.
  const entryMinute = minuteOf(trade.entryTime);
  if (entryMinute !== null) {
    const closedLosses = ctx.sameDayTrades.filter((previous) => {
      const previousEntry = minuteOf(previous.entryTime);
      const exitMinute = minuteOf(previous.exitTime);
      // Une sortie « avant » l'entrée ne prouve rien si la position a été
      // ouverte après (sortie le lendemain, horodatée 01:00) : l'entrée et la
      // sortie précédentes doivent toutes deux précéder ce trade, le même jour.
      // La perte se lit sur le P&L net, pas sur l'étiquette « be ».
      return (
        previous.pnl < 0 &&
        previousEntry !== null &&
        exitMinute !== null &&
        previousEntry <= exitMinute &&
        exitMinute < entryMinute
      );
    });
    if (closedLosses.length >= 2 && trade.direction !== "be") {
      flags.push({
        code: "revenge_window",
        severity: "warning",
        detail:
          "Trade entered after " +
          closedLosses.length +
          " prior positions had closed at a loss. Motivation cannot be inferred.",
      });
    }
    const allOrdered = ctx.sameDayTrades.every((previous) => {
      const m = minuteOf(previous.entryTime);
      return m !== null && m !== entryMinute;
    });
    if (allOrdered) {
      const earlierCount = ctx.sameDayTrades.filter(
        (previous) => minuteOf(previous.entryTime)! < entryMinute,
      ).length;
      if (earlierCount + 1 > 5) {
        flags.push({
          code: "overtrading_day",
          severity: "info",
          detail: "Entry number " + (earlierCount + 1) + " on this trading day.",
        });
      }
    }
  }

  // No measured MFE = no execution score. Net PnL / MFE is only interpretable
  // for profitable trades with a positive recorded excursion in account units.
  let exitEfficiency: number | null = null;
  let executionScore: number | null = null;
  if (
    trade.pnl >= 0 &&
    Number.isFinite(trade.pnl) &&
    trade.mfe != null &&
    Number.isFinite(trade.mfe) &&
    trade.mfe > 0
  ) {
    exitEfficiency = Math.min(1, Math.max(0, trade.pnl / trade.mfe));
    executionScore = clamp(exitEfficiency * 100);
    if (exitEfficiency < 0.4) {
      flags.push({
        code: "poor_exit_efficiency",
        severity: "info",
        detail: "Recorded realized PnL represents less than 40% of recorded MFE.",
      });
    }
  }
  if (
    trade.slippage != null &&
    Number.isFinite(trade.slippage) &&
    knownRisk &&
    Math.abs(trade.slippage) > trade.riskAmount * 0.15
  ) {
    if (executionScore !== null) executionScore = clamp(executionScore - 15);
    flags.push({
      code: "high_slippage",
      severity: "info",
      detail: "Recorded slippage exceeds 15% of the reported initial risk.",
    });
  }

  const measured = [
    { value: rrScore, weight: 0.3 },
    { value: setupScore, weight: 0.25 },
    { value: disciplineScore, weight: 0.3 },
    { value: executionScore, weight: 0.15 },
  ];
  const coverage = measured.reduce((sum, item) => sum + (item.value === null ? 0 : item.weight), 0);
  const coveragePct = Math.round(coverage * 100);
  const score =
    coveragePct === 100
      ? Math.round(measured.reduce((sum, item) => sum + item.value! * item.weight, 0))
      : null;

  if (score === null) {
    flags.push({
      code: "insufficient_evidence",
      severity: "info",
      detail:
        "Only " +
        coveragePct +
        "% of the weighted analysis is measurable. No overall grade is issued.",
    });
  } else if (flags.length === 0) {
    flags.push({
      code: "clean_execution",
      severity: "info",
      detail: "No violation was detected in the fields covered by this analysis.",
    });
  }

  return {
    tradeId: trade.id,
    riskPct,
    rMultiple: r,
    rrScore: rrScore === null ? null : Math.round(rrScore),
    setupScore: setupScore === null ? null : Math.round(setupScore),
    disciplineScore: disciplineScore === null ? null : Math.round(disciplineScore),
    executionScore: executionScore === null ? null : Math.round(executionScore),
    coveragePct,
    score,
    grade: score === null ? null : gradeOf(score),
    flags,
    exitEfficiency,
    computedAt: new Date().toISOString(),
  };
}
