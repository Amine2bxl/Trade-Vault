import { supabase } from "@/integrations/supabase/client";

// "Objectif 6 mois" — the user sets one 6-month target (profit factor, max
// drawdown %, or capital); we derive 6 progressive monthly milestones from
// it and 2-3 psychological exercises per month. Pure math + storage here,
// rendering in pages/Goals.tsx.

export type GoalKind = "profit_factor" | "max_drawdown" | "capital";

export interface SixMonthGoal {
  kind: GoalKind;
  startValue: number;
  targetValue: number;
  startedAt: string; // yyyy-mm-dd
}

export interface Milestone {
  index: number; // 0..5
  /** Metric value to reach by the end of this month. */
  value: number;
  /** yyyy-mm of the month this milestone covers. */
  month: string;
  /** 0..1 — how far the current metric is between the previous milestone and this one. */
  progress: number;
  reached: boolean;
  isCurrent: boolean;
}

// ── Storage ──────────────────────────────────────────────────────────────────

export async function loadSixMonthGoal(userId: string): Promise<SixMonthGoal | null> {
  const { data, error } = await supabase
    .from("six_month_goals")
    .select("kind, start_value, target_value, started_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    kind: data.kind as GoalKind,
    startValue: Number(data.start_value),
    targetValue: Number(data.target_value),
    startedAt: data.started_at,
  };
}

export async function saveSixMonthGoal(userId: string, goal: SixMonthGoal): Promise<void> {
  const { error } = await supabase.from("six_month_goals").upsert({
    user_id: userId,
    kind: goal.kind,
    start_value: goal.startValue,
    target_value: goal.targetValue,
    started_at: goal.startedAt,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function deleteSixMonthGoal(userId: string): Promise<void> {
  const { error } = await supabase.from("six_month_goals").delete().eq("user_id", userId);
  if (error) throw error;
}

// ── Milestone math ───────────────────────────────────────────────────────────

function addMonths(iso: string, n: number): Date {
  const d = new Date(`${iso}T12:00:00`);
  d.setMonth(d.getMonth() + n);
  return d;
}
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Value the metric should hit by the END of month i (i = 0..5).
 *  - capital compounds geometrically (equal % growth each month);
 *  - profit factor ramps gently (harder gains come later);
 *  - drawdown shrinks linearly toward the cap. */
export function milestoneValue(goal: SixMonthGoal, i: number): number {
  const { kind, startValue: s, targetValue: t } = goal;
  const f = (i + 1) / 6;
  if (kind === "capital" && s > 0 && t > 0) return s * Math.pow(t / s, f);
  if (kind === "profit_factor") return s + (t - s) * Math.pow(f, 1.25);
  return s + (t - s) * f; // max_drawdown — linear tightening
}

/** How many whole months into the plan we are (clamped 0..5). */
export function currentMonthIndex(goal: SixMonthGoal, now = new Date()): number {
  const start = new Date(`${goal.startedAt}T12:00:00`);
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return Math.max(0, Math.min(5, months));
}

/** For drawdown, "better" means lower — progress runs in reverse. */
function progressBetween(kind: GoalKind, from: number, to: number, current: number): number {
  if (from === to) return current === to ? 1 : 0;
  const raw = (current - from) / (to - from); // works for both directions
  return Math.max(0, Math.min(1, raw));
}

export function buildMilestones(
  goal: SixMonthGoal,
  currentValue: number,
  now = new Date(),
): Milestone[] {
  const cur = currentMonthIndex(goal, now);
  return Array.from({ length: 6 }, (_, i) => {
    const value = milestoneValue(goal, i);
    const prev = i === 0 ? goal.startValue : milestoneValue(goal, i - 1);
    const reachedNow = goal.kind === "max_drawdown" ? currentValue <= value : currentValue >= value;
    return {
      index: i,
      value,
      month: ym(addMonths(goal.startedAt, i)),
      progress:
        i < cur
          ? 1
          : i > cur
            ? 0
            : reachedNow
              ? 1
              : progressBetween(goal.kind, prev, value, currentValue),
      reached: (i < cur && true) || (i === cur && reachedNow),
      isCurrent: i === cur,
    };
  });
}

// ── Psychological exercises (dynamic per month × goal kind) ─────────────────

type Tip = { fr: [string, string]; en: [string, string] };

const TIPS_BY_KIND: Record<GoalKind, Tip[]> = {
  profit_factor: [
    {
      fr: [
        "Coupe tes 3 pires setups",
        "Regarde ton tableau par setup : arrête de trader le moins rentable ce mois-ci. Moins de pertes = PF qui monte sans trader mieux.",
      ],
      en: [
        "Cut your 3 worst setups",
        "Check your per-setup table: stop trading the least profitable one this month. Fewer losses = PF up without trading better.",
      ],
    },
    {
      fr: [
        "Journal de sortie",
        "Pendant 2 semaines, note POURQUOI tu sors de chaque trade. Les sorties émotionnelles écrasent ton profit factor.",
      ],
      en: [
        "Exit journal",
        "For 2 weeks, write WHY you exit every trade. Emotional exits crush your profit factor.",
      ],
    },
    {
      fr: [
        "Laisse courir un gagnant",
        "Une fois cette semaine : quand ton TP1 touche, laisse 50% courir avec un stop suiveur. Ressens l'inconfort, note-le.",
      ],
      en: [
        "Let one winner run",
        "Once this week: when TP1 hits, let 50% run with a trailing stop. Feel the discomfort, write it down.",
      ],
    },
    {
      fr: [
        "Visualisation pré-session",
        "3 minutes avant chaque session : visualise-toi refuser un trade moyen. Le PF se gagne sur les trades NON pris.",
      ],
      en: [
        "Pre-session visualization",
        "3 minutes before each session: visualize yourself refusing a mediocre trade. PF is won on the trades NOT taken.",
      ],
    },
  ],
  max_drawdown: [
    {
      fr: [
        "Règle des -2% jour",
        "Si la journée atteint -2%, tu fermes tout — même « sûr ». Écris la règle sur un post-it collé à l'écran.",
      ],
      en: [
        "The -2% day rule",
        'If the day hits -2%, you close everything — even the "sure" one. Write the rule on a post-it stuck to your screen.',
      ],
    },
    {
      fr: [
        "Respiration 4-7-8 après une perte",
        "Inspire 4s, retiens 7s, expire 8s, 3 cycles. Le cortisol retombe avant la décision suivante.",
      ],
      en: [
        "4-7-8 breathing after a loss",
        "Inhale 4s, hold 7s, exhale 8s, 3 cycles. Cortisol drops before your next decision.",
      ],
    },
    {
      fr: [
        "Demi-taille après 2 pertes",
        "Deux pertes de suite = taille divisée par 2 jusqu'au prochain gain. Le drawdown se creuse toujours en tilt.",
      ],
      en: [
        "Half-size after 2 losses",
        "Two losses in a row = half size until the next win. Drawdowns always deepen on tilt.",
      ],
    },
    {
      fr: [
        "Audit hebdo du pire trade",
        "Chaque dimanche, dissèque LE pire trade de la semaine : qu'aurais-tu vu avec 10 min de recul ?",
      ],
      en: [
        "Weekly worst-trade audit",
        "Every Sunday, dissect THE worst trade of the week: what would 10 minutes of distance have shown you?",
      ],
    },
  ],
  capital: [
    {
      fr: [
        "Objectif de process, pas de PnL",
        "Fixe 3 critères de process par semaine (checklist, risque, journal). Le capital suit le process, jamais l'inverse.",
      ],
      en: [
        "Process goals, not PnL goals",
        "Set 3 process criteria per week (checklist, risk, journal). Capital follows process, never the reverse.",
      ],
    },
    {
      fr: [
        "Cache ton PnL en cours de séance",
        "Masque la colonne PnL pendant le trading. Tu trades le graphique, pas ton solde.",
      ],
      en: [
        "Hide your running PnL",
        "Mask the PnL column while trading. You trade the chart, not your balance.",
      ],
    },
    {
      fr: [
        "Rituel de fin de mois",
        "Dernier jour du mois : écris 3 leçons + 1 règle pour le mois suivant. La croissance composée vaut aussi pour les habitudes.",
      ],
      en: [
        "End-of-month ritual",
        "Last day of the month: write 3 lessons + 1 rule for next month. Compounding applies to habits too.",
      ],
    },
    {
      fr: [
        "Retire un profit symbolique",
        "Si le mois est vert, retire ne serait-ce que 1%. Ton cerveau apprend que le capital est réel, pas des points.",
      ],
      en: [
        "Withdraw a symbolic profit",
        "If the month is green, withdraw even 1%. Your brain learns the capital is real, not points.",
      ],
    },
  ],
};

const TIPS_GENERIC: Tip[] = [
  {
    fr: [
      "Méditation 5 min avant l'ouverture",
      "5 minutes de calme avant la session. Les études montrent moins de trades impulsifs après un ancrage attentionnel.",
    ],
    en: [
      "5-min meditation before the open",
      "Five quiet minutes before the session. Studies show fewer impulsive trades after an attention anchor.",
    ],
  },
  {
    fr: [
      "Relis 3 trades gagnants",
      "Avant la session, relis 3 trades bien exécutés. Tu programmes le comportement à répéter, pas celui à éviter.",
    ],
    en: [
      "Re-read 3 winning trades",
      "Before the session, review 3 well-executed trades. You program the behavior to repeat, not the one to avoid.",
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
];

/** 2-3 exercises for the given month, rotated deterministically so each of
 *  the 6 months gets a different mix. */
export function tipsForMonth(kind: GoalKind, monthIndex: number, lang: string) {
  const pool = TIPS_BY_KIND[kind];
  const fr = lang === "fr";
  const a = pool[monthIndex % pool.length];
  const b = pool[(monthIndex + 2) % pool.length];
  const g = TIPS_GENERIC[monthIndex % TIPS_GENERIC.length];
  return [a, b, g].map((tip) => {
    const [title, desc] = fr ? tip.fr : tip.en;
    return { title, desc };
  });
}
