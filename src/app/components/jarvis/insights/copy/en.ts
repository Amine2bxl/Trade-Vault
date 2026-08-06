import type { JarvisInsight } from "../types";
import { actionLine, formatMoney, num, type HeroLineSpec, type JarvisVoiceMode } from "./templates";

/**
 * Jarvis's English voice.
 * Every line comes strictly from the insight's fields — no invented data,
 * no added causes, no generic motivational filler.
 */

export function enHeroLines(insight: JarvisInsight, mode: JarvisVoiceMode): HeroLineSpec[] {
  switch (insight.pattern) {
    case "risk_after_loss":
      return enRiskAfterLoss(insight, mode);
    case "overtrading":
      return enOvertrading(insight, mode);
    case "costliest_mistake":
      return enCostliestMistake(insight, mode);
    case "discipline_streak":
      return enDisciplineStreak(insight, mode);
    default:
      return [{ kind: "context", text: `I analysed your last ${insight.sampleSize} trades.` }];
  }
}

export function enLearning(sampleSize: number, _mode: JarvisVoiceMode): string {
  if (sampleSize < 5) {
    return "I don't have enough data to read your edge yet. Log your trades — I'll take it from there once there are enough.";
  }
  return "I'm starting to see a pattern, but the signal isn't strong enough to conclude yet. Keep logging your trades — I'll confirm as soon as it's solid.";
}

function enRiskAfterLoss(insight: JarvisInsight, mode: JarvisVoiceMode): HeroLineSpec[] {
  const drift = num(insight.evidence.driftPct);
  const lines: HeroLineSpec[] = [
    { kind: "context", text: `I analysed your last ${insight.sampleSize} trades.` },
  ];
  if (mode === "beginner") {
    lines.push({
      kind: "observation",
      text: `I see you risk ${drift}% more on the trade right after a loss. Risk is the size you put on each trade.`,
    });
  } else if (mode === "advanced") {
    lines.push({ kind: "observation", text: `Pattern: +${drift}% risk after a loss.` });
  } else {
    lines.push({
      kind: "observation",
      text: `You increase your risk by ${drift}% after a loss.`,
    });
  }
  if (insight.impact) {
    lines.push({
      kind: "impact",
      text: `This behaviour has cost you ${formatMoney(insight.impact.amount, "en")} across those ${insight.sampleSize} trades.`,
    });
  }
  lines.push({ kind: "action", text: `Today: ${actionLine(insight, "en")}.` });
  return lines;
}

function enOvertrading(insight: JarvisInsight, mode: JarvisVoiceMode): HeroLineSpec[] {
  const busy = num(insight.evidence.avgPnlPerTradeBusy);
  const calm = num(insight.evidence.avgPnlPerTradeCalm);
  const lines: HeroLineSpec[] = [
    { kind: "context", text: `I analysed ${insight.sampleSize} trades across your trading days.` },
  ];
  if (mode === "beginner") {
    lines.push({
      kind: "observation",
      text: `On your busy days you lose ${formatMoney(Math.abs(busy), "en")} per trade, versus ${calm >= 0 ? "+" : ""}${Math.round(calm)}$ on calm days. A busy day is a day with many trades.`,
    });
  } else if (mode === "advanced") {
    lines.push({
      kind: "observation",
      text: `Busy days: ${busy}$/trade vs ${calm >= 0 ? "+" : ""}${Math.round(calm)}$ on calm days.`,
    });
  } else {
    lines.push({
      kind: "observation",
      text: `On busy days you lose ${formatMoney(Math.abs(busy), "en")} per trade, versus ${calm >= 0 ? "+" : ""}${Math.round(calm)}$ on calm days.`,
    });
  }
  if (insight.impact) {
    lines.push({
      kind: "impact",
      text: `Your busy days add up to ${formatMoney(insight.impact.amount, "en")} in losses.`,
    });
  }
  lines.push({ kind: "action", text: `Today: ${actionLine(insight, "en")}.` });
  return lines;
}

function enCostliestMistake(insight: JarvisInsight, mode: JarvisVoiceMode): HeroLineSpec[] {
  const mistake = String(insight.evidence.mistake ?? "");
  const count = num(insight.evidence.count);
  const lines: HeroLineSpec[] = [
    { kind: "context", text: `I analysed ${count} trades tagged "${mistake}".` },
  ];
  if (mode === "beginner") {
    lines.push({
      kind: "observation",
      text: `"${mistake}" is your biggest process leak: it shows up ${count} times.`,
    });
  } else if (mode === "advanced") {
    lines.push({ kind: "observation", text: `Dominant mistake: "${mistake}" (${count}×).` });
  } else {
    lines.push({
      kind: "observation",
      text: `"${mistake}" appears ${count} times in your journal.`,
    });
  }
  if (insight.impact) {
    lines.push({
      kind: "impact",
      text: `It represents ${formatMoney(insight.impact.amount, "en")} in cumulative losses.`,
    });
  }
  lines.push({ kind: "action", text: `Today: ${actionLine(insight, "en")}.` });
  return lines;
}

function enDisciplineStreak(insight: JarvisInsight, mode: JarvisVoiceMode): HeroLineSpec[] {
  const streak = num(insight.evidence.currentStreak);
  const lines: HeroLineSpec[] = [
    { kind: "context", text: `I analysed your last ${insight.sampleSize} trades.` },
  ];
  if (mode === "beginner") {
    lines.push({
      kind: "observation",
      text: `You're on a ${streak}-win streak. That's an outcome, not yet proof: rule adherence is what tells you whether the process held.`,
    });
  } else if (mode === "advanced") {
    lines.push({ kind: "observation", text: `Current streak: ${streak} wins.` });
  } else {
    lines.push({
      kind: "observation",
      text: `You're on a ${streak}-trade winning streak.`,
    });
  }
  lines.push({ kind: "action", text: `Today: ${actionLine(insight, "en")}.` });
  return lines;
}
