import type { Trade, TradeStats } from "../types";
import type { BehavioralReport } from "./behavioral";
import type { QuantStats } from "./quantStats";

/**
 * Insight engine — turns numbers into verdicts and next actions.
 *
 * Analytics and Mistakes already display plenty of figures; what was missing is
 * the "so what". This module reads the deterministic engines and emits short,
 * ranked, actionable statements — the difference between a journal and a coach.
 *
 * Rules (same discipline as the AI surfaces):
 *   • every insight cites a real number from the data
 *   • nothing is emitted when the sample is too thin to be honest
 *   • no market prediction, no financial advice — behaviour and performance only
 */

export type InsightTone = "good" | "warn" | "bad" | "neutral";

export interface Insight {
  /** Stable key for React lists and i18n. */
  id: string;
  tone: InsightTone;
  /** The verdict, in plain language, citing real figures. */
  title: string;
  /** The concrete next action. */
  action?: string;
  /** Ranking weight — higher shows first. */
  weight: number;
}

const fr = (lang?: string) => (lang ?? "en").toLowerCase().startsWith("fr");
const money = (v: number) =>
  `${v < 0 ? "-" : ""}$${Math.abs(Math.round(v)).toLocaleString("en-US")}`;

/** Minimum decisive trades before we allow ourselves a verdict. */
const MIN_SAMPLE = 8;

/**
 * Verdicts for the Analytics page: what the metrics actually mean, and what to
 * do about them. Returns [] when the sample is too small.
 */
export function analyticsInsights(
  trades: Trade[],
  stats: TradeStats,
  quant: QuantStats,
  lang?: string,
): Insight[] {
  const F = fr(lang);
  const out: Insight[] = [];
  const decisive = stats.wins + stats.losses;
  if (decisive < MIN_SAMPLE) return out;

  // Profit factor — the headline verdict.
  if (stats.profitFactor < 1) {
    out.push({
      id: "pf-below-1",
      tone: "bad",
      weight: 100,
      title: F
        ? `Profit factor ${stats.profitFactor.toFixed(2)} : tes pertes dépassent tes gains.`
        : `Profit factor ${stats.profitFactor.toFixed(2)}: your losses outweigh your wins.`,
      action: F
        ? "Ne prends que les setups à R:R ≥ 2 sur tes 20 prochains trades, puis recompare."
        : "Take only R:R ≥ 2 setups over your next 20 trades, then compare again.",
    });
  } else if (stats.profitFactor >= 1.5) {
    out.push({
      id: "pf-solid",
      tone: "good",
      weight: 40,
      title: F
        ? `Profit factor ${stats.profitFactor.toFixed(2)} — ton edge est réel.`
        : `Profit factor ${stats.profitFactor.toFixed(2)} — your edge is real.`,
      action: F
        ? "Ne change rien au process. Augmente la taille seulement après 20 trades de plus à ce niveau."
        : "Change nothing in the process. Size up only after 20 more trades at this level.",
    });
  }

  // Win rate vs payoff — the classic misread.
  const payoff = Math.abs(stats.avgLoss) > 0 ? Math.abs(stats.avgWin / stats.avgLoss) : null;
  if (payoff !== null && stats.winRate < 0.4 && payoff >= 2) {
    out.push({
      id: "low-wr-high-payoff",
      tone: "good",
      weight: 55,
      title: F
        ? `Win rate ${(stats.winRate * 100).toFixed(0)}% mais gain moyen ${payoff.toFixed(1)}× la perte moyenne — c'est un profil viable.`
        : `Win rate ${(stats.winRate * 100).toFixed(0)}% but average win is ${payoff.toFixed(1)}× the average loss — that's a viable profile.`,
      action: F
        ? "Ne cherche pas à « gagner plus souvent » : protège la taille de tes gagnants."
        : "Don't chase a higher win rate: protect the size of your winners.",
    });
  }
  if (payoff !== null && payoff < 1 && stats.winRate < 0.55) {
    out.push({
      id: "poor-payoff",
      tone: "bad",
      weight: 90,
      title: F
        ? `Tes pertes moyennes (${money(stats.avgLoss)}) dépassent tes gains moyens (${money(stats.avgWin)}).`
        : `Your average loss (${money(stats.avgLoss)}) exceeds your average win (${money(stats.avgWin)}).`,
      action: F
        ? "Laisse courir les gagnants d'un R de plus, ou coupe les perdants un R plus tôt."
        : "Let winners run one more R, or cut losers one R earlier.",
    });
  }

  // Drawdown against the account.
  if (quant.maxDrawdownPct !== null && quant.maxDrawdownPct >= 0.2) {
    out.push({
      id: "deep-dd",
      tone: "bad",
      weight: 85,
      title: F
        ? `Drawdown maximum de ${(quant.maxDrawdownPct * 100).toFixed(0)}% — au-delà de ce qu'un challenge tolère.`
        : `Max drawdown of ${(quant.maxDrawdownPct * 100).toFixed(0)}% — beyond what a challenge tolerates.`,
      action: F
        ? "Divise ton risque par trade par deux jusqu'à revenir sous 10%."
        : "Halve your per-trade risk until you're back under 10%.",
    });
  }

  // Best / worst weekday — only when there's enough per-day data.
  const days = Object.entries(stats.pnlByDayOfWeek).filter(([, d]) => d.count >= 3);
  if (days.length >= 2) {
    const sorted = [...days].sort((a, b) => b[1].pnl - a[1].pnl);
    const [bestDay, bestData] = sorted[0];
    const [worstDay, worstData] = sorted[sorted.length - 1];
    if (worstData.pnl < 0 && bestData.pnl > 0) {
      const name = (d: string) =>
        new Date(2024, 0, 7 + Number(d)).toLocaleDateString(F ? "fr" : "en", { weekday: "long" });
      out.push({
        id: "weekday-spread",
        tone: "warn",
        weight: 70,
        title: F
          ? `${name(bestDay)} te rapporte ${money(bestData.pnl)}, ${name(worstDay)} te coûte ${money(worstData.pnl)}.`
          : `${name(bestDay)} makes you ${money(bestData.pnl)}, ${name(worstDay)} costs you ${money(worstData.pnl)}.`,
        action: F
          ? `Teste deux semaines sans trader le ${name(worstDay)} et compare ton P&L.`
          : `Try two weeks without trading ${name(worstDay)} and compare your P&L.`,
      });
    }
  }

  // Strategy concentration — where the money actually comes from.
  const strategies = Object.entries(stats.pnlByStrategy).filter(([, d]) => d.count >= 3);
  if (strategies.length >= 2) {
    const sorted = [...strategies].sort((a, b) => b[1].pnl - a[1].pnl);
    const [bestName, best] = sorted[0];
    const [worstName, worst] = sorted[sorted.length - 1];
    if (worst.pnl < 0) {
      out.push({
        id: "strategy-drag",
        tone: "warn",
        weight: 75,
        title: F
          ? `« ${worstName} » te coûte ${money(worst.pnl)} sur ${worst.count} trades, pendant que « ${bestName} » rapporte ${money(best.pnl)}.`
          : `"${worstName}" costs you ${money(worst.pnl)} over ${worst.count} trades, while "${bestName}" makes ${money(best.pnl)}.`,
        action: F
          ? `Suspends « ${worstName} » et reporte ce risque sur « ${bestName} ».`
          : `Pause "${worstName}" and move that risk to "${bestName}".`,
      });
    }
  }

  // Losing streak in progress — the moment discipline breaks.
  if (stats.currentStreakType === "loss" && stats.currentStreak >= 3) {
    out.push({
      id: "loss-streak",
      tone: "bad",
      weight: 95,
      title: F
        ? `${stats.currentStreak} pertes d'affilée en cours.`
        : `${stats.currentStreak} losses in a row right now.`,
      action: F
        ? "Réduis ta taille de moitié jusqu'à deux gagnants consécutifs."
        : "Halve your size until two consecutive winners.",
    });
  }

  return out.sort((a, b) => b.weight - a.weight);
}

/**
 * Verdicts for the Mistakes page: what the leaks cost, and the campaign to
 * close them. Returns [] when nothing has been logged.
 */
export function mistakeInsights(report: BehavioralReport, lang?: string): Insight[] {
  const F = fr(lang);
  const out: Insight[] = [];
  if (report.totalIncidents === 0) return out;

  const worst = report.rows.filter((r) => r.totalPnl < 0)[0];
  if (worst) {
    out.push({
      id: "top-leak",
      tone: "bad",
      weight: 100,
      title: F
        ? `« ${worst.mistake} » t'a coûté ${money(worst.totalPnl)} sur ${worst.count} trades.`
        : `"${worst.mistake}" cost you ${money(worst.totalPnl)} across ${worst.count} trades.`,
      action: F
        ? `Ajoute « ${worst.mistake} » comme point bloquant de ta checklist pré-market.`
        : `Add "${worst.mistake}" as a blocking item on your pre-market checklist.`,
    });
  }

  // The edge you lose by being undisciplined — the single most convincing number.
  if (report.cleanWinRate !== null && report.mistakeWinRate !== null) {
    const gap = (report.cleanWinRate - report.mistakeWinRate) * 100;
    if (gap >= 5) {
      out.push({
        id: "clean-edge",
        tone: "good",
        weight: 90,
        title: F
          ? `Tes trades propres gagnent ${gap.toFixed(0)} points de win rate de plus que les autres.`
          : `Your clean trades win ${gap.toFixed(0)} more win-rate points than the rest.`,
        action: F
          ? "La discipline n'est pas un confort : c'est ton edge chiffré."
          : "Discipline isn't comfort: it's your measurable edge.",
      });
    }
  }

  // Trend over the last weeks — is it improving?
  const wk = report.weeklyTrend;
  if (wk.length >= 4) {
    const half = Math.floor(wk.length / 2);
    const older = wk.slice(0, half).reduce((s, w) => s + w.count, 0);
    const recent = wk.slice(half).reduce((s, w) => s + w.count, 0);
    if (recent < older) {
      out.push({
        id: "trend-improving",
        tone: "good",
        weight: 60,
        title: F
          ? `Tes erreurs reculent : ${older} → ${recent} sur les dernières semaines.`
          : `Your mistakes are receding: ${older} → ${recent} over recent weeks.`,
        action: F ? "Continue exactement ce que tu fais." : "Keep doing exactly what you're doing.",
      });
    } else if (recent > older) {
      out.push({
        id: "trend-worsening",
        tone: "warn",
        weight: 80,
        title: F
          ? `Tes erreurs augmentent : ${older} → ${recent} sur les dernières semaines.`
          : `Your mistakes are rising: ${older} → ${recent} over recent weeks.`,
        action: F
          ? "Reprends la checklist avant chaque session pendant 10 jours."
          : "Run the checklist before every session for 10 days.",
      });
    }
  }

  // Concentration by session — when discipline actually breaks.
  const sessions = Object.entries(report.bySession).filter(([, n]) => n > 0);
  if (sessions.length >= 2) {
    const [topSession, topCount] = sessions.sort((a, b) => b[1] - a[1])[0];
    const share = topCount / report.totalIncidents;
    if (share >= 0.5) {
      out.push({
        id: "session-concentration",
        tone: "warn",
        weight: 70,
        title: F
          ? `${Math.round(share * 100)}% de tes erreurs arrivent sur la session ${topSession}.`
          : `${Math.round(share * 100)}% of your mistakes happen in the ${topSession} session.`,
        action: F
          ? `Traite la session ${topSession} comme une zone à risque : moitié de taille, checklist obligatoire.`
          : `Treat the ${topSession} session as a risk zone: half size, mandatory checklist.`,
      });
    }
  }

  return out.sort((a, b) => b.weight - a.weight);
}
