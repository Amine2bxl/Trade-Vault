import type { AnyClient } from "./trades";

/**
 * LE PLAN, LES RÈGLES ET LES OBJECTIFS — lus côté serveur, sous leur VRAIE forme.
 *
 * ── LE BUG QUE CE MODULE CORRIGE (B3) ──────────────────────────────────────
 * `get_profile` lisait `profiles.trading_rules` et `profiles.trading_plan` avec
 * un assistant qui n'acceptait que des CHAÎNES. Or ce sont des colonnes jsonb
 * (un tableau et un objet, voir les migrations `goals_rules` et
 * `trading_plan_goal_plans`) : l'outil rendait `null` pour les deux, toujours.
 * Les objectifs, eux, étaient lus dans `six_month_goals`, table que plus aucun
 * code n'écrit depuis Goals 2.0 (`goal_plans`, un plan par COMPTE). Jarvis
 * répondait « tu n'as pas de plan » à un trader qui en avait un.
 *
 * Les formes sont celles qu'écrit le client (`app/trading/tradingRules.ts`,
 * `app/trading/tradingPlan.ts`, `app/features/goals/goalPlan.ts`). On ne les
 * importe pas — ces fichiers importent le client Supabase du navigateur — mais
 * on les lit avec la même tolérance : un champ absent ou d'un ancien format est
 * ignoré, jamais fatal.
 *
 * Les fonctions de mise en forme sont PURES (testées sans base) ; seules les
 * deux fonctions `load…` touchent la base, toujours sous `user_id`.
 */

/** Plafonds : ces blocs reviennent dans le prompt. */
const MAX = {
  rules: 30,
  ruleText: 300,
  setups: 10,
  text: 300,
  markets: 20,
  goals: 12,
} as const;

const str = (v: unknown, max: number = MAX.text): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

// ── Règles ───────────────────────────────────────────────────────────────────

export interface CompactRule {
  kind: string;
  /** Le paramètre (seuil, heure…) quand la règle en a un. */
  value: string | null;
  /** La règle dans les mots du trader. */
  text: string;
  enabled: boolean;
}

/** `profiles.trading_rules` (jsonb tableau) → règles compactes. */
export function parseTradingRules(raw: unknown): CompactRule[] {
  if (!Array.isArray(raw)) return [];
  const out: CompactRule[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const text = str(o.text, MAX.ruleText);
    if (!text) continue;
    out.push({
      kind: str(o.kind, 40) ?? "custom",
      value: str(o.value, 40),
      text,
      enabled: o.enabled !== false,
    });
    if (out.length >= MAX.rules) break;
  }
  return out;
}

// ── Plan de trading ──────────────────────────────────────────────────────────

export interface CompactPlan {
  mission: string | null;
  markets: string[];
  sessions: string | null;
  risk: {
    maxRiskPerTradePct: number | null;
    maxDailyLossPct: number | null;
    maxWeeklyLossPct: number | null;
    minRR: number | null;
  };
  setups: { name: string; rules: string | null; invalidation: string | null }[];
  limits: {
    maxTradesPerDay: number | null;
    stopAfterLosses: number | null;
    noNews: boolean;
    noRevenge: boolean;
  };
  routine: { preMarket: string | null; postMarket: string | null; weekly: string | null };
}

/** Un nombre saisi en texte (« 1 », « 1,5 », « 2 % »), ou `null`. */
function planNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const n = Number.parseFloat(v.replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * `profiles.trading_plan` (jsonb objet) → plan compact, ou `null` quand le
 * trader n'a rien écrit (le défaut SQL est `{}`). « Pas de plan » et « plan
 * vide » se disent pareil au modèle : il n'y a rien à citer.
 */
export function compactTradingPlan(raw: unknown): CompactPlan | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const obj = (v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const risk = obj(r.risk);
  const limits = obj(r.limits);
  const routine = obj(r.routine);
  const plan: CompactPlan = {
    mission: str(r.mission),
    markets: Array.isArray(r.markets)
      ? r.markets
          .map((m) => str(m, 30))
          .filter((m): m is string => !!m)
          .slice(0, MAX.markets)
      : [],
    sessions: str(r.sessions, 120),
    risk: {
      maxRiskPerTradePct: planNumber(risk.maxRiskPerTradePct),
      maxDailyLossPct: planNumber(risk.maxDailyLossPct),
      maxWeeklyLossPct: planNumber(risk.maxWeeklyLossPct),
      minRR: planNumber(risk.minRR),
    },
    setups: Array.isArray(r.setups)
      ? r.setups
          .map((s) => obj(s))
          .map((s) => ({
            name: str(s.name, 80) ?? "",
            rules: str(s.rules, 200),
            invalidation: str(s.invalidation, 200),
          }))
          .filter((s) => s.name || s.rules)
          .slice(0, MAX.setups)
      : [],
    limits: {
      maxTradesPerDay: planNumber(limits.maxTradesPerDay),
      stopAfterLosses: planNumber(limits.stopAfterLosses),
      noNews: limits.noNews === true,
      noRevenge: limits.noRevenge === true,
    },
    routine: {
      preMarket: str(routine.preMarket, 200),
      postMarket: str(routine.postMarket, 200),
      weekly: str(routine.weekly, 200),
    },
  };
  const empty =
    !plan.mission &&
    plan.markets.length === 0 &&
    !plan.sessions &&
    Object.values(plan.risk).every((v) => v === null) &&
    plan.setups.length === 0 &&
    plan.limits.maxTradesPerDay === null &&
    plan.limits.stopAfterLosses === null &&
    !plan.limits.noNews &&
    !plan.limits.noRevenge &&
    Object.values(plan.routine).every((v) => v === null);
  return empty ? null : plan;
}

/**
 * Le risque max par trade du plan, en % — la même lecture que le tableau de
 * bord (`useEdgeScore` : `parseFloat(plan.risk.maxRiskPerTradePct)`, strictement
 * positif). Sans elle, l'Edge Score serveur divergeait de celui affiché.
 */
export function planMaxRiskPct(raw: unknown): number | null {
  if (!raw || typeof raw !== "object") return null;
  const risk = (raw as { risk?: { maxRiskPerTradePct?: unknown } }).risk;
  const v = risk?.maxRiskPerTradePct;
  const pct = typeof v === "number" ? v : typeof v === "string" ? Number.parseFloat(v) : NaN;
  return Number.isFinite(pct) && pct > 0 ? pct : null;
}

// ── Objectifs (goal_plans) ───────────────────────────────────────────────────

export interface CompactGoal {
  kind: string;
  label: string | null;
  unit: string | null;
  /** Le sens du progrès : `down` pour le drawdown (plus bas = mieux). */
  direction: "up" | "down";
  startValue: number | null;
  targetValue: number | null;
  /** Objectifs personnalisés : valeur mise à jour à la main par le trader. */
  manualValue: number | null;
}

export interface CompactGoalPlan {
  startedAt: string | null;
  horizonMonths: number | null;
  goals: CompactGoal[];
}

/** Une ligne `goal_plans` → objectifs compacts (sans la mesure, voir plus bas). */
export function compactGoalPlan(row: unknown): CompactGoalPlan | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const goals: CompactGoal[] = [];
  for (const g of Array.isArray(r.goals) ? r.goals : []) {
    if (!g || typeof g !== "object") continue;
    const o = g as Record<string, unknown>;
    const kind = str(o.kind, 30);
    if (!kind) continue;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    goals.push({
      kind,
      label: str(o.label, 80),
      unit: str(o.unit, 12),
      // Même règle que `goalDirection` (goalPlan.ts) : le drawdown se réduit.
      direction:
        kind === "max_drawdown"
          ? "down"
          : kind === "custom" && o.direction === "down"
            ? "down"
            : "up",
      startValue: num(o.startValue),
      targetValue: num(o.targetValue),
      manualValue: num(o.manualValue),
    });
    if (goals.length >= MAX.goals) break;
  }
  if (goals.length === 0) return null;
  return {
    startedAt: str(r.started_at, 10),
    horizonMonths:
      typeof r.horizon_months === "number" && Number.isFinite(r.horizon_months)
        ? r.horizon_months
        : null,
    goals,
  };
}

// ── Lectures (toujours sous user_id) ─────────────────────────────────────────

export interface ProfilePlanData {
  rules: CompactRule[];
  plan: CompactPlan | null;
  /** Le jsonb brut du plan — pour `planMaxRiskPct`, sans relire la base. */
  rawPlan: unknown;
}

/** Règles + plan du trader (ils sont rattachés à l'UTILISATEUR, pas au compte). */
export async function loadRulesAndPlan(sb: AnyClient, userId: string): Promise<ProfilePlanData> {
  const { data, error } = await sb
    .from("profiles")
    .select("trading_rules, trading_plan")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = (data ?? {}) as { trading_rules?: unknown; trading_plan?: unknown };
  return {
    rules: parseTradingRules(row.trading_rules),
    plan: compactTradingPlan(row.trading_plan),
    rawPlan: row.trading_plan ?? null,
  };
}

/**
 * Le plan d'objectifs du COMPTE actif. Sans compte, il n'y en a pas : les
 * objectifs sont rattachés à un compte depuis `goal_plans_per_account`.
 */
export async function loadGoalPlanFor(
  sb: AnyClient,
  userId: string,
  accountId: string | null | undefined,
): Promise<CompactGoalPlan | null> {
  if (!accountId) return null;
  const { data, error } = await sb
    .from("goal_plans")
    .select("goals, started_at, horizon_months")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return compactGoalPlan(data);
}

/**
 * Le solde de départ — la même règle que le tableau de bord
 * (`app/store/profile.ts` `loadStartingBalance`) : celui du compte actif, à
 * défaut celui du profil, à défaut 25 000. Le compte est lu SOUS `user_id` :
 * un identifiant de compte forgé ne renvoie rien.
 */
export async function loadStartingBalanceFor(
  sb: AnyClient,
  userId: string,
  accountId: string | null | undefined,
): Promise<number> {
  if (accountId) {
    const { data, error } = await sb
      .from("accounts")
      .select("starting_balance")
      .eq("id", accountId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const bal = (data as { starting_balance?: unknown } | null)?.starting_balance;
    if (typeof bal === "number") return bal;
  }
  const { data, error } = await sb
    .from("profiles")
    .select("starting_balance")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const bal = (data as { starting_balance?: unknown } | null)?.starting_balance;
  return typeof bal === "number" ? bal : 25_000;
}
