import type { Trade, TradeStats } from "./trade";

// Edge Score v2: only independently verified, historically applicable evidence.
export const EDGE_WINDOW_DAYS = 10;
export const EDGE_SCORE_VERSION = 2;

// The two scored dimensions are not proxies of the same mistake tags.
const WEIGHTS = { cleanTrades: 0.65, risk: 0.35 } as const;
type RuleEvidence = "PASS" | "FAIL" | "UNKNOWN";

export interface EdgeInputs {
  maxRiskPct?: number | null;
  /** Kept for legacy callers. A current starting balance proves nothing historic. */
  startingBalance?: number | null;
  /** The supplied risk limit was actually applicable to the historical entries. */
  riskPlanVersionVerified?: boolean;
  /** Trade-level result from a time-valid and independent rule verifier. */
  ruleEvidenceByTradeId?: Readonly<Record<string, RuleEvidence>>;
  /** Reconstructed account balance immediately prior to the entry. */
  verifiedBalanceBeforeTrade?: Readonly<Record<string, number>>;
  /** Self-recorded preparation: displayed, but never used to grade adherence. */
  checklistByDay?: Record<string, number>;
}
export interface EdgeSubScore {
  value: number | null;
  detail?: string;
}
export interface EdgeResult {
  score: number | null;
  /** Weighted proportion of evidence available, distinct from the actual grade. */
  coveragePct: number;
  subs: {
    cleanTrades: EdgeSubScore;
    risk: EdgeSubScore;
    cleanDays: EdgeSubScore;
    routine: EdgeSubScore;
  };
  tradedDays: number;
  /** Days where ALL observed trades were verified compliant. */
  cleanDays: number;
  /** Days for which ALL trades have independent PASS/FAIL verdicts. */
  verifiedDays: number;
  weakest: "cleanTrades" | "risk" | "cleanDays" | "routine" | null;
}
function tradedDates(trades: Trade[]): string[] {
  return [...new Set(trades.map((t) => t.date))].sort((a, b) => b.localeCompare(a));
}

/** Never infer a trading plan from 1.5x the median historical risk. */
export function riskThreshold(
  _trades: Trade[],
  maxRiskPct?: number | null,
  startingBalance?: number | null,
): number | null {
  if (
    maxRiskPct == null ||
    !Number.isFinite(maxRiskPct) ||
    maxRiskPct <= 0 ||
    startingBalance == null ||
    !Number.isFinite(startingBalance) ||
    startingBalance <= 0
  ) {
    return null;
  }
  return (maxRiskPct / 100) * startingBalance;
}

export function computeEdgeScore(allTrades: Trade[], inputs: EdgeInputs = {}): EdgeResult {
  const blank = (): EdgeSubScore => ({ value: null });
  const subs = {
    cleanTrades: blank(),
    risk: blank(),
    cleanDays: blank(),
    routine: blank(),
  };
  const dates = tradedDates(allTrades).slice(0, EDGE_WINDOW_DAYS);
  const selected = new Set(dates);
  const window = allTrades.filter((t) => selected.has(t.date));
  const total = window.length;
  const tradedDays = dates.length;
  if (!total) {
    return {
      score: null,
      coveragePct: 0,
      subs,
      tradedDays: 0,
      cleanDays: 0,
      verifiedDays: 0,
      weakest: null,
    };
  }

  const evidence = inputs.ruleEvidenceByTradeId ?? {};
  const known = window.filter((t) => evidence[t.id] === "PASS" || evidence[t.id] === "FAIL");
  if (known.length > 0) {
    const passed = known.filter((t) => evidence[t.id] === "PASS").length;
    subs.cleanTrades = {
      value: (passed / known.length) * 100,
      detail: passed + "/" + known.length + " - " + known.length + "/" + total + " verified",
    };
  }

  let verifiedDays = 0;
  let cleanDays = 0;
  for (const date of dates) {
    const daily = window.filter((t) => t.date === date);
    if (daily.every((t) => evidence[t.id] === "PASS" || evidence[t.id] === "FAIL")) {
      verifiedDays++;
      if (daily.every((t) => evidence[t.id] === "PASS")) cleanDays++;
    }
  }
  if (verifiedDays > 0) {
    subs.cleanDays = {
      value: (cleanDays / verifiedDays) * 100,
      detail:
        cleanDays + "/" + verifiedDays + " - " + verifiedDays + "/" + tradedDays + " verified",
    };
  }

  // No verified balance at the entry or no historically valid rule => UNKNOWN.
  const limit = inputs.maxRiskPct;
  const balances = inputs.verifiedBalanceBeforeTrade ?? {};
  const riskKnown =
    inputs.riskPlanVersionVerified &&
    typeof limit === "number" &&
    Number.isFinite(limit) &&
    limit > 0
      ? window.filter((t) => {
          const balance = balances[t.id];
          return (
            Number.isFinite(t.riskAmount) &&
            t.riskAmount > 0 &&
            typeof balance === "number" &&
            Number.isFinite(balance) &&
            balance > 0
          );
        })
      : [];
  if (riskKnown.length > 0 && typeof limit === "number") {
    const within = riskKnown.filter(
      (t) => (t.riskAmount / balances[t.id]) * 100 <= limit + 1e-9,
    ).length;
    subs.risk = {
      value: (within / riskKnown.length) * 100,
      detail:
        within + "/" + riskKnown.length + " - " + riskKnown.length + "/" + total + " verified",
    };
  }

  const checklist = inputs.checklistByDay ?? {};
  const documented = dates.filter(
    (d) => typeof checklist[d] === "number" && Number.isFinite(checklist[d]),
  );
  if (documented.length > 0) {
    const completion = documented.reduce(
      (sum, d) => sum + Math.max(0, Math.min(1, checklist[d])),
      0,
    );
    subs.routine = {
      value: (completion / documented.length) * 100,
      detail: documented.length + "/" + tradedDays + " recorded",
    };
  }

  const coveragePct = Math.round(
    ((known.length / total) * WEIGHTS.cleanTrades + (riskKnown.length / total) * WEIGHTS.risk) *
      100,
  );
  // Minimum sample AND full evidence. Incomplete data cannot score 100/100.
  const complete =
    total >= 10 && tradedDays >= 5 && known.length === total && riskKnown.length === total;
  const score =
    complete && subs.cleanTrades.value !== null && subs.risk.value !== null
      ? Math.round(subs.cleanTrades.value * WEIGHTS.cleanTrades + subs.risk.value * WEIGHTS.risk)
      : null;
  const weakest: EdgeResult["weakest"] =
    score === null ? null : subs.cleanTrades.value! <= subs.risk.value! ? "cleanTrades" : "risk";
  return { score, coveragePct, subs, tradedDays, cleanDays, verifiedDays, weakest };
}

// ── Règle du jour (derived from the real recurring leak) ─────────────────────

export interface DailyRule {
  /** Short imperative rule, e.g. "Max 2 trades aujourd'hui". */
  text: string;
  /** The leak the rule targets, when derived from mistakeStats. */
  leak?: string;
}

/**
 * Derive today's rule from the trader's #1 money-bleeding mistake
 * (`stats.mistakeStats`, most negative total PnL). Returns null when there
 * isn't a clearly costly leak yet — the caller then shows a neutral fallback.
 * Never invents a rule.
 */
export function deriveDailyRule(stats: TradeStats): DailyRule | null {
  const entries = Object.entries(stats.mistakeStats);
  if (entries.length === 0) return null;
  // Largest negative PnL associated with a tagged mistake, not proof of causal cost.
  const worst = entries
    .filter(([, s]) => s.totalPnl < 0)
    .sort((a, b) => a[1].totalPnl - b[1].totalPnl)[0];
  if (!worst) return null;
  const [name, s] = worst;
  return { text: name, leak: `${name} · ${s.count}× · ${Math.round(s.totalPnl)}` };
}
