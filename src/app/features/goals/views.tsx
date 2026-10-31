/* Sous-vues de la page Goals — extrait de Goals.tsx (Phase D), aucun changement de comportement. */
import { useEffect, useMemo, useState } from "react";
import {
  Target,
  Wallet,
  TrendingUp,
  ShieldAlert,
  Percent,
  Scale,
  NotebookPen,
  PenLine,
  Bell,
  Check,
  Lock,
  Sparkles,
  Loader2,
  Trash2,
  ChevronDown,
} from "@/shared/ui/icons";
import { cn } from "@/shared/ui/cn";
import { useT } from "@/app/i18n/LanguageContext";
import type { TKey } from "@/app/i18n/translations";
import {
  type GoalDef,
  type GoalKind,
  type GoalPlan,
  type MeasureCtx,
  type PlanPersonalization,
  currentGoalValue,
  isGoalMetricAvailable,
  currentMonthIndex,
  goalDirection,
  goalProgress,
  milestoneReached,
  milestoneValue,
  monthOf,
  monthTaskCompletion,
  tasksForMonth,
} from "./goalPlan";
import type { GoalForecast } from "@/modules/probability/goals";
import { formatMoney } from "@/shared/currency";

const KIND_META: Record<
  GoalKind,
  {
    icon: typeof Target;
    unit: string;
    ph: string;
  }
> = {
  capital: {
    icon: Wallet,
    unit: "$",
    ph: "100000",
  },
  profit_factor: {
    icon: TrendingUp,
    unit: "",
    ph: "2.0",
  },
  max_drawdown: {
    icon: ShieldAlert,
    unit: "%",
    ph: "5",
  },
  win_rate: {
    icon: Percent,
    unit: "%",
    ph: "60",
  },
  avg_rr: {
    icon: Scale,
    unit: "R",
    ph: "2.0",
  },
  discipline: {
    icon: NotebookPen,
    unit: "%",
    ph: "100",
  },
  custom: {
    icon: PenLine,
    unit: "",
    ph: "10",
  },
};

const fmtVal = (g: GoalDef, v: number): string => {
  const meta = KIND_META[g.kind];
  const unit = g.kind === "custom" ? (g.unit ?? "") : meta.unit;
  const decimals = g.kind === "capital" ? 0 : v >= 100 ? 0 : 2;
  const s = v.toFixed(decimals);
  // « $ » est ici le MARQUEUR d'un objectif monétaire, pas le symbole
  // affiché : le montant s'écrit dans la devise du trader.
  return unit === "$" ? formatMoney(v, { whole: decimals === 0 }) : `${s}${unit ? unit : ""}`;
};

interface Draft {
  selected: boolean;
  target: string;
  label: string;
  unit: string;
  direction: "up" | "down";
  current: string; // custom only — manual start/current value
}

export function GoalPicker({
  ctx,
  busy,
  onGenerate,
}: {
  ctx: MeasureCtx;
  busy: boolean;
  onGenerate: (goals: GoalDef[]) => void;
}) {
  const { t } = useT();
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
        if (!isGoalMetricAvailable({ kind: k }, ctx)) return null;
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
    /* La carte porte `glass`, pas `glass-strong` : elle est POSÉE sur la page,
       elle ne flotte pas au-dessus. La plaque forte est celle des modales. */
    <div className="glass animate-fade-in-up rounded-3xl p-4 md:p-5">
      <h2 className="tv-title">{t("goals.pickYourGoals")}</h2>
      <p className="tv-row-label mt-0.5 mb-3">{t("goals.selectAsManyAs")}</p>

      <div className="mb-4 grid gap-1.5">
        {kinds.map((k) => {
          const m = KIND_META[k];
          const Icon = m.icon;
          const d = drafts[k];
          const available = isGoalMetricAvailable({ kind: k }, ctx);
          const cur = k === "custom" || !available ? null : measuredCurrent(k);
          return (
            <div
              key={k}
              className={cn(
                "overflow-hidden rounded-xl border transition",
                d.selected
                  ? "border-cyan-400/40 bg-cyan-500/[0.08]"
                  : "border-[var(--tv-border)] bg-[var(--tv-plate-2)] hover:border-[var(--tv-border-strong)]",
              )}
            >
              {/* UNE RANGÉE, PAS UNE CARTE. Sept choix à 62px de haut, c'est
                  434px de sélecteur avant le moindre réglage — et chacun ne
                  porte qu'un nom, une phrase et une case à cocher. La vignette
                  passe de 36 à 28px, la hauteur de 62 à 48. */}
              <button
                onClick={() => patch(k, { selected: !d.selected })}
                disabled={!available && !d.selected}
                aria-pressed={d.selected}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
              >
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors",
                    d.selected ? "bg-cyan-500/20 text-cyan-300" : "bg-white/[0.04] text-slate-400",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-white">
                    {t(`goals.kind.${k}` as TKey)}
                  </span>
                  <span className="tv-row-label block truncate">
                    {t(`goals.kind.${k}.desc` as TKey)}
                    {cur !== null && (
                      <>
                        {" · "}
                        <span className="tv-figure text-slate-300">
                          {t("goals.current")}:{" "}
                          {m.unit === "$"
                            ? formatMoney(cur, { whole: k === "capital" })
                            : `${cur.toFixed(k === "capital" ? 0 : 2)}${m.unit ?? ""}`}
                        </span>
                      </>
                    )}
                  </span>
                </span>
                <span
                  className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition",
                    d.selected
                      ? "border-cyan-400 bg-cyan-500 text-white"
                      : "border-white/[0.15] text-transparent",
                  )}
                >
                  <Check className="h-3 w-3" />
                </span>
              </button>

              {d.selected && (
                <div className="px-4 pb-4 animate-fade-in">
                  {k === "custom" && (
                    <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                      <input
                        value={d.label}
                        onChange={(e) => patch(k, { label: e.target.value })}
                        placeholder={t("goals.nameEGBacktest")}
                        className="col-span-2 h-11 bg-white/[0.05] border border-white/[0.1] rounded-xl px-3.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
                      />
                      <input
                        value={d.unit}
                        onChange={(e) => patch(k, { unit: e.target.value })}
                        placeholder={t("goals.unitHTrades")}
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
                            {dir === "up" ? t("goals.increase") : t("goals.decrease")}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={d.current}
                        onChange={(e) => patch(k, { current: e.target.value })}
                        placeholder={t("goals.currentValue2")}
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
                    <span className="tv-label absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                      {t("goals.6MoTarget")}
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
          "w-full h-12 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2",
          goals && !busy ? "tv-accent-fill" : "bg-white/[0.04] text-slate-600 cursor-not-allowed",
        )}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {busy
          ? t("goals.generating")
          : selectedCount > 1
            ? t("goals.generateMyActionPlan2").replace("{a}", String(selectedCount))
            : t("goals.generateMyActionPlan")}
      </button>
      <p className="mt-3 flex items-center justify-center gap-1.5 tv-row-label">
        <Bell className="w-3 h-3" />
        {t("goals.youLlGetPush")}
      </p>
    </div>
  );
}

/* ───────────────────────── Plan view (roadmap + tasks) ───────────────────────── */

export function PlanView({
  plan,
  ctx,
  fr,
  lang,
  busy,
  onDelete,
  onToggleTask,
  onManualValue,
  forecast,
}: {
  plan: GoalPlan;
  ctx: MeasureCtx;
  fr: boolean;
  lang: string;
  busy: boolean;
  onDelete: () => void;
  onToggleTask: (key: string, done: boolean) => void;
  onManualValue: (goalId: string, value: number) => void;
  /** Projection de l'objectif de capital. `null` quand elle n'a pas de
   *  reponse honnete : historique trop court, echeance depassee, objectif
   *  deja atteint. L'interface n'affiche alors rien. */
  forecast?: GoalForecast | null;
}) {
  const { t } = useT();
  const cur = currentMonthIndex(plan);
  const [openMonth, setOpenMonth] = useState<number>(cur);

  // The plan's shared monthly task attacks the trader's OWN most-costly
  // recurring mistake, read from real logged data — no generic filler.
  const personal = useMemo<PlanPersonalization>(() => {
    const worst = Object.entries(ctx.stats.mistakeStats)
      .map(([name, v]) => ({ name, totalPnl: v.totalPnl, count: v.count }))
      .filter((m) => m.totalPnl < 0)
      .sort((a, b) => a.totalPnl - b.totalPnl)[0];
    return { topMistake: worst };
  }, [ctx.stats.mistakeStats]);

  const monthLabel = (ymStr: string) => {
    const [y, m] = ymStr.split("-").map(Number);
    return new Intl.DateTimeFormat(fr ? "fr-FR" : "en-US", {
      month: "short",
      year: "2-digit",
    }).format(new Date(y, m - 1, 15));
  };

  return (
    <div className="animate-fade-in-up space-y-3">
      {/* ══ OÙ EN EST LE PLAN ═══════════════════════════════════════════
          Le trader ouvrait sur une carte « Mes objectifs » et devait déplier
          les mois pour savoir à quelle étape il en était. L'étape courante et
          les actions qui restent CE MOIS-CI sont maintenant la première ligne
          de la page — c'est la seule chose sur laquelle il peut agir
          aujourd'hui. */}
      <div className="glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-4 py-3">
        <div className="min-w-0">
          <div className="tv-label text-slate-500">{t("goals.currentStep")}</div>
          <div className="tv-figure mt-0.5 text-base leading-none text-white">
            {t("goals.month")} {cur + 1}
            <span className="text-slate-600">/{plan.horizonMonths}</span>
            <span className="ml-2 text-[11px] font-semibold text-slate-500">
              {monthLabel(monthOf(plan, cur))}
            </span>
          </div>
        </div>

        <div className="min-w-[120px] flex-1">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="tv-label text-slate-500">{t("goals.thisMonthSActions")}</span>
            <span className="tv-figure tv-figure-secondary text-[11px] text-slate-400">
              {Math.round(monthTaskCompletion(plan, cur) * 100)}%
            </span>
          </div>
          <div className="rp-bartrack">
            <span
              className="rp-fill-pos"
              style={{ width: `${Math.round(monthTaskCompletion(plan, cur) * 100)}%` }}
            />
          </div>
        </div>

        <button
          onClick={onDelete}
          disabled={busy}
          aria-label={t("goals.deletePlan")}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Les objectifs eux-mêmes ── */}
      <div className="glass rounded-3xl p-4">
        <div className="mb-2.5 flex items-baseline gap-2">
          <h2 className="tv-title">{t("goals.myGoals")}</h2>
          <span className="tv-num tv-row-label truncate">
            {t("goals.since")} {monthLabel(monthOf(plan, 0))}
          </span>
        </div>
        <div className="grid gap-1.5">
          {plan.goals.map((g) => {
            const meta = KIND_META[g.kind];
            const Icon = meta.icon;
            const current = currentGoalValue(g, ctx);
            const available = isGoalMetricAvailable(g, ctx);
            const finalReached =
              available && milestoneReached(g, plan.horizonMonths - 1, current, plan.horizonMonths);
            // Overall progress start → final target.
            const span = g.targetValue - g.startValue;
            let overall = 0;
            if (available) {
              overall =
                span === 0
                  ? finalReached
                    ? 1
                    : 0
                  : Math.max(0, Math.min(1, (current - g.startValue) / span));
            }
            return (
              <div
                key={g.id}
                className="rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-3 py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-cyan-500/15 text-cyan-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-white">
                      {g.kind === "custom" ? g.label : t(`goals.kind.${g.kind}` as TKey)}
                    </div>
                    <div className="tv-figure tv-figure-secondary truncate text-[11px] text-slate-500">
                      {fmtVal(g, g.startValue)} →{" "}
                      <span className="text-cyan-300 font-bold">{fmtVal(g, g.targetValue)}</span>
                      {" · "}
                      {t("goals.now")}:{" "}
                      <span className="text-slate-300 font-semibold">
                        {available ? fmtVal(g, current) : "—"}
                      </span>
                    </div>
                  </div>
                  {g.kind === "custom" && (
                    <ManualValueInput goal={g} onCommit={(v) => onManualValue(g.id, v)} />
                  )}
                  {finalReached && (
                    <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                    </span>
                  )}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={cn(
                      "h-full rounded-full transition duration-250",
                      finalReached ? "bg-emerald-400/80" : "bg-[var(--tv-accent)]",
                    )}
                    style={{
                      width: !available
                        ? "0%"
                        : `${Math.round((goalDirection(g) === "down" ? (finalReached ? 1 : overall === 0 && current <= g.startValue ? Math.max(0, Math.min(1, (g.startValue - current) / (g.startValue - g.targetValue || 1))) : overall) : overall) * 100)}%`,
                    }}
                  />
                </div>
                {/* La barre dit OÙ il en est ; elle ne dit pas si ça va se
                    faire. Seul un objectif de capital est projetable : le
                    moteur rééchantillonne des P&L, il ne sait rien dire d'un
                    objectif de win rate ou de discipline, et en fabriquer un
                    pourcentage serait inventer un chiffre. */}
                {g.kind === "capital" && !finalReached && forecast && (
                  <p className="tv-figure tv-figure-secondary mt-2 text-[11px] text-slate-400">
                    {t("goals.aChanceAtYour").replace(
                      "{a}",
                      String(Math.round(forecast.probability * 100)),
                    )}
                    {forecast.medianDaysToTarget !== null && (
                      <span className="text-slate-500">
                        {" · "}
                        {t("goals.aDIfIt").replace(
                          "{a}",
                          String(Math.round(forecast.medianDaysToTarget)),
                        )}
                      </span>
                    )}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── LA FEUILLE DE ROUTE ──
          Six mois, une ligne chacun. La ligne FERMÉE ne porte plus que ce qui
          situe : le rang, le mois, l'avancement des tâches. Les jalons par
          objectif — jusqu'à sept pastilles qui passaient sur trois lignes —
          descendent dans le contenu OUVERT : ce sont des détails de l'étape,
          pas son étiquette. Six mois fermés passent ainsi de 6 × 96px à
          6 × 52px. */}
      <div className="glass overflow-hidden rounded-3xl">
        <div className="divide-y divide-white/[0.04]">
          {Array.from({ length: plan.horizonMonths }, (_, i) => {
            const locked = i > cur;
            const past = i < cur;
            const open = openMonth === i && !locked;
            const taskCompletion = monthTaskCompletion(plan, i);
            const tasks = tasksForMonth(plan, i, lang, personal);
            return (
              <div
                key={i}
                className={cn(i === cur && "bg-cyan-500/[0.04]", locked && "opacity-60")}
              >
                <button
                  onClick={() => !locked && setOpenMonth((m) => (m === i ? -1 : i))}
                  disabled={locked}
                  aria-expanded={open}
                  className="tv-row-toggle flex w-full items-center gap-2.5 px-4 py-2.5 disabled:cursor-not-allowed"
                >
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                      past && taskCompletion === 1
                        ? "bg-emerald-500/20 text-emerald-300"
                        : i === cur
                          ? "bg-cyan-500/20 text-cyan-300"
                          : "bg-white/[0.05] text-slate-500",
                    )}
                  >
                    {past && taskCompletion === 1 ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : locked ? (
                      <Lock className="h-3 w-3" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    <span
                      className={cn(
                        "tv-num",
                        "text-[13px] font-semibold capitalize",
                        i === cur ? "text-white" : "text-slate-300",
                      )}
                    >
                      {t("goals.month")} {i + 1} · {monthLabel(monthOf(plan, i))}
                    </span>
                    {i === cur && (
                      <span className="tv-label ml-2 rounded-full border border-cyan-500/25 bg-cyan-500/15 px-1.5 py-0.5 text-cyan-300">
                        {t("goals.current2")}
                      </span>
                    )}
                  </span>
                  {!locked && (
                    <span className="tv-figure tv-figure-secondary shrink-0 text-[11px] text-slate-400">
                      {Math.round(taskCompletion * 100)}%
                    </span>
                  )}
                  {!locked && (
                    <ChevronDown
                      aria-hidden
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform",
                        open && "rotate-180",
                      )}
                    />
                  )}
                </button>

                {open && (
                  <div className="animate-fade-in space-y-3 border-t border-white/[0.04] px-4 pt-3 pb-4">
                    {/* Les jalons de l'étape — ici, et non dans l'étiquette. */}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {plan.goals.map((g) => (
                        <span
                          key={g.id}
                          className="tv-figure tv-figure-secondary text-[10px] text-slate-500"
                        >
                          {g.kind === "custom" ? g.label : t(`goals.kind.${g.kind}` as TKey)}
                          {": "}
                          <span
                            className={cn(
                              "font-bold",
                              isGoalMetricAvailable(g, ctx) &&
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
                    {/* Per-goal milestone progress (current month only — it's live) */}
                    {i === cur && (
                      <div className="grid gap-2">
                        {plan.goals.map((g) => {
                          const current = currentGoalValue(g, ctx);
                          const available = isGoalMetricAvailable(g, ctx);
                          const reached =
                            available && milestoneReached(g, i, current, plan.horizonMonths);
                          const prog = !available
                            ? null
                            : reached
                              ? 1
                              : goalProgress(g, i, current, plan.horizonMonths);
                          return (
                            <div key={g.id} className="flex items-center gap-2.5">
                              <span className="text-[10px] text-slate-500 w-28 truncate shrink-0">
                                {g.kind === "custom" ? g.label : t(`goals.kind.${g.kind}` as TKey)}
                              </span>
                              <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition duration-250",
                                    reached ? "bg-emerald-400/80" : "bg-[var(--tv-accent)]",
                                  )}
                                  style={{ width: `${Math.round((prog ?? 0) * 100)}%` }}
                                />
                              </div>
                              <span
                                className={cn(
                                  "tv-figure tv-figure-secondary text-[10px] w-9 text-right",
                                  reached ? "text-emerald-400" : "text-slate-400",
                                )}
                              >
                                {prog === null ? "—" : `${Math.round(prog * 100)}%`}
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
                        <span className="tv-label text-cyan-300">
                          {t("goals.thisMonthSActions")}
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
                                "flex items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left transition",
                                done
                                  ? "bg-emerald-500/[0.06] border-emerald-500/25"
                                  : "bg-white/[0.03] border-white/[0.05] hover:border-white/[0.14]",
                              )}
                            >
                              <span
                                className={cn(
                                  "mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition",
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
    </div>
  );
}

/** Inline editor for a custom goal's manually-tracked current value. */
function ManualValueInput({ goal, onCommit }: { goal: GoalDef; onCommit: (v: number) => void }) {
  const { t } = useT();
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
      aria-label={t("goals.currentValue")}
      className="tv-figure tv-figure-secondary w-20 h-9 shrink-0 bg-white/[0.05] border border-white/[0.1] rounded-lg px-2 text-xs text-white text-right focus:outline-none focus:border-cyan-500/40"
    />
  );
}
