import { useEffect, useMemo, useState } from "react";
import {
  Target,
  TrendingUp,
  ShieldAlert,
  Wallet,
  Check,
  Lock,
  Sparkles,
  Trash2,
  Loader2,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useAccounts } from "../contexts/AccountContext";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import type { Trade } from "../types";
import { computeStats } from "../utils/tradeCalcs";
import { computeQuantStats } from "../utils/quantStats";
import { loadStartingBalance } from "../store";
import {
  type GoalKind,
  type SixMonthGoal,
  loadSixMonthGoal,
  saveSixMonthGoal,
  deleteSixMonthGoal,
  buildMilestones,
  tipsForMonth,
} from "../utils/sixMonthGoal";

// "Objectif 6 mois" — pick ONE 6-month target; the system slices it into six
// progressive monthly milestones, each with a live progress bar and 2-3
// psychological exercises to validate the current step.

const KIND_META: Record<
  GoalKind,
  { icon: typeof Target; fr: string; en: string; unit: string; placeholderTarget: string }
> = {
  profit_factor: {
    icon: TrendingUp,
    fr: "Profit factor",
    en: "Profit factor",
    unit: "",
    placeholderTarget: "2.0",
  },
  max_drawdown: {
    icon: ShieldAlert,
    fr: "Drawdown max",
    en: "Max drawdown",
    unit: "%",
    placeholderTarget: "5",
  },
  capital: {
    icon: Wallet,
    fr: "Capital cible",
    en: "Target capital",
    unit: "$",
    placeholderTarget: "100000",
  },
};

export default function Goals({ trades }: { trades: Trade[] }) {
  const { user } = useAuth();
  const { activeId } = useAccounts();
  const { lang } = useT();
  const fr = lang === "fr";
  const tr = (f: string, e: string) => (fr ? f : e);

  const [goal, setGoal] = useState<SixMonthGoal | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingBalance, setStartingBalance] = useState(0);
  const [kind, setKind] = useState<GoalKind>("profit_factor");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([loadSixMonthGoal(user.id), loadStartingBalance(user.id)])
      .then(([g, b]) => {
        if (!active) return;
        setGoal(g);
        setStartingBalance(b);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user, activeId]);

  const stats = useMemo(() => computeStats(trades), [trades]);
  const quant = useMemo(
    () => computeQuantStats(trades, startingBalance),
    [trades, startingBalance],
  );

  /** Live value of the tracked metric. */
  const currentValue = (k: GoalKind): number =>
    k === "profit_factor"
      ? Math.min(stats.profitFactor, 99)
      : k === "max_drawdown"
        ? (quant.maxDrawdownPct ?? 0) * 100
        : startingBalance + stats.totalPnl;

  const create = async () => {
    if (!user || busy) return;
    const t = parseFloat(target.replace(",", "."));
    if (!Number.isFinite(t) || t <= 0) return;
    setBusy(true);
    const g: SixMonthGoal = {
      kind,
      startValue: Math.round(currentValue(kind) * 100) / 100,
      targetValue: t,
      startedAt: new Date().toISOString().slice(0, 10),
    };
    try {
      await saveSixMonthGoal(user.id, g);
      setGoal(g);
    } catch (e) {
      console.error("Failed to save goal", e);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      await deleteSixMonthGoal(user.id);
      setGoal(null);
      setTarget("");
    } catch (e) {
      console.error("Failed to delete goal", e);
    } finally {
      setBusy(false);
    }
  };

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
          {tr("Objectif 6 mois", "6-Month Goal")}
        </h1>
        <p className="text-xs md:text-sm text-slate-500 mt-1">
          {tr(
            "Un cap chiffré, découpé en 6 étapes mensuelles progressives.",
            "One measurable target, split into 6 progressive monthly steps.",
          )}
        </p>
      </div>

      {!goal ? (
        /* ── Setup ── */
        <div className="glass-strong rounded-3xl p-6 animate-fade-in-up">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
            {tr("Choisis ton objectif", "Pick your goal")}
          </h2>
          <div className="grid gap-2.5 mb-5">
            {(Object.keys(KIND_META) as GoalKind[]).map((k) => {
              const m = KIND_META[k];
              const Icon = m.icon;
              const active = kind === k;
              const cur = currentValue(k);
              return (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={cn(
                    "flex items-center gap-3.5 rounded-2xl p-4 border text-left transition-all",
                    active
                      ? "bg-cyan-500/15 border-cyan-400/50 shadow-lg shadow-cyan-500/10"
                      : "bg-white/[0.04] border-white/[0.08] hover:border-white/20",
                  )}
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      active ? "bg-cyan-500/20 text-cyan-300" : "bg-white/[0.04] text-slate-400",
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-white">{fr ? m.fr : m.en}</div>
                    <div className="text-xs text-slate-500">
                      {tr("Actuellement", "Currently")}:{" "}
                      <span className="text-slate-300 font-semibold tabular-nums">
                        {m.unit === "$" ? "$" : ""}
                        {cur.toFixed(k === "capital" ? 0 : 2)}
                        {m.unit === "%" ? "%" : ""}
                      </span>
                    </div>
                  </div>
                  {active && <Check className="w-4 h-4 text-cyan-300 shrink-0" />}
                </button>
              );
            })}
          </div>

          <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
            {tr("Valeur cible dans 6 mois", "Target value in 6 months")}
          </label>
          <div className="relative mb-5 max-w-[220px]">
            <input
              type="number"
              inputMode="decimal"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={KIND_META[kind].placeholderTarget}
              className="w-full h-12 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 pr-9 text-base font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
            />
            {KIND_META[kind].unit && (
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                {KIND_META[kind].unit}
              </span>
            )}
          </div>

          <button
            onClick={create}
            disabled={busy || !target}
            className={cn(
              "w-full h-12 rounded-xl text-sm font-bold transition-all",
              target && !busy
                ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/20 hover:brightness-110"
                : "bg-white/[0.04] text-slate-600 cursor-not-allowed",
            )}
          >
            {busy
              ? tr("Création…", "Creating…")
              : tr("Générer mon plan de route", "Generate my roadmap")}
          </button>
        </div>
      ) : (
        /* ── Roadmap ── */
        <Roadmap
          goal={goal}
          current={currentValue(goal.kind)}
          onDelete={remove}
          busy={busy}
          fr={fr}
        />
      )}
    </div>
  );
}

function Roadmap({
  goal,
  current,
  onDelete,
  busy,
  fr,
}: {
  goal: SixMonthGoal;
  current: number;
  onDelete: () => void;
  busy: boolean;
  fr: boolean;
}) {
  const tr = (f: string, e: string) => (fr ? f : e);
  const meta = KIND_META[goal.kind];
  const Icon = meta.icon;
  const milestones = useMemo(() => buildMilestones(goal, current), [goal, current]);
  const cur = milestones.find((m) => m.isCurrent);
  const tips = useMemo(
    () => tipsForMonth(goal.kind, cur?.index ?? 0, fr ? "fr" : "en"),
    [goal.kind, cur?.index, fr],
  );
  const fmtVal = (v: number) =>
    `${meta.unit === "$" ? "$" : ""}${v.toFixed(goal.kind === "capital" ? 0 : 2)}${meta.unit === "%" ? "%" : ""}`;
  const monthLabel = (ymStr: string) => {
    const [y, m] = ymStr.split("-").map(Number);
    return new Intl.DateTimeFormat(fr ? "fr-FR" : "en-US", {
      month: "short",
      year: "2-digit",
    }).format(new Date(y, m - 1, 15));
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Goal header */}
      <div className="glass-strong rounded-3xl p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 flex items-center justify-center text-cyan-300 shrink-0">
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white">{fr ? meta.fr : meta.en}</div>
          <div className="text-xs text-slate-500">
            {fmtVal(goal.startValue)} →{" "}
            <span className="text-cyan-300 font-bold">{fmtVal(goal.targetValue)}</span>
            {" · "}
            {tr("aujourd'hui", "today")}:{" "}
            <span className="text-slate-300 font-semibold tabular-nums">{fmtVal(current)}</span>
          </div>
        </div>
        <button
          onClick={onDelete}
          disabled={busy}
          aria-label={tr("Supprimer l'objectif", "Delete goal")}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* 6 monthly steps */}
      <div className="space-y-2.5">
        {milestones.map((m) => {
          const locked = !m.isCurrent && !m.reached && m.progress === 0;
          return (
            <div
              key={m.index}
              className={cn(
                "glass rounded-2xl p-4 border transition-all",
                m.isCurrent
                  ? "border-cyan-400/40 bg-cyan-500/[0.05]"
                  : m.reached
                    ? "border-emerald-500/25"
                    : "border-white/[0.06] opacity-70",
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                    m.reached
                      ? "bg-emerald-500/20 text-emerald-300"
                      : m.isCurrent
                        ? "bg-cyan-500/20 text-cyan-300"
                        : "bg-white/[0.05] text-slate-500",
                  )}
                >
                  {m.reached ? (
                    <Check className="w-4 h-4" />
                  ) : locked ? (
                    <Lock className="w-3.5 h-3.5" />
                  ) : (
                    m.index + 1
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        "text-sm font-semibold capitalize",
                        m.isCurrent ? "text-white" : "text-slate-300",
                      )}
                    >
                      {tr("Mois", "Month")} {m.index + 1} · {monthLabel(m.month)}
                    </span>
                    <span className="text-xs font-bold tabular-nums text-slate-400">
                      {fmtVal(m.value)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700",
                        m.reached
                          ? "bg-emerald-400/80"
                          : "bg-gradient-to-r from-cyan-500 to-teal-400",
                      )}
                      style={{ width: `${Math.round(m.progress * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Current month: the 2-3 psychological exercises that validate the step */}
              {m.isCurrent && (
                <div className="mt-4 pt-3 border-t border-white/[0.06]">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                    <span className="text-[10px] uppercase tracking-[0.15em] text-cyan-300 font-bold">
                      {tr("Exercices du mois", "This month's exercises")}
                    </span>
                  </div>
                  <div className="grid gap-2">
                    {tips.map((tip) => (
                      <div
                        key={tip.title}
                        className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-3.5 py-2.5"
                      >
                        <div className="text-[13px] font-semibold text-slate-200">{tip.title}</div>
                        <div className="text-xs text-slate-500 leading-relaxed mt-0.5">
                          {tip.desc}
                        </div>
                      </div>
                    ))}
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
