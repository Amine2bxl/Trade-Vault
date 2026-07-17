import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Target,
  TrendingUp,
  ShieldAlert,
  Wallet,
  Percent,
  Scale,
  NotebookPen,
  PenLine,
  Check,
  Lock,
  Sparkles,
  Trash2,
  Loader2,
  ChevronDown,
  Bell,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "../contexts/AuthContext";
import { useAccounts } from "../contexts/AccountContext";
import { useT } from "../i18n/LanguageContext";
import { useToast } from "../contexts/ToastContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { cn } from "../utils/cn";
import type { Trade } from "../types";
import { computeStats } from "../utils/tradeCalcs";
import { computeQuantStats } from "../utils/quantStats";
import { loadStartingBalance } from "../store";
import { sendPushToSelf } from "@/lib/push.functions";
import {
  HORIZON,
  type GoalDef,
  type GoalKind,
  type GoalPlan,
  type MeasureCtx,
  currentGoalValue,
  currentMonthIndex,
  deleteGoalPlan,
  goalDirection,
  goalProgress,
  loadGoalPlan,
  milestoneReached,
  milestoneValue,
  monthOf,
  monthTaskCompletion,
  saveGoalPlan,
  setTaskDone,
  tasksForMonth,
} from "../utils/goalPlan";

// Goals 2.0 — pick SEVERAL fully customizable goals at once; TradeVault
// generates a progressive 6-month action plan: per-goal milestones + concrete
// monthly tasks, checkable and persisted, with push reminders.

const KIND_META: Record<
  GoalKind,
  {
    icon: typeof Target;
    fr: string;
    en: string;
    unit: string;
    ph: string;
    frDesc: string;
    enDesc: string;
  }
> = {
  capital: {
    icon: Wallet,
    fr: "Capital cible",
    en: "Target capital",
    unit: "$",
    ph: "100000",
    frDesc: "Faire grandir le compte jusqu'à un montant précis",
    enDesc: "Grow the account to a specific amount",
  },
  profit_factor: {
    icon: TrendingUp,
    fr: "Profit factor",
    en: "Profit factor",
    unit: "",
    ph: "2.0",
    frDesc: "Gagner plus sur les gains que tu ne perds sur les pertes",
    enDesc: "Win more on winners than you lose on losers",
  },
  max_drawdown: {
    icon: ShieldAlert,
    fr: "Drawdown max",
    en: "Max drawdown",
    unit: "%",
    ph: "5",
    frDesc: "Réduire la pire baisse de ton compte",
    enDesc: "Shrink your account's worst dip",
  },
  win_rate: {
    icon: Percent,
    fr: "Taux de réussite",
    en: "Win rate",
    unit: "%",
    ph: "60",
    frDesc: "Augmenter la part de trades gagnants",
    enDesc: "Raise the share of winning trades",
  },
  avg_rr: {
    icon: Scale,
    fr: "R:R moyen",
    en: "Average R:R",
    unit: "R",
    ph: "2.0",
    frDesc: "Améliorer ton ratio risque/récompense moyen",
    enDesc: "Improve your average risk/reward",
  },
  discipline: {
    icon: NotebookPen,
    fr: "Discipline de journal",
    en: "Journal discipline",
    unit: "%",
    ph: "100",
    frDesc: "% de trades journalisés avec notes",
    enDesc: "% of trades journaled with notes",
  },
  custom: {
    icon: PenLine,
    fr: "Objectif personnalisé",
    en: "Custom goal",
    unit: "",
    ph: "10",
    frDesc: "Ton objectif, tes mots, ton unité",
    enDesc: "Your goal, your words, your unit",
  },
};

const fmtVal = (g: GoalDef, v: number): string => {
  const meta = KIND_META[g.kind];
  const unit = g.kind === "custom" ? (g.unit ?? "") : meta.unit;
  const decimals = g.kind === "capital" ? 0 : v >= 100 ? 0 : 2;
  const s = v.toFixed(decimals);
  return unit === "$" ? `$${s}` : `${s}${unit ? unit : ""}`;
};

export default function Goals({ trades }: { trades: Trade[] }) {
  const { user } = useAuth();
  const { activeId } = useAccounts();
  const { lang, t } = useT();
  const { toast } = useToast();
  const confirm = useConfirm();
  const fr = lang === "fr";
  const tr = useCallback((f: string, e: string) => (fr ? f : e), [fr]);
  const sendPush = useServerFn(sendPushToSelf);

  const [plan, setPlan] = useState<GoalPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingBalance, setStartingBalance] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    Promise.all([loadGoalPlan(user.id), loadStartingBalance(user.id)])
      .then(([p, b]) => {
        if (!active) return;
        setPlan(p);
        setStartingBalance(b);
      })
      .catch((e) => console.error("Failed to load goal plan", e))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user?.id, activeId]);

  const stats = useMemo(() => computeStats(trades), [trades]);
  const quant = useMemo(
    () => computeQuantStats(trades, startingBalance),
    [trades, startingBalance],
  );
  const journalRate = useMemo(
    () =>
      trades.length === 0
        ? 0
        : trades.filter((x) => x.notes.trim().length > 0).length / trades.length,
    [trades],
  );
  const ctx: MeasureCtx = useMemo(
    () => ({ stats, quant, startingBalance, journalRate }),
    [stats, quant, startingBalance, journalRate],
  );

  const generate = useCallback(
    async (goals: GoalDef[]) => {
      if (!user || busy || goals.length === 0) return;
      setBusy(true);
      const p: GoalPlan = {
        goals,
        startedAt: new Date().toISOString().slice(0, 10),
        horizonMonths: HORIZON,
        tasksDone: {},
      };
      try {
        await saveGoalPlan(user.id, p);
        setPlan(p);
        toast(
          tr(
            "Plan d'action généré — 6 mois, c'est parti !",
            "Action plan generated — 6 months, let's go!",
          ),
          "success",
        );
        // Confirmation push (mobile + desktop) — best-effort.
        sendPush({
          data: {
            title: tr("Ton plan d'action est prêt 🎯", "Your action plan is ready 🎯"),
            body: tr(
              `${goals.length} objectif(s), ${HORIZON} étapes mensuelles. Première mission : les tâches de ce mois-ci.`,
              `${goals.length} goal(s), ${HORIZON} monthly steps. First mission: this month's tasks.`,
            ),
            url: "/",
          },
        }).catch(() => {});
      } catch (e) {
        console.error("Failed to save goal plan", e);
        toast(t("app.saveTradeFailed"), "error");
      } finally {
        setBusy(false);
      }
    },
    [user, busy, toast, tr, t, sendPush],
  );

  const removePlan = useCallback(async () => {
    if (!user || busy || !plan) return;
    if (
      !(await confirm(
        tr(
          "Supprimer ce plan et repartir de zéro ? La progression des tâches sera perdue.",
          "Delete this plan and start over? Task progress will be lost.",
        ),
        { danger: true },
      ))
    )
      return;
    setBusy(true);
    try {
      await deleteGoalPlan(user.id);
      setPlan(null);
    } catch (e) {
      console.error("Failed to delete goal plan", e);
    } finally {
      setBusy(false);
    }
  }, [user, busy, plan, confirm, tr]);

  const toggleTask = useCallback(
    async (key: string, done: boolean) => {
      if (!user || !plan) return;
      // Optimistic — revert on failure.
      const prev = plan;
      const optimistic = {
        ...plan,
        tasksDone: done
          ? { ...plan.tasksDone, [key]: true }
          : Object.fromEntries(Object.entries(plan.tasksDone).filter(([k]) => k !== key)),
      };
      setPlan(optimistic);
      try {
        await setTaskDone(user.id, prev, key, done);
        // All tasks of the current month just completed → celebrate + push.
        const i = currentMonthIndex(optimistic);
        if (done && monthTaskCompletion(optimistic, i) === 1) {
          toast(
            tr(
              "Toutes les tâches du mois validées — énorme ! 🔥",
              "All of this month's tasks done — huge! 🔥",
            ),
            "success",
          );
          sendPush({
            data: {
              title: tr("Mois validé 🔥", "Month complete 🔥"),
              body: tr(
                `Étape ${i + 1}/${optimistic.horizonMonths} : toutes les actions sont faites. Le plan avance.`,
                `Step ${i + 1}/${optimistic.horizonMonths}: every action done. The plan is moving.`,
              ),
              url: "/",
            },
          }).catch(() => {});
        }
      } catch (e) {
        console.error("Failed to toggle task", e);
        setPlan(prev);
      }
    },
    [user, plan, toast, tr, sendPush],
  );

  const updateManualValue = useCallback(
    async (goalId: string, value: number) => {
      if (!user || !plan) return;
      const next: GoalPlan = {
        ...plan,
        goals: plan.goals.map((g) => (g.id === goalId ? { ...g, manualValue: value } : g)),
      };
      setPlan(next);
      try {
        await saveGoalPlan(user.id, next);
      } catch (e) {
        console.error("Failed to update goal value", e);
      }
    },
    [user, plan],
  );

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <div className="glass rounded-3xl p-10 flex justify-center">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6 animate-fade-in-up">
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          {tr("Objectifs", "Goals")}
        </h1>
        <p className="text-xs md:text-sm text-slate-500 mt-1">
          {tr(
            "Choisis tes objectifs — TradeVault génère ton plan d'action mensuel, concret et progressif.",
            "Pick your goals — TradeVault generates your concrete, progressive monthly action plan.",
          )}
        </p>
      </div>

      {!plan ? (
        <GoalPicker ctx={ctx} fr={fr} busy={busy} onGenerate={generate} />
      ) : (
        <PlanView
          plan={plan}
          ctx={ctx}
          fr={fr}
          lang={lang}
          busy={busy}
          onDelete={removePlan}
          onToggleTask={toggleTask}
          onManualValue={updateManualValue}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Goal picker (multi-select) ───────────────────────── */

interface Draft {
  selected: boolean;
  target: string;
  label: string;
  unit: string;
  direction: "up" | "down";
  current: string; // custom only — manual start/current value
}

function GoalPicker({
  ctx,
  fr,
  busy,
  onGenerate,
}: {
  ctx: MeasureCtx;
  fr: boolean;
  busy: boolean;
  onGenerate: (goals: GoalDef[]) => void;
}) {
  const tr = (f: string, e: string) => (fr ? f : e);
  const kinds = Object.keys(KIND_META) as GoalKind[];
  const [drafts, setDrafts] = useState<Record<GoalKind, Draft>>(
    () =>
      Object.fromEntries(
        kinds.map((k) => [
          k,
          { selected: false, target: "", label: "", unit: "", direction: "up", current: "" },
        ]),
      ) as Record<GoalKind, Draft>,
  );

  const patch = (k: GoalKind, p: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [k]: { ...d[k], ...p } }));

  const measuredCurrent = (k: GoalKind): number =>
    currentGoalValue({ id: "x", kind: k, startValue: 0, targetValue: 0 }, ctx);

  const buildGoals = (): GoalDef[] | null => {
    const out: GoalDef[] = [];
    for (const k of kinds) {
      const d = drafts[k];
      if (!d.selected) continue;
      const target = parseFloat(d.target.replace(",", "."));
      if (!Number.isFinite(target) || target < 0) return null;
      if (k === "custom") {
        const start = parseFloat(d.current.replace(",", "."));
        if (!d.label.trim() || !Number.isFinite(start)) return null;
        out.push({
          id: crypto.randomUUID(),
          kind: k,
          label: d.label.trim(),
          unit: d.unit.trim() || undefined,
          direction: d.direction,
          startValue: start,
          targetValue: target,
          manualValue: start,
        });
      } else {
        out.push({
          id: crypto.randomUUID(),
          kind: k,
          startValue: Math.round(measuredCurrent(k) * 100) / 100,
          targetValue: target,
        });
      }
    }
    return out.length > 0 ? out : null;
  };

  const goals = buildGoals();
  const selectedCount = kinds.filter((k) => drafts[k].selected).length;

  return (
    <div className="glass-strong rounded-3xl p-5 md:p-6 animate-fade-in-up">
      <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-1.5">
        {tr("Choisis tes objectifs", "Pick your goals")}
      </h2>
      <p className="text-xs text-slate-500 mb-4">
        {tr(
          "Sélectionnes-en autant que tu veux — le plan les combine en 6 étapes mensuelles.",
          "Select as many as you want — the plan combines them into 6 monthly steps.",
        )}
      </p>

      <div className="grid gap-2.5 mb-5">
        {kinds.map((k) => {
          const m = KIND_META[k];
          const Icon = m.icon;
          const d = drafts[k];
          const cur = k === "custom" ? null : measuredCurrent(k);
          return (
            <div
              key={k}
              className={cn(
                "rounded-2xl border transition-all overflow-hidden",
                d.selected
                  ? "bg-cyan-500/[0.08] border-cyan-400/40 shadow-lg shadow-cyan-500/10"
                  : "bg-white/[0.03] border-white/[0.07] hover:border-white/[0.16]",
              )}
            >
              <button
                onClick={() => patch(k, { selected: !d.selected })}
                className="w-full flex items-center gap-3.5 p-4 text-left"
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                    d.selected ? "bg-cyan-500/20 text-cyan-300" : "bg-white/[0.04] text-slate-400",
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white">{fr ? m.fr : m.en}</div>
                  <div className="text-xs text-slate-500">
                    {fr ? m.frDesc : m.enDesc}
                    {cur !== null && (
                      <>
                        {" · "}
                        <span className="text-slate-300 font-semibold tabular-nums">
                          {tr("actuel", "current")}: {m.unit === "$" ? "$" : ""}
                          {cur.toFixed(k === "capital" ? 0 : 2)}
                          {m.unit && m.unit !== "$" ? m.unit : ""}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <span
                  className={cn(
                    "w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-all",
                    d.selected
                      ? "bg-cyan-500 border-cyan-400 text-white"
                      : "border-white/[0.15] text-transparent",
                  )}
                >
                  <Check className="w-3.5 h-3.5" />
                </span>
              </button>

              {d.selected && (
                <div className="px-4 pb-4 animate-fade-in">
                  {k === "custom" && (
                    <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                      <input
                        value={d.label}
                        onChange={(e) => patch(k, { label: e.target.value })}
                        placeholder={tr(
                          "Nom (ex : Heures de backtest)",
                          "Name (e.g.: Backtest hours)",
                        )}
                        className="col-span-2 h-11 bg-white/[0.05] border border-white/[0.1] rounded-xl px-3.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
                      />
                      <input
                        value={d.unit}
                        onChange={(e) => patch(k, { unit: e.target.value })}
                        placeholder={tr("Unité (h, trades…)", "Unit (h, trades…)")}
                        className="h-11 bg-white/[0.05] border border-white/[0.1] rounded-xl px-3.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
                      />
                      <div className="flex rounded-xl overflow-hidden border border-white/[0.1]">
                        {(["up", "down"] as const).map((dir) => (
                          <button
                            key={dir}
                            onClick={() => patch(k, { direction: dir })}
                            className={cn(
                              "flex-1 text-xs font-bold transition-colors",
                              d.direction === dir
                                ? "bg-cyan-500/20 text-cyan-300"
                                : "bg-white/[0.03] text-slate-500",
                            )}
                          >
                            {dir === "up"
                              ? tr("Augmenter ↑", "Increase ↑")
                              : tr("Réduire ↓", "Decrease ↓")}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={d.current}
                        onChange={(e) => patch(k, { current: e.target.value })}
                        placeholder={tr("Valeur actuelle", "Current value")}
                        className="col-span-2 h-11 bg-white/[0.05] border border-white/[0.1] rounded-xl px-3.5 text-sm font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
                      />
                    </div>
                  )}
                  <div className="relative max-w-[240px]">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={d.target}
                      onChange={(e) => patch(k, { target: e.target.value })}
                      placeholder={m.ph}
                      className="w-full h-11 bg-white/[0.05] border border-white/[0.1] rounded-xl px-3.5 pr-16 text-sm font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                      {tr("cible 6 mois", "6-mo target")}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => goals && onGenerate(goals)}
        disabled={busy || !goals}
        className={cn(
          "w-full h-12 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
          goals && !busy
            ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/20 hover:brightness-110"
            : "bg-white/[0.04] text-slate-600 cursor-not-allowed",
        )}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {busy
          ? tr("Génération…", "Generating…")
          : selectedCount > 1
            ? tr(
                `Générer mon plan d'action (${selectedCount} objectifs)`,
                `Generate my action plan (${selectedCount} goals)`,
              )
            : tr("Générer mon plan d'action", "Generate my action plan")}
      </button>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
        <Bell className="w-3 h-3" />
        {tr(
          "Tu recevras des rappels push pour les actions importantes.",
          "You'll get push reminders for the important actions.",
        )}
      </p>
    </div>
  );
}

/* ───────────────────────── Plan view (roadmap + tasks) ───────────────────────── */

function PlanView({
  plan,
  ctx,
  fr,
  lang,
  busy,
  onDelete,
  onToggleTask,
  onManualValue,
}: {
  plan: GoalPlan;
  ctx: MeasureCtx;
  fr: boolean;
  lang: string;
  busy: boolean;
  onDelete: () => void;
  onToggleTask: (key: string, done: boolean) => void;
  onManualValue: (goalId: string, value: number) => void;
}) {
  const tr = (f: string, e: string) => (fr ? f : e);
  const cur = currentMonthIndex(plan);
  const [openMonth, setOpenMonth] = useState<number>(cur);

  const monthLabel = (ymStr: string) => {
    const [y, m] = ymStr.split("-").map(Number);
    return new Intl.DateTimeFormat(fr ? "fr-FR" : "en-US", {
      month: "short",
      year: "2-digit",
    }).format(new Date(y, m - 1, 15));
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* ── Goals summary ── */}
      <div className="glass-strong rounded-3xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
            {tr("Mes objectifs", "My goals")}
            <span className="ml-2 text-slate-500 normal-case tracking-normal font-medium">
              {tr("depuis", "since")} {monthLabel(monthOf(plan, 0))}
            </span>
          </h2>
          <button
            onClick={onDelete}
            disabled={busy}
            aria-label={tr("Supprimer le plan", "Delete plan")}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <div className="grid gap-2.5">
          {plan.goals.map((g) => {
            const meta = KIND_META[g.kind];
            const Icon = meta.icon;
            const current = currentGoalValue(g, ctx);
            const finalReached = milestoneReached(
              g,
              plan.horizonMonths - 1,
              current,
              plan.horizonMonths,
            );
            // Overall progress start → final target.
            const span = g.targetValue - g.startValue;
            const overall =
              span === 0
                ? finalReached
                  ? 1
                  : 0
                : Math.max(0, Math.min(1, (current - g.startValue) / span));
            return (
              <div
                key={g.id}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3.5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center text-cyan-300 shrink-0">
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-white truncate">
                      {g.kind === "custom" ? g.label : fr ? meta.fr : meta.en}
                    </div>
                    <div className="text-[11px] text-slate-500 tabular-nums">
                      {fmtVal(g, g.startValue)} →{" "}
                      <span className="text-cyan-300 font-bold">{fmtVal(g, g.targetValue)}</span>
                      {" · "}
                      {tr("auj.", "now")}:{" "}
                      <span className="text-slate-300 font-semibold">{fmtVal(g, current)}</span>
                    </div>
                  </div>
                  {g.kind === "custom" && (
                    <ManualValueInput goal={g} onCommit={(v) => onManualValue(g.id, v)} fr={fr} />
                  )}
                  {finalReached && (
                    <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                    </span>
                  )}
                </div>
                <div className="mt-2.5 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      finalReached
                        ? "bg-emerald-400/80"
                        : "bg-gradient-to-r from-cyan-500 to-teal-400",
                    )}
                    style={{
                      width: `${Math.round((goalDirection(g) === "down" ? (finalReached ? 1 : overall === 0 && current <= g.startValue ? Math.max(0, Math.min(1, (g.startValue - current) / (g.startValue - g.targetValue || 1))) : overall) : overall) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Monthly roadmap ── */}
      <div className="space-y-2.5">
        {Array.from({ length: plan.horizonMonths }, (_, i) => {
          const locked = i > cur;
          const past = i < cur;
          const open = openMonth === i && !locked;
          const taskCompletion = monthTaskCompletion(plan, i);
          const tasks = tasksForMonth(plan, i, lang);
          return (
            <div
              key={i}
              className={cn(
                "glass rounded-2xl border transition-all overflow-hidden",
                i === cur
                  ? "border-cyan-400/40 bg-cyan-500/[0.04]"
                  : past
                    ? taskCompletion === 1
                      ? "border-emerald-500/25"
                      : "border-white/[0.06]"
                    : "border-white/[0.06] opacity-60",
              )}
            >
              <button
                onClick={() => !locked && setOpenMonth((m) => (m === i ? -1 : i))}
                disabled={locked}
                aria-expanded={open}
                className="w-full flex items-center gap-3 p-4 text-left disabled:cursor-not-allowed"
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                    past && taskCompletion === 1
                      ? "bg-emerald-500/20 text-emerald-300"
                      : i === cur
                        ? "bg-cyan-500/20 text-cyan-300"
                        : "bg-white/[0.05] text-slate-500",
                  )}
                >
                  {past && taskCompletion === 1 ? (
                    <Check className="w-4 h-4" />
                  ) : locked ? (
                    <Lock className="w-3.5 h-3.5" />
                  ) : (
                    i + 1
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        "text-sm font-semibold capitalize",
                        i === cur ? "text-white" : "text-slate-300",
                      )}
                    >
                      {tr("Mois", "Month")} {i + 1} · {monthLabel(monthOf(plan, i))}
                      {i === cur && (
                        <span className="ml-2 rounded-full bg-cyan-500/15 border border-cyan-500/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-300">
                          {tr("en cours", "current")}
                        </span>
                      )}
                    </span>
                    {!locked && (
                      <span className="text-[11px] font-bold tabular-nums text-slate-400 shrink-0">
                        {Math.round(taskCompletion * 100)}% {tr("tâches", "tasks")}
                      </span>
                    )}
                  </div>
                  {/* Milestone chips per goal */}
                  {!locked && (
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      {plan.goals.map((g) => (
                        <span key={g.id} className="text-[10px] text-slate-500 tabular-nums">
                          {g.kind === "custom"
                            ? g.label
                            : fr
                              ? KIND_META[g.kind].fr
                              : KIND_META[g.kind].en}
                          {": "}
                          <span
                            className={cn(
                              "font-bold",
                              milestoneReached(g, i, currentGoalValue(g, ctx), plan.horizonMonths)
                                ? "text-emerald-400"
                                : "text-slate-300",
                            )}
                          >
                            {fmtVal(g, milestoneValue(g, i, plan.horizonMonths))}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {!locked && (
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-slate-500 shrink-0 transition-transform",
                      open && "rotate-180",
                    )}
                  />
                )}
              </button>

              {open && (
                <div className="px-4 pb-4 border-t border-white/[0.06] pt-3.5 animate-fade-in space-y-3">
                  {/* Per-goal milestone progress (current month only — it's live) */}
                  {i === cur && (
                    <div className="grid gap-2">
                      {plan.goals.map((g) => {
                        const current = currentGoalValue(g, ctx);
                        const reached = milestoneReached(g, i, current, plan.horizonMonths);
                        const prog = reached ? 1 : goalProgress(g, i, current, plan.horizonMonths);
                        return (
                          <div key={g.id} className="flex items-center gap-2.5">
                            <span className="text-[10px] text-slate-500 w-28 truncate shrink-0">
                              {g.kind === "custom"
                                ? g.label
                                : fr
                                  ? KIND_META[g.kind].fr
                                  : KIND_META[g.kind].en}
                            </span>
                            <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-700",
                                  reached
                                    ? "bg-emerald-400/80"
                                    : "bg-gradient-to-r from-cyan-500 to-teal-400",
                                )}
                                style={{ width: `${Math.round(prog * 100)}%` }}
                              />
                            </div>
                            <span
                              className={cn(
                                "text-[10px] font-bold tabular-nums w-9 text-right",
                                reached ? "text-emerald-400" : "text-slate-400",
                              )}
                            >
                              {Math.round(prog * 100)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Tasks checklist */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                      <span className="text-[10px] uppercase tracking-[0.15em] text-cyan-300 font-bold">
                        {tr("Actions du mois", "This month's actions")}
                      </span>
                    </div>
                    <div className="grid gap-2">
                      {tasks.map((task) => {
                        const done = !!plan.tasksDone[task.key];
                        return (
                          <button
                            key={task.key}
                            onClick={() => onToggleTask(task.key, !done)}
                            className={cn(
                              "flex items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all",
                              done
                                ? "bg-emerald-500/[0.06] border-emerald-500/25"
                                : "bg-white/[0.03] border-white/[0.05] hover:border-white/[0.14]",
                            )}
                          >
                            <span
                              className={cn(
                                "mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all",
                                done
                                  ? "bg-emerald-500 border-emerald-400 text-white"
                                  : "border-white/[0.2] text-transparent",
                              )}
                            >
                              <Check className="w-3 h-3" />
                            </span>
                            <span className="min-w-0">
                              <span
                                className={cn(
                                  "block text-[13px] font-semibold",
                                  done ? "text-slate-400 line-through" : "text-slate-200",
                                )}
                              >
                                {task.title}
                              </span>
                              <span className="block text-xs text-slate-500 leading-relaxed mt-0.5">
                                {task.desc}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Inline editor for a custom goal's manually-tracked current value. */
function ManualValueInput({
  goal,
  onCommit,
  fr,
}: {
  goal: GoalDef;
  onCommit: (v: number) => void;
  fr: boolean;
}) {
  const [draft, setDraft] = useState(String(goal.manualValue ?? goal.startValue));
  useEffect(() => {
    setDraft(String(goal.manualValue ?? goal.startValue));
  }, [goal.manualValue, goal.startValue]);
  const commit = () => {
    const v = parseFloat(draft.replace(",", "."));
    if (Number.isFinite(v) && v !== (goal.manualValue ?? goal.startValue)) onCommit(v);
  };
  return (
    <input
      type="number"
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      aria-label={fr ? "Valeur actuelle" : "Current value"}
      className="w-20 h-9 shrink-0 bg-white/[0.05] border border-white/[0.1] rounded-lg px-2 text-xs font-bold text-white text-right tabular-nums focus:outline-none focus:border-cyan-500/40"
    />
  );
}
