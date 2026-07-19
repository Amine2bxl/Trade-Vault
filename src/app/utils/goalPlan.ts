import { supabase } from "@/integrations/supabase/client";
import type { TradeStats } from "../types";
import type { QuantStats } from "./quantStats";

// Goals 2.0 — the trader selects SEVERAL fully customizable goals at once;
// TradeVault derives a progressive 6-month action plan from them: one
// milestone per goal per month + concrete monthly tasks. Only the raw goals
// and the task-done flags are stored (goal_plans table); milestones and
// tasks are recomputed deterministically, so progress never goes stale.

export type GoalKind =
  | "capital" // account balance target ($)
  | "profit_factor" // gross win / gross loss
  | "max_drawdown" // max drawdown, % of balance (lower is better)
  | "win_rate" // % winners
  | "avg_rr" // average R multiple
  | "discipline" // journaling consistency, % of trades with notes
  | "custom"; // anything — label + unit + direction, manually tracked

export interface GoalDef {
  id: string;
  kind: GoalKind;
  /** Custom goals only: the user's own wording. */
  label?: string;
  /** Custom goals only: display unit ("h", "trades", "€"…). */
  unit?: string;
  /** Custom goals only: which way is "better". Measured kinds know it. */
  direction?: "up" | "down";
  startValue: number;
  targetValue: number;
  /** custom: manually updated current value (no auto-measurement). */
  manualValue?: number;
}

export interface GoalPlan {
  goals: GoalDef[];
  startedAt: string; // yyyy-mm-dd
  horizonMonths: number;
  /** `${monthIndex}:${goalId}:${slot}` -> done */
  tasksDone: Record<string, boolean>;
}

export const HORIZON = 6;

// ── Storage (goal_plans, one active plan per user) ───────────────────────────

export async function loadGoalPlan(userId: string): Promise<GoalPlan | null> {
  const { data, error } = await supabase
    .from("goal_plans")
    .select("goals, started_at, horizon_months, tasks_done")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    goals: (Array.isArray(data.goals) ? data.goals : []) as unknown as GoalDef[],
    startedAt: data.started_at,
    horizonMonths: Number(data.horizon_months) || HORIZON,
    tasksDone: (data.tasks_done ?? {}) as Record<string, boolean>,
  };
}

export async function saveGoalPlan(userId: string, plan: GoalPlan): Promise<void> {
  const { error } = await supabase.from("goal_plans").upsert({
    user_id: userId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    goals: plan.goals as any,
    started_at: plan.startedAt,
    horizon_months: plan.horizonMonths,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tasks_done: plan.tasksDone as any,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function deleteGoalPlan(userId: string): Promise<void> {
  const { error } = await supabase.from("goal_plans").delete().eq("user_id", userId);
  if (error) throw error;
}

export async function setTaskDone(
  userId: string,
  plan: GoalPlan,
  key: string,
  done: boolean,
): Promise<GoalPlan> {
  const tasksDone = { ...plan.tasksDone };
  if (done) tasksDone[key] = true;
  else delete tasksDone[key];
  const next = { ...plan, tasksDone };
  const { error } = await supabase
    .from("goal_plans")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ tasks_done: tasksDone as any, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw error;
  return next;
}

// ── Measurement ──────────────────────────────────────────────────────────────

/** "Lower is better" for these kinds. */
export function goalDirection(g: GoalDef): "up" | "down" {
  if (g.kind === "max_drawdown") return "down";
  if (g.kind === "custom") return g.direction ?? "up";
  return "up";
}

export interface MeasureCtx {
  stats: TradeStats;
  quant: QuantStats;
  startingBalance: number;
  /** 0..1 — share of trades with a filled journal note. */
  journalRate: number;
}

/** Live current value of a goal's metric (manual for custom). */
export function currentGoalValue(g: GoalDef, ctx: MeasureCtx): number {
  switch (g.kind) {
    case "capital":
      return ctx.startingBalance + ctx.stats.totalPnl;
    case "profit_factor":
      return Math.min(ctx.stats.profitFactor, 99);
    case "max_drawdown":
      return (ctx.quant.maxDrawdownPct ?? 0) * 100;
    case "win_rate":
      return ctx.stats.winRate * 100;
    case "avg_rr":
      return ctx.stats.avgRR;
    case "discipline":
      return ctx.journalRate * 100;
    case "custom":
      return g.manualValue ?? g.startValue;
  }
}

// ── Milestones ───────────────────────────────────────────────────────────────

function addMonths(iso: string, n: number): Date {
  const d = new Date(`${iso}T12:00:00`);
  d.setMonth(d.getMonth() + n);
  return d;
}
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Value goal g should reach by the END of month i (0-based). Progressive:
 *  capital compounds, ratios ramp (harder gains later), the rest is linear. */
export function milestoneValue(g: GoalDef, i: number, horizon = HORIZON): number {
  const { startValue: s, targetValue: t } = g;
  const f = (i + 1) / horizon;
  if (g.kind === "capital" && s > 0 && t > 0) return s * Math.pow(t / s, f);
  if (g.kind === "profit_factor" || g.kind === "avg_rr" || g.kind === "win_rate")
    return s + (t - s) * Math.pow(f, 1.25);
  return s + (t - s) * f;
}

export function currentMonthIndex(plan: GoalPlan, now = new Date()): number {
  const start = new Date(`${plan.startedAt}T12:00:00`);
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return Math.max(0, Math.min(plan.horizonMonths - 1, months));
}

export function monthOf(plan: GoalPlan, i: number): string {
  return ym(addMonths(plan.startedAt, i));
}

/** 0..1 progress of goal g toward its month-i milestone. */
export function goalProgress(g: GoalDef, i: number, current: number, horizon = HORIZON): number {
  const from = i === 0 ? g.startValue : milestoneValue(g, i - 1, horizon);
  const to = milestoneValue(g, i, horizon);
  if (from === to) return current === to ? 1 : 0;
  return Math.max(0, Math.min(1, (current - from) / (to - from)));
}

export function milestoneReached(g: GoalDef, i: number, current: number, horizon = HORIZON) {
  const v = milestoneValue(g, i, horizon);
  return goalDirection(g) === "down" ? current <= v : current >= v;
}

// ── Task generation (deterministic templates per kind × month) ──────────────

type Tpl = { fr: [string, string]; en: [string, string] };

const TASKS: Record<Exclude<GoalKind, "custom">, Tpl[]> = {
  capital: [
    {
      fr: [
        "Définis ton risque fixe du mois",
        "Choisis un % de risque unique par trade et ne le change sous aucun prétexte ce mois-ci.",
      ],
      en: [
        "Lock this month's fixed risk",
        "Pick one risk % per trade and don't change it for any reason this month.",
      ],
    },
    {
      fr: [
        "Cache ton PnL en séance",
        "Masque la colonne PnL pendant le trading : tu trades le graphique, pas ton solde.",
      ],
      en: [
        "Hide your running PnL",
        "Mask the PnL column while trading: you trade the chart, not your balance.",
      ],
    },
    {
      fr: [
        "Objectifs de process hebdo",
        "Chaque semaine, valide 3 critères de process (checklist, risque, journal). Le capital suit le process.",
      ],
      en: [
        "Weekly process goals",
        "Each week, validate 3 process criteria (checklist, risk, journal). Capital follows process.",
      ],
    },
    {
      fr: [
        "Retire un profit symbolique",
        "Si le mois est vert, retire ne serait-ce que 1% : ton cerveau apprend que le capital est réel.",
      ],
      en: [
        "Withdraw a symbolic profit",
        "If the month is green, withdraw even 1%: your brain learns the capital is real.",
      ],
    },
    {
      fr: [
        "Audit de taille de position",
        "Vérifie sur 20 trades que ta taille correspond exactement à ton % de risque défini.",
      ],
      en: [
        "Position-size audit",
        "Across 20 trades, verify your size matches your defined risk % exactly.",
      ],
    },
  ],
  profit_factor: [
    {
      fr: [
        "Coupe ton pire setup",
        "Regarde tes stats par setup : arrête de trader le moins rentable ce mois-ci.",
      ],
      en: [
        "Cut your worst setup",
        "Check your per-setup stats: stop trading the least profitable one this month.",
      ],
    },
    {
      fr: [
        "Journal de sorties",
        "Pendant 2 semaines, note POURQUOI tu sors de chaque trade. Les sorties émotionnelles écrasent le PF.",
      ],
      en: [
        "Exit journal",
        "For 2 weeks, write WHY you exit every trade. Emotional exits crush PF.",
      ],
    },
    {
      fr: [
        "Laisse courir 1 gagnant / semaine",
        "Quand TP1 touche, laisse 50% courir avec stop suiveur. Note l'inconfort ressenti.",
      ],
      en: [
        "Let 1 winner run / week",
        "When TP1 hits, let 50% run with a trailing stop. Write down the discomfort.",
      ],
    },
    {
      fr: [
        "Refuse 1 trade moyen / jour",
        "Chaque jour, identifie un trade « bof » et refuse-le consciemment. Le PF se gagne sur les trades non pris.",
      ],
      en: [
        "Refuse 1 mediocre trade / day",
        "Each day, spot one 'meh' trade and consciously skip it. PF is won on trades not taken.",
      ],
    },
  ],
  max_drawdown: [
    {
      fr: [
        "Règle des -2% affichée",
        "Si la journée atteint -2%, tout fermer. Écris la règle sur un post-it collé à l'écran.",
      ],
      en: [
        "The -2% rule, visible",
        "If the day hits -2%, close everything. Write it on a post-it stuck to your screen.",
      ],
    },
    {
      fr: [
        "Respiration 4-7-8 après perte",
        "Inspire 4s, retiens 7s, expire 8s — 3 cycles après chaque perte, avant toute décision.",
      ],
      en: [
        "4-7-8 breathing after a loss",
        "Inhale 4s, hold 7s, exhale 8s — 3 cycles after every loss, before any decision.",
      ],
    },
    {
      fr: [
        "Demi-taille après 2 pertes",
        "Deux pertes de suite = taille divisée par 2 jusqu'au prochain gain.",
      ],
      en: ["Half-size after 2 losses", "Two losses in a row = half size until the next win."],
    },
    {
      fr: [
        "Audit hebdo du pire trade",
        "Chaque dimanche, dissèque LE pire trade de la semaine : qu'aurais-tu vu avec 10 min de recul ?",
      ],
      en: [
        "Weekly worst-trade audit",
        "Every Sunday, dissect THE worst trade of the week: what would 10 minutes of distance have shown?",
      ],
    },
  ],
  win_rate: [
    {
      fr: [
        "Checklist avant CHAQUE entrée",
        "Zéro entrée sans checklist complète ce mois-ci. Chaque case cochée filtre un mauvais trade.",
      ],
      en: [
        "Checklist before EVERY entry",
        "Zero entries without the full checklist this month. Every ticked box filters a bad trade.",
      ],
    },
    {
      fr: [
        "Trade uniquement ta fenêtre",
        "Aucune entrée hors de ta fenêtre horaire définie. Les trades hors fenêtre plombent le win rate.",
      ],
      en: [
        "Trade only your window",
        "No entries outside your defined time window. Off-window trades sink win rate.",
      ],
    },
    {
      fr: [
        "Note la qualité avant l'entrée",
        "Avant chaque trade, note le setup /5. En dessous de 4 : tu passes.",
      ],
      en: [
        "Grade quality before entry",
        "Before each trade, grade the setup /5. Below 4: you pass.",
      ],
    },
    {
      fr: [
        "Relis 3 gagnants le dimanche",
        "Chaque semaine, relis 3 trades bien exécutés : tu programmes le comportement à répéter.",
      ],
      en: [
        "Re-read 3 winners on Sunday",
        "Each week, review 3 well-executed trades: you program the behavior to repeat.",
      ],
    },
  ],
  avg_rr: [
    {
      fr: [
        "TP minimum à 2R",
        "Ce mois-ci, aucun take-profit placé sous 2R à l'entrée. Si la structure ne le permet pas, pas de trade.",
      ],
      en: [
        "Minimum 2R target",
        "This month, no take-profit placed under 2R at entry. If structure doesn't allow it, no trade.",
      ],
    },
    {
      fr: [
        "Stop jamais élargi",
        "Une fois placé, ton stop ne recule JAMAIS. Élargir un stop détruit le R moyen.",
      ],
      en: [
        "Never widen a stop",
        "Once placed, your stop NEVER moves back. Widening stops destroys average R.",
      ],
    },
    {
      fr: [
        "Break-even discipliné",
        "Définis une règle BE écrite (ex : à +1R) et applique-la sur 100% des trades du mois.",
      ],
      en: [
        "Disciplined break-even",
        "Write one BE rule (e.g. at +1R) and apply it on 100% of this month's trades.",
      ],
    },
    {
      fr: [
        "Mesure ton MFE",
        "Sur chaque gagnant, note le MFE : combien tu laisses sur la table en sortant trop tôt ?",
      ],
      en: [
        "Measure your MFE",
        "On every winner, log the MFE: how much are you leaving on the table by exiting early?",
      ],
    },
  ],
  discipline: [
    {
      fr: [
        "Journalise dans l'heure",
        "Chaque trade loggé dans l'heure qui suit la sortie — notes + screenshot, sans exception.",
      ],
      en: [
        "Journal within the hour",
        "Every trade logged within an hour of exit — notes + screenshot, no exception.",
      ],
    },
    {
      fr: [
        "Note + screenshot systématiques",
        "100% des trades du mois avec note écrite ET capture d'écran annotée.",
      ],
      en: [
        "Notes + screenshots, always",
        "100% of this month's trades with a written note AND an annotated screenshot.",
      ],
    },
    {
      fr: [
        "Revue hebdo planifiée",
        "Bloque 30 min chaque dimanche dans ton agenda pour relire la semaine. Non négociable.",
      ],
      en: [
        "Scheduled weekly review",
        "Block 30 min every Sunday in your calendar to review the week. Non-negotiable.",
      ],
    },
    {
      fr: [
        "Une leçon par jour tradé",
        "Chaque jour tradé se termine par UNE leçon écrite en une phrase.",
      ],
      en: [
        "One lesson per traded day",
        "Every traded day ends with ONE lesson written in a single sentence.",
      ],
    },
  ],
};

const GENERIC: Tpl[] = [
  {
    fr: [
      "Méditation 5 min avant l'ouverture",
      "Cinq minutes de calme avant la session : moins de trades impulsifs après un ancrage attentionnel.",
    ],
    en: [
      "5-min meditation before the open",
      "Five quiet minutes before the session: fewer impulsive trades after an attention anchor.",
    ],
  },
  {
    fr: [
      "Une journée sans trade",
      "Prends volontairement un jour off cette semaine, marché ouvert. Prouver que tu PEUX ne pas trader casse la compulsion.",
    ],
    en: [
      "One deliberate no-trade day",
      "Take a day off this week with the market open. Proving you CAN not trade breaks the compulsion.",
    ],
  },
  {
    fr: [
      "Écris ton bilan de mois",
      "Le dernier jour du mois : 3 leçons + 1 règle pour le mois suivant.",
    ],
    en: [
      "Write your month debrief",
      "On the last day of the month: 3 lessons + 1 rule for next month.",
    ],
  },
];

export interface PlanTask {
  /** Stable id — `${monthIndex}:${goalId}:${slot}` (used as tasksDone key). */
  key: string;
  goalId: string | null; // null = generic
  title: string;
  desc: string;
}

/** Concrete tasks for month i: 2 per goal (rotated so each month differs)
 *  + 1 shared generic task. Custom goals get a self-referential task. */
export function tasksForMonth(plan: GoalPlan, i: number, lang: string): PlanTask[] {
  const fr = lang === "fr";
  const out: PlanTask[] = [];
  for (const g of plan.goals) {
    if (g.kind === "custom") {
      const title = fr
        ? `Avance sur « ${g.label || "ton objectif"} »`
        : `Advance on "${g.label || "your goal"}"`;
      const desc = fr
        ? `Planifie 2 actions concrètes ce mois-ci qui rapprochent « ${g.label || "ton objectif"} » de ${g.targetValue}${g.unit ?? ""}, puis mets à jour ta progression ici.`
        : `Plan 2 concrete actions this month that move "${g.label || "your goal"}" toward ${g.targetValue}${g.unit ?? ""}, then update your progress here.`;
      out.push({ key: `${i}:${g.id}:0`, goalId: g.id, title, desc });
      continue;
    }
    const pool = TASKS[g.kind];
    const a = pool[i % pool.length];
    const b = pool[(i + 2) % pool.length];
    const picks = a === b ? [a] : [a, b];
    picks.forEach((tpl, slot) => {
      const [title, desc] = fr ? tpl.fr : tpl.en;
      out.push({ key: `${i}:${g.id}:${slot}`, goalId: g.id, title, desc });
    });
  }
  const g = GENERIC[i % GENERIC.length];
  const [title, desc] = fr ? g.fr : g.en;
  out.push({ key: `${i}:generic:0`, goalId: null, title, desc });
  return out;
}

/** Share of month-i tasks already checked off. */
export function monthTaskCompletion(plan: GoalPlan, i: number): number {
  // Language doesn't change the number of tasks — use "en" as the counter.
  const tasks = tasksForMonth(plan, i, "en");
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => plan.tasksDone[t.key]).length;
  return done / tasks.length;
}
