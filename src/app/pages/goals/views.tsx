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
} from "lucide-react";
import { cn } from "../../utils/cn";
import {
  type GoalDef,
  type GoalKind,
  type GoalPlan,
  type MeasureCtx,
  type PlanPersonalization,
  currentGoalValue,
  currentMonthIndex,
  goalDirection,
  goalProgress,
  milestoneReached,
  milestoneValue,
  monthOf,
  monthTaskCompletion,
  tasksForMonth,
} from "../../utils/goalPlan";
import type { GoalForecast } from "@/modules/probability/goals";

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
    /* La carte porte `glass`, pas `glass-strong` : elle est POSÉE sur la page,
       elle ne flotte pas au-dessus. La plaque forte est celle des modales. */
    <div className="glass animate-fade-in-up rounded-3xl p-4 md:p-5">
      <h2 className="tv-title">{tr("Choisis tes objectifs", "Pick your goals")}</h2>
      <p className="tv-row-label mt-0.5 mb-3">
        {tr(
          "Sélectionnes-en autant que tu veux — le plan les combine en 6 étapes mensuelles.",
          "Select as many as you want — the plan combines them into 6 monthly steps.",
        )}
      </p>

      <div className="mb-4 grid gap-1.5">
        {kinds.map((k) => {
          const m = KIND_META[k];
          const Icon = m.icon;
          const d = drafts[k];
          const cur = k === "custom" ? null : measuredCurrent(k);
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
                    {fr ? m.fr : m.en}
                  </span>
                  <span className="tv-row-label block truncate">
                    {fr ? m.frDesc : m.enDesc}
                    {cur !== null && (
                      <>
                        {" · "}
                        <span className="tv-figure text-slate-300">
                          {tr("actuel", "current")}: {m.unit === "$" ? "$" : ""}
                          {cur.toFixed(k === "capital" ? 0 : 2)}
                          {m.unit && m.unit !== "$" ? m.unit : ""}
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
                    <span className="tv-label absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
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
          "w-full h-12 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2",
          goals && !busy ? "tv-accent-fill" : "bg-white/[0.04] text-slate-600 cursor-not-allowed",
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
      <p className="mt-3 flex items-center justify-center gap-1.5 tv-row-label">
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
  const tr = (f: string, e: string) => (fr ? f : e);
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
          <div className="tv-label text-slate-500">{tr("Étape en cours", "Current step")}</div>
          <div className="tv-figure mt-0.5 text-base leading-none text-white">
            {tr("Mois", "Month")} {cur + 1}
            <span className="text-slate-600">/{plan.horizonMonths}</span>
            <span className="ml-2 text-[11px] font-semibold text-slate-500">
              {monthLabel(monthOf(plan, cur))}
            </span>
          </div>
        </div>

        <div className="min-w-[120px] flex-1">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="tv-label text-slate-500">
              {tr("Actions du mois", "This month's actions")}
            </span>
            <span className="tv-figure text-[11px] text-slate-400">
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
          aria-label={tr("Supprimer le plan", "Delete plan")}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Les objectifs eux-mêmes ── */}
      <div className="glass rounded-3xl p-4">
        <div className="mb-2.5 flex items-baseline gap-2">
          <h2 className="tv-title">{tr("Mes objectifs", "My goals")}</h2>
          <span className="tv-row-label truncate">
            {tr("depuis", "since")} {monthLabel(monthOf(plan, 0))}
          </span>
        </div>
        <div className="grid gap-1.5">
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
                className="rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-3 py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-cyan-500/15 text-cyan-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-white">
                      {g.kind === "custom" ? g.label : fr ? meta.fr : meta.en}
                    </div>
                    <div className="tv-figure truncate text-[11px] text-slate-500">
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
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={cn(
                      "h-full rounded-full transition duration-250",
                      finalReached ? "bg-emerald-400/80" : "bg-[var(--tv-accent)]",
                    )}
                    style={{
                      width: `${Math.round((goalDirection(g) === "down" ? (finalReached ? 1 : overall === 0 && current <= g.startValue ? Math.max(0, Math.min(1, (g.startValue - current) / (g.startValue - g.targetValue || 1))) : overall) : overall) * 100)}%`,
                    }}
                  />
                </div>
                {/* La barre dit OÙ il en est ; elle ne dit pas si ça va se
                    faire. Seul un objectif de capital est projetable : le
                    moteur rééchantillonne des P&L, il ne sait rien dire d'un
                    objectif de win rate ou de discipline, et en fabriquer un
                    pourcentage serait inventer un chiffre. */}
                {g.kind === "capital" && !finalReached && forecast && (
                  <p className="tv-figure mt-2 text-[11px] text-slate-400">
                    {tr(
                      `${Math.round(forecast.probability * 100)} % de chances d'y arriver au rythme actuel`,
                      `${Math.round(forecast.probability * 100)}% chance at your current pace`,
                    )}
                    {forecast.medianDaysToTarget !== null && (
                      <span className="text-slate-500">
                        {" · "}
                        {tr(
                          `~${Math.round(forecast.medianDaysToTarget)} j si ça passe`,
                          `~${Math.round(forecast.medianDaysToTarget)}d if it lands`,
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
                        "text-[13px] font-semibold capitalize",
                        i === cur ? "text-white" : "text-slate-300",
                      )}
                    >
                      {tr("Mois", "Month")} {i + 1} · {monthLabel(monthOf(plan, i))}
                    </span>
                    {i === cur && (
                      <span className="tv-label ml-2 rounded-full border border-cyan-500/25 bg-cyan-500/15 px-1.5 py-0.5 text-cyan-300">
                        {tr("en cours", "current")}
                      </span>
                    )}
                  </span>
                  {!locked && (
                    <span className="tv-figure shrink-0 text-[11px] text-slate-400">
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
                        <span key={g.id} className="tv-figure text-[10px] text-slate-500">
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
                    {/* Per-goal milestone progress (current month only — it's live) */}
                    {i === cur && (
                      <div className="grid gap-2">
                        {plan.goals.map((g) => {
                          const current = currentGoalValue(g, ctx);
                          const reached = milestoneReached(g, i, current, plan.horizonMonths);
                          const prog = reached
                            ? 1
                            : goalProgress(g, i, current, plan.horizonMonths);
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
                                    "h-full rounded-full transition duration-250",
                                    reached ? "bg-emerald-400/80" : "bg-[var(--tv-accent)]",
                                  )}
                                  style={{ width: `${Math.round(prog * 100)}%` }}
                                />
                              </div>
                              <span
                                className={cn(
                                  "tv-figure text-[10px] w-9 text-right",
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
                        <span className="tv-label text-cyan-300">
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
      className="tv-figure w-20 h-9 shrink-0 bg-white/[0.05] border border-white/[0.1] rounded-lg px-2 text-xs text-white text-right focus:outline-none focus:border-cyan-500/40"
    />
  );
}
