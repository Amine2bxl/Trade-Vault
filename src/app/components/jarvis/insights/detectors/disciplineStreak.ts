import { confidenceFrom } from "../confidence";
import type { Detector } from "./types";

/**
 * discipline_streak — la discipline paie.
 *
 * Moment POSITIF : soit une série de victoires en cours (≥ 3, signal de
 * process respecté), soit une amélioration de forme récente (last 20 trades
 * meilleurs que les 20 précédents, sur winrate ET PnL). Jarvis reconnaît la
 * progression et la protège — il ne punit que les vraies fuites.
 */
export const disciplineStreakDetector: Detector = (data) => {
  const s = data.stats;
  const rf = data.signals.recentForm;
  const streak = s.currentStreakType === "win" ? s.currentStreak : 0;
  const improving =
    !!rf &&
    rf.previous.winRatePct !== null &&
    rf.last.winRatePct !== null &&
    rf.last.winRatePct >= rf.previous.winRatePct &&
    rf.last.pnl > rf.previous.pnl;

  if (streak < 3 && !improving) return null;

  const effect = Math.max(streak / 5, improving ? 0.7 : 0);
  const evidence: Record<string, number | string> = {
    currentStreak: streak,
    currentStreakType: s.currentStreakType,
  };
  if (rf) {
    evidence.lastPnl = rf.last.pnl;
    evidence.previousPnl = rf.previous.pnl;
    evidence.lastWinRatePct = rf.last.winRatePct ?? 0;
    evidence.previousWinRatePct = rf.previous.winRatePct ?? 0;
  }

  return {
    moment: "brief",
    pattern: "discipline_streak",
    priority: 0,
    confidence: confidenceFrom(s.totalTrades, effect),
    sampleSize: s.totalTrades,
    evidence,
    impact: null,
    mission: ["protect_streak", "no_overconfidence"],
  };
};
