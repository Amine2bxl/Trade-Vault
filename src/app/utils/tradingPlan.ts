import { supabase } from "@/integrations/supabase/client";

// Written trading plan — the trader's own constitution: mission, markets,
// risk management, setups, limits, routine. Stored as one jsonb blob on the
// profile (profiles.trading_plan), autosaved from pages/TradingPlan.tsx.

export interface PlanSetup {
  id: string;
  name: string;
  /** Entry conditions / confluences, in the trader's words. */
  rules: string;
  /** Invalidation — when NOT to take it. */
  invalidation: string;
}

export interface TradingPlanData {
  /** Why I trade — the mission statement shown back on tilt days. */
  mission: string;
  /** Instruments traded (chips). */
  markets: string[];
  /** Trading window, e.g. "09:30–11:30 NY". */
  sessions: string;
  risk: {
    maxRiskPerTradePct: string;
    maxDailyLossPct: string;
    maxWeeklyLossPct: string;
    minRR: string;
  };
  setups: PlanSetup[];
  limits: {
    maxTradesPerDay: string;
    stopAfterLosses: string;
    noNews: boolean;
    noRevenge: boolean;
  };
  routine: {
    preMarket: string;
    postMarket: string;
    weekly: string;
  };
}

export const EMPTY_PLAN: TradingPlanData = {
  mission: "",
  markets: [],
  sessions: "",
  risk: { maxRiskPerTradePct: "", maxDailyLossPct: "", maxWeeklyLossPct: "", minRR: "" },
  setups: [],
  limits: { maxTradesPerDay: "", stopAfterLosses: "", noNews: false, noRevenge: false },
  routine: { preMarket: "", postMarket: "", weekly: "" },
};

/** Merge stored (possibly partial / older-shaped) json into the full shape. */
function normalize(raw: unknown): TradingPlanData {
  if (!raw || typeof raw !== "object") return structuredClone(EMPTY_PLAN);
  const r = raw as Partial<TradingPlanData>;
  return {
    mission: typeof r.mission === "string" ? r.mission : "",
    markets: Array.isArray(r.markets) ? r.markets.filter((m) => typeof m === "string") : [],
    sessions: typeof r.sessions === "string" ? r.sessions : "",
    risk: { ...EMPTY_PLAN.risk, ...(r.risk ?? {}) },
    setups: Array.isArray(r.setups)
      ? r.setups.map((s) => ({
          id: s?.id ?? crypto.randomUUID(),
          name: s?.name ?? "",
          rules: s?.rules ?? "",
          invalidation: s?.invalidation ?? "",
        }))
      : [],
    limits: { ...EMPTY_PLAN.limits, ...(r.limits ?? {}) },
    routine: { ...EMPTY_PLAN.routine, ...(r.routine ?? {}) },
  };
}

export async function loadTradingPlan(userId: string): Promise<TradingPlanData> {
  const { data, error } = await supabase
    .from("profiles")
    .select("trading_plan")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return normalize((data as any)?.trading_plan);
}

export async function saveTradingPlan(userId: string, plan: TradingPlanData): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ trading_plan: plan as any })
    .eq("id", userId);
  if (error) throw error;
}

/** 0..1 — how much of the plan is filled in (drives the completion ring). */
export function planCompletion(p: TradingPlanData): number {
  const checks = [
    p.mission.trim().length > 0,
    p.markets.length > 0,
    p.sessions.trim().length > 0,
    p.risk.maxRiskPerTradePct.trim().length > 0,
    p.risk.maxDailyLossPct.trim().length > 0,
    p.risk.minRR.trim().length > 0,
    p.setups.length > 0,
    p.limits.maxTradesPerDay.trim().length > 0,
    p.routine.preMarket.trim().length > 0,
    p.routine.postMarket.trim().length > 0,
  ];
  return checks.filter(Boolean).length / checks.length;
}
