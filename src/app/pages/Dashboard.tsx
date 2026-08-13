import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Target,
  Activity,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  LineChart,
  CalendarDays,
  Gauge,
  Scale,
  LayoutDashboard,
} from "lucide-react";
import { Trade, isBreakEven } from "../types";
import {
  computeStats,
  formatPnl,
  formatPct,
  formatShortDate,
  directionLabel,
  directionBadgeClass,
} from "../utils/tradeCalcs";
import { computeQuantStats } from "../utils/quantStats";
import { loadStartingBalance } from "../store";
import { loadOnboarding } from "../store/profile";
import { deriveDailyRule } from "../utils/edgeScore";
import { useEdgeScore } from "../hooks/useEdgeScore";
import {
  readHistory,
  writeHistory,
  appendToday,
  dayOverDayDelta,
  trend,
  type EdgePoint,
} from "../utils/edgeHistory";
import { useAuth } from "../contexts/AuthContext";
import { useAccounts } from "../contexts/AccountContext";
import { useToast } from "../contexts/ToastContext";
import { useHasTradeDraft } from "../utils/persistence";
import { PageHeader, PageContainer, Metric, Card, Button } from "@/shared/ui";
import CopilotBlock from "./dashboard/CopilotBlock";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";

// recharts (~150-200 KB) is loaded on demand: the Dashboard shell is eager
// (landing page), but the equity chart — below the fold — is code-split so it
// no longer weighs on the initial bundle.
const EquityChart = lazy(() => import("../components/EquityChart"));

interface DashboardProps {
  trades: Trade[];
  onAddTrade: () => void;
  tradesLoading?: boolean;
  onOpenChecklist?: () => void;
  onOpenImport?: () => void;
  /** Ouvre un trade récent en édition. La liste affichait déjà un état `hover`
   *  qui promettait cette interaction sans la fournir. */
  onEditTrade?: (trade: Trade) => void;
  /** « Tout voir » — la liste est tronquée à 4, il faut un accès au reste. */
  onOpenJournal?: () => void;
}

type Period = "7d" | "30d" | "ytd" | "all";
const PERIODS: Period[] = ["7d", "30d", "ytd", "all"];
const PERIOD_STORAGE_KEY = "tv.dashboard.period";

function periodCutoff(period: Period): string | null {
  const now = new Date();
  if (period === "7d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }
  if (period === "30d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }
  if (period === "ytd") return `${now.getFullYear()}-01-01`;
  return null;
}

export default function Dashboard({
  trades,
  onAddTrade,
  tradesLoading,
  onOpenChecklist,
  // Déclaré dans `DashboardProps` et UTILISÉ dans l'état vide, mais il n'était
  // pas destructuré : la référence levait un ReferenceError au rendu du premier
  // écran d'un nouvel utilisateur. Vite ne typecheckant pas au build, le défaut
  // passait la CI.
  onOpenImport,
  onEditTrade,
  onOpenJournal,
}: DashboardProps) {
  const { t } = useT();
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeId } = useAccounts();
  const [period, setPeriod] = useState<Period>(() => {
    try {
      const saved = localStorage.getItem(PERIOD_STORAGE_KEY);
      return PERIODS.includes(saved as Period) ? (saved as Period) : "all";
    } catch {
      return "all";
    }
  });
  const [startingBalance, setStartingBalance] = useState(0);
  const [monthlyTarget, setMonthlyTarget] = useState<number | null>(null);
  const hasDraft = useHasTradeDraft(user?.id);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    Promise.allSettled([
      loadStartingBalance(user.id)
        .then((b) => {
          if (active) setStartingBalance(b);
        })
        .catch(() => {
          if (active) toast(t("dashboard.loadError"), "error");
        }),
      loadOnboarding(user.id)
        .then((o) => {
          if (active) setMonthlyTarget(o.monthlyTarget ?? null);
        })
        .catch(() => {
          if (active) toast(t("dashboard.loadError"), "error");
        }),
    ]);
    return () => {
      active = false;
    };
  }, [user?.id, activeId]);

  const changePeriod = (p: Period) => {
    setPeriod(p);
    try {
      localStorage.setItem(PERIOD_STORAGE_KEY, p);
    } catch {
      /* best-effort persistence — ignore */
    }
  };

  const cutoff = periodCutoff(period);
  const { filtered, pnlBefore } = useMemo(() => {
    if (!cutoff) return { filtered: trades, pnlBefore: 0 };
    let before = 0;
    const list: Trade[] = [];
    for (const tr of trades) {
      if (tr.date >= cutoff) list.push(tr);
      else before += tr.pnl;
    }
    return { filtered: list, pnlBefore: before };
  }, [trades, cutoff]);

  const stats = useMemo(() => computeStats(filtered), [filtered]);
  const quant = useMemo(
    () => computeQuantStats(filtered, startingBalance),
    [filtered, startingBalance],
  );
  const recentTrades = useMemo(
    () => [...filtered].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4),
    [filtered],
  );

  // Extra at-a-glance context for the period: how many days actually traded,
  // average per trading day, and the long/short lean of the sample.
  const insight = useMemo(() => {
    const tradingDays = Object.keys(stats.dailyPnl).length;
    const avgPerDay = tradingDays > 0 ? stats.totalPnl / tradingDays : 0;
    const directional = filtered.filter((tr) => tr.direction !== "be");
    const longs = directional.filter((tr) => tr.direction === "long").length;
    const longShare = directional.length > 0 ? longs / directional.length : null;
    return { tradingDays, avgPerDay, longShare, longs, shorts: directional.length - longs };
  }, [stats.dailyPnl, stats.totalPnl, filtered]);

  // % variation of the period relative to the equity at its start
  // (starting balance + PnL accumulated before the period).
  const baseline = startingBalance + pnlBefore;
  const periodPct = baseline > 0 ? stats.totalPnl / baseline : null;

  // Pre-market checklist status (written by the Checklist page in localStorage)
  const chkStatus = useMemo(() => {
    if (!user) return null;
    try {
      const key = `tv-chk-${user.id}-${new Date().toISOString().slice(0, 10)}`;
      const raw = localStorage.getItem(key);
      if (!raw) return { locked: false, n: 0, total: 0 };
      const p = JSON.parse(raw) as { locked?: boolean; checked?: boolean[] };
      const arr = Array.isArray(p.checked) ? p.checked : [];
      return { locked: !!p.locked, n: arr.filter(Boolean).length, total: arr.length };
    } catch {
      return null;
    }
  }, [user?.id]);

  // ── Copilot block: Edge Score, rule of the day, objective ──
  // Edge Score via le hook PARTAGÉ avec Jarvis : une seule définition de ce
  // score dans tout le produit. L'assemblage des entrées (checklist par jour,
  // risque max, solde initial) vit désormais dans `useEdgeScore`.
  const edge = useEdgeScore(trades, user?.id);

  const dailyRule = useMemo(() => deriveDailyRule(computeStats(trades)), [trades]);

  // ── Trajectoire de discipline ──────────────────────────────────────────────
  // On conserve un HISTORIQUE borné du score, pas seulement l'instantané de la
  // veille : le delta jour/jour dit « tu as monté depuis hier », il ne dit pas
  // « tu progresses ». La logique vit dans un module pur et testé
  // (`utils/edgeHistory.ts`), ici on ne fait que la brancher.
  const today = new Date().toISOString().slice(0, 10);
  const [edgeHistory, setEdgeHistory] = useState<EdgePoint[]>([]);

  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    setEdgeHistory(readHistory(window.localStorage, user.id));
  }, [user?.id]);

  // Enregistre (ou réécrit) le score du jour : il bouge à chaque trade ajouté,
  // c'est la valeur de fin de journée qui fait foi.
  useEffect(() => {
    if (!user || edge.score === null || typeof window === "undefined") return;
    setEdgeHistory((prev) => {
      const next = appendToday(prev, today, edge.score as number);
      writeHistory(window.localStorage, user.id, next);
      return next;
    });
  }, [user?.id, edge.score, today]);

  const edgeDelta = useMemo(
    () => (edge.score === null ? null : dayOverDayDelta(edgeHistory, today, edge.score)),
    [edgeHistory, edge.score, today],
  );

  const edgeTrend = useMemo(() => trend(edgeHistory), [edgeHistory]);

  // Monthly objective: current-month PnL as a fraction of the month's opening
  // equity (starting balance + PnL accumulated before this month).
  const objective = useMemo(() => {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    let monthPnl = 0;
    let before = 0;
    for (const tr of trades) {
      if (tr.date >= monthStart) monthPnl += tr.pnl;
      else before += tr.pnl;
    }
    const base = startingBalance + before;
    return { currentPct: base > 0 ? monthPnl / base : 0, targetPct: monthlyTarget };
  }, [trades, startingBalance, monthlyTarget]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 5) return t("dashboard.greetingStillUp");
    if (h < 12) return t("dashboard.greetingMorning");
    if (h < 18) return t("dashboard.greetingAfternoon");
    return t("dashboard.greetingEvening");
  };

  const gain = stats.totalPnl >= 0;
  const streakLabel = `${stats.currentStreak}${
    stats.currentStreakType === "win"
      ? "W"
      : stats.currentStreakType === "loss"
        ? "L"
        : stats.currentStreakType === "be"
          ? "BE"
          : ""
  }`;
  const streakColor =
    stats.currentStreakType === "win"
      ? "text-emerald-400"
      : stats.currentStreakType === "loss"
        ? "text-red-400"
        : "text-slate-300";

  return (
    <PageContainer>
      <PageHeader
        className="items-center"
        icon={
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600">
            <LayoutDashboard className="w-4 h-4 text-white" />
          </span>
        }
        eyebrow={
          <div className="flex items-center gap-2 text-[11px] md:text-xs font-semibold text-cyan-400/80 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{getGreeting()}</span>
          </div>
        }
        title={t("dashboard.title")}
        actions={
          <Button variant="accent" onClick={onAddTrade} className="relative hidden md:flex">
            <Plus className="w-4 h-4" /> {t("common.addTrade")}
            {hasDraft && (
              <span className="flex items-center gap-1 ml-1 pl-2 border-l border-white/25 text-[10px] font-bold uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />{" "}
                {t("trade.draftBadge")}
              </span>
            )}
          </Button>
        }
      />

      {/* Frame paints instantly; data sections show a skeleton only while the
          first trades load. No full-page blocker. */}
      {tradesLoading ? (
        <div className="space-y-4">
          <div className="glass rounded-3xl p-5 animate-pulse">
            <div className="h-4 w-1/3 bg-white/10 rounded-lg mb-3" />
            <div className="h-20 bg-white/[0.06] rounded-2xl" />
          </div>
          <div className="glass rounded-3xl p-5 animate-pulse">
            <div className="h-32 bg-white/[0.06] rounded-2xl" />
          </div>
        </div>
      ) : (
        <>
          {/* Copilot block — the day's focus (Edge Score, rule, checklist, objective) */}
          {trades.length > 0 && (
            <CopilotBlock
              edge={edge}
              edgeDelta={edgeDelta}
              edgeTrend={edgeTrend}
              edgeScores={edgeHistory.map((p) => p.score)}
              rule={dailyRule}
              checklist={chkStatus}
              objective={objective}
              onOpenChecklist={onOpenChecklist}
            />
          )}

          {trades.length === 0 ? (
            /* ── Empty state: first-run experience ── */
            <div className="glass rounded-3xl p-5 md:p-10 text-center card-premium  relative overflow-hidden">
              <svg
                viewBox="0 0 200 80"
                className="w-48 md:w-64 mx-auto mb-6 opacity-80"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="emptyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--tv-highlight)" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="var(--tv-highlight)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M4 68 L36 52 L62 60 L96 30 L128 40 L162 14 L196 22"
                  fill="none"
                  stroke="var(--tv-highlight)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ filter: "drop-shadow(0 0 6px rgb(var(--tv-highlight-rgb) / 0.5))" }}
                />
                <path
                  d="M4 68 L36 52 L62 60 L96 30 L128 40 L162 14 L196 22 L196 78 L4 78 Z"
                  fill="url(#emptyGrad)"
                  stroke="none"
                />
                <circle
                  cx="162"
                  cy="14"
                  r="3.5"
                  fill="var(--tv-highlight)"
                  style={{ filter: "drop-shadow(0 0 5px rgb(var(--tv-highlight-rgb) / 0.9))" }}
                />
              </svg>
              <h2 className="text-lg md:text-xl font-bold text-white mb-2">{t("empty.title")}</h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">{t("empty.subtitle")}</p>
              <Button variant="accent" onClick={onAddTrade}>
                <Plus className="w-4 h-4" /> {t("empty.cta")}
              </Button>
              {onOpenImport && (
                <button
                  onClick={onOpenImport}
                  className="mt-3 text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors"
                >
                  {t("settings.importCsv")}
                </button>
              )}
              {/* Ghost example of what a logged trade looks like */}
              <div
                className="max-w-sm mx-auto mt-8 text-left opacity-50 pointer-events-none select-none"
                aria-hidden="true"
              >
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
                  {t("empty.example")}
                </div>
                <div className="glass rounded-xl px-4 py-3 flex items-center gap-3 border-dashed">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">NQ</span>
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                        L
                      </span>
                      <span className="text-[10px] text-slate-600">Silver Bullet</span>
                    </div>
                    <div className="text-[10px] text-slate-600">
                      10:03 · 2R · $150 {t("dashboard.riskSuffix")}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-emerald-400">+$300.00</div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* ── Hero: Equity Curve ── */}
              <div className="relative glass rounded-3xl p-4 md:p-5 card-premium  overflow-hidden mb-4 md:mb-6">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                      <LineChart className="w-3.5 h-3.5 text-cyan-400/70" />
                      {t("dashboard.equityCurve")}
                    </div>
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span
                        className={cn(
                          "font-display text-3xl md:text-4xl font-extrabold tabular-nums tracking-tight",
                          gain ? "text-emerald-400" : "text-red-400",
                        )}
                        style={{
                          textShadow: gain
                            ? "0 0 24px rgba(16,185,129,0.25)"
                            : "0 0 24px rgba(239,68,68,0.25)",
                        }}
                      >
                        {formatPnl(stats.totalPnl)}
                      </span>
                      {periodPct !== null && (
                        <span
                          className={cn(
                            "text-xs md:text-sm font-bold px-2 py-0.5 rounded-lg tabular-nums",
                            gain
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400",
                          )}
                        >
                          {periodPct >= 0 ? "+" : ""}
                          {(periodPct * 100).toFixed(2)}%
                        </span>
                      )}
                      <span className="text-[11px] text-slate-500">
                        {stats.totalTrades} {t("common.trades")}
                      </span>
                    </div>
                  </div>
                  {/* Period selector */}
                  <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
                    {PERIODS.map((p) => (
                      <button
                        key={p}
                        onClick={() => changePeriod(p)}
                        className={cn(
                          "px-2.5 md:px-3.5 py-1.5 rounded-lg text-[11px] md:text-xs font-bold uppercase transition",
                          period === p
                            ? "bg-cyan-500/15 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                            : "text-slate-500 hover:text-slate-300",
                        )}
                      >
                        {p === "7d"
                          ? "7D"
                          : p === "30d"
                            ? "30D"
                            : p === "ytd"
                              ? "YTD"
                              : t("common.all")}
                      </button>
                    ))}
                  </div>
                </div>
                {stats.equityCurve.length > 0 ? (
                  <div className="h-56 md:h-80 chart-draw">
                    <Suspense
                      fallback={
                        <div className="h-full w-full animate-pulse rounded-lg bg-white/[0.03]" />
                      }
                    >
                      <EquityChart data={stats.equityCurve} />
                    </Suspense>
                  </div>
                ) : (
                  <div className="h-56 md:h-80 flex items-center justify-center text-slate-600 text-sm">
                    {t("dashboard.noTradesInPeriod")}
                  </div>
                )}

                {/* Period context strip — quick, glanceable framing under the curve */}
                {stats.totalTrades > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/[0.05] grid grid-cols-3 gap-2 md:gap-4">
                    <MiniStat
                      icon={<CalendarDays className="w-3.5 h-3.5" />}
                      label={t("dashboard.tradingDays")}
                      value={String(insight.tradingDays)}
                    />
                    <MiniStat
                      icon={<Gauge className="w-3.5 h-3.5" />}
                      label={t("dashboard.avgPerDay")}
                      value={formatPnl(insight.avgPerDay)}
                      accent={insight.avgPerDay >= 0 ? "text-emerald-400" : "text-red-400"}
                    />
                    <MiniStat
                      icon={<Scale className="w-3.5 h-3.5" />}
                      label={t("dashboard.longShort")}
                      value={
                        insight.longShare !== null
                          ? `${Math.round(insight.longShare * 100)}% L`
                          : "—"
                      }
                      sub={`${insight.longs}L · ${insight.shorts}S`}
                    />
                  </div>
                )}
              </div>

              {/* Stats Grid — radial gauges + sparkline, with folded secondary stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
                <Metric
                  title={t("stats.winRate")}
                  value={formatPct(stats.winRate)}
                  valueClass={stats.winRate >= 0.5 ? "text-emerald-400" : "text-red-400"}
                  visual={{
                    kind: "radial",
                    pct: stats.winRate,
                    color: stats.winRate >= 0.5 ? "#10b981" : "#ef4444",
                    center: `${stats.wins}/${stats.losses}`,
                  }}
                  footer={{
                    label: t("dashboard.currentStreak"),
                    value: streakLabel,
                    className: streakColor,
                  }}
                  delay={0}
                />
                <Metric
                  title={t("dashboard.profitFactor")}
                  value={stats.profitFactor >= 99 ? "99+" : stats.profitFactor.toFixed(2)}
                  valueClass={
                    stats.profitFactor >= 1.5
                      ? "text-emerald-400"
                      : stats.profitFactor < 1
                        ? "text-red-400"
                        : "text-white"
                  }
                  visual={{
                    kind: "radial",
                    pct: Math.min(stats.profitFactor / 3, 1),
                    color:
                      stats.profitFactor >= 1.5
                        ? "#10b981"
                        : stats.profitFactor < 1
                          ? "#ef4444"
                          : "#22d3ee",
                  }}
                  footer={{ label: t("dashboard.avgRR"), value: stats.avgRR.toFixed(2) }}
                  delay={60}
                />
                <Metric
                  icon={
                    quant.expectancy >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )
                  }
                  title={t("quant.expectancy")}
                  value={formatPnl(quant.expectancy)}
                  valueClass={quant.expectancy >= 0 ? "text-emerald-400" : "text-red-400"}
                  visual={{
                    kind: "spark",
                    data: stats.equityCurve.map((e) => e.equity),
                    color: quant.expectancy >= 0 ? "#22d3ee" : "#ef4444",
                  }}
                  footer={{
                    label: t("dashboard.bestWorst"),
                    value: `${stats.bestTrade ? formatPnl(stats.bestTrade.pnl) : "—"} / ${stats.worstTrade ? formatPnl(stats.worstTrade.pnl) : "—"}`,
                  }}
                  delay={120}
                />
                <Metric
                  title={t("dashboard.maxDrawdown")}
                  value={formatPnl(-stats.maxDrawdown)}
                  valueClass="text-red-400"
                  visual={{
                    kind: "radial",
                    pct: quant.maxDrawdownPct ?? 0,
                    color: (quant.maxDrawdownPct ?? 0) >= 0.2 ? "#ef4444" : "#f59e0b",
                    center:
                      quant.maxDrawdownPct !== null
                        ? `${(quant.maxDrawdownPct * 100).toFixed(0)}%`
                        : undefined,
                  }}
                  footer={{
                    label: t("quant.cleanTrades"),
                    value: formatPct(quant.cleanTrades),
                    className: quant.cleanTrades >= 0.8 ? "text-emerald-400" : "text-amber-400",
                  }}
                  delay={180}
                />
              </div>

              <div>
                {/* Recent Trades */}
                <Card hover className="overflow-hidden ">
                  <div className="px-4 md:px-5 py-3 md:py-4 border-b border-white/[0.06] flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-white">
                      {t("dashboard.recentTrades")}
                    </h3>
                    {onOpenJournal && trades.length > recentTrades.length && (
                      <button
                        onClick={onOpenJournal}
                        className="text-xs font-semibold text-cyan-400/90 hover:text-cyan-300 transition-colors shrink-0"
                      >
                        {t("common.viewAll")}
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {recentTrades.length === 0 ? (
                      <div className="px-4 py-10 text-center text-slate-600 text-sm">
                        {t("dashboard.noTradesInPeriod")}
                      </div>
                    ) : (
                      recentTrades.map((trade) => {
                        const be = isBreakEven(trade);
                        // `button` et non `div` quand l'action existe : le clavier
                        // et les lecteurs d'écran doivent atteindre l'édition,
                        // pas seulement la souris.
                        const RowTag = onEditTrade ? "button" : "div";
                        return (
                          <RowTag
                            key={trade.id}
                            {...(onEditTrade
                              ? {
                                  type: "button" as const,
                                  onClick: () => onEditTrade(trade),
                                  "aria-label": `${t("common.edit")} ${trade.symbol} ${formatShortDate(trade.date)}`,
                                }
                              : {})}
                            className={cn(
                              "px-4 md:px-5 py-3 trade-card flex items-center gap-3 transition-colors",
                              onEditTrade
                                ? "w-full text-left hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:outline-none cursor-pointer"
                                : "hover:bg-white/[0.02]",
                            )}
                          >
                            <div
                              className={cn(
                                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                                be
                                  ? "bg-slate-500/10"
                                  : trade.pnl >= 0
                                    ? "bg-emerald-500/10"
                                    : "bg-red-500/10",
                              )}
                            >
                              {be ? (
                                <Minus className="w-4 h-4 text-slate-300" />
                              ) : trade.pnl >= 0 ? (
                                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <ArrowDownRight className="w-4 h-4 text-red-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white">{trade.symbol}</span>
                                <span
                                  className={cn(
                                    "text-[11px] font-bold px-1.5 py-0.5 rounded",
                                    directionBadgeClass(trade.direction),
                                  )}
                                >
                                  {directionLabel(trade.direction)}
                                </span>
                                <span className="hidden md:inline text-[10px] text-slate-600">
                                  {trade.strategy}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-600">
                                {formatShortDate(trade.date)} · {trade.rMultiple.toFixed(1)}R
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div
                                className={cn(
                                  "text-sm font-bold",
                                  be
                                    ? "text-slate-300"
                                    : trade.pnl >= 0
                                      ? "text-emerald-400"
                                      : "text-red-400",
                                )}
                              >
                                {formatPnl(trade.pnl)}
                              </div>
                              <div className="text-[10px] text-slate-600">
                                ${trade.riskAmount.toFixed(0)} {t("dashboard.riskSuffix")}
                              </div>
                            </div>
                          </RowTag>
                        );
                      })
                    )}
                  </div>
                </Card>
              </div>
            </>
          )}
        </>
      )}
    </PageContainer>
  );
}

function MiniStat({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[11px] md:text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1 truncate">
        <span className="text-cyan-400/60">{icon}</span>
        {label}
      </div>
      <div
        className={cn(
          "font-display text-sm md:text-base font-extrabold tabular-nums truncate",
          accent || "text-white",
        )}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-slate-600 tabular-nums truncate">{sub}</div>}
    </div>
  );
}
