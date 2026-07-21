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
  ClipboardCheck,
  ChevronRight,
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
import { useAuth } from "../contexts/AuthContext";
import { useAccounts } from "../contexts/AccountContext";
import { useHasTradeDraft } from "../utils/persistence";
import StatsCard from "../components/StatsCard";
import DisciplineCard from "../components/DisciplineCard";
import { PageSkeleton } from "../components/Skeleton";
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
}: DashboardProps) {
  const { t } = useT();
  const { user } = useAuth();
  const { activeId } = useAccounts();
  const hasDraft = useHasTradeDraft(user?.id);
  const [period, setPeriod] = useState<Period>(() => {
    try {
      const saved = localStorage.getItem(PERIOD_STORAGE_KEY);
      return PERIODS.includes(saved as Period) ? (saved as Period) : "all";
    } catch {
      return "all";
    }
  });
  const [startingBalance, setStartingBalance] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    loadStartingBalance(user.id)
      .then((b) => {
        if (active) setStartingBalance(b);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.id, activeId]);

  const changePeriod = (p: Period) => {
    setPeriod(p);
    try {
      localStorage.setItem(PERIOD_STORAGE_KEY, p);
    } catch {}
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
    () => [...filtered].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
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

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 5) return t("dashboard.greetingStillUp");
    if (h < 12) return t("dashboard.greetingMorning");
    if (h < 18) return t("dashboard.greetingAfternoon");
    return t("dashboard.greetingEvening");
  };

  if (tradesLoading) return <PageSkeleton />;

  const gain = stats.totalPnl >= 0;

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className="animate-fade-in-up stagger-0">
          <div className="flex items-center gap-2 text-[11px] md:text-xs font-semibold text-cyan-400/80 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{getGreeting()}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            {t("dashboard.title")}
          </h1>
        </div>
        <button
          onClick={onAddTrade}
          className="relative hidden md:flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:-translate-y-0.5 animate-fade-in-up stagger-1"
        >
          <Plus className="w-4 h-4" /> {t("common.addTrade")}
          {hasDraft && (
            <span className="flex items-center gap-1 ml-1 pl-2 border-l border-white/25 text-[10px] font-bold uppercase tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />{" "}
              {t("trade.draftBadge")}
            </span>
          )}
        </button>
      </div>

      {/* Discipline Score v1 + streak (pure engine, PnL-independent) */}
      {user && <DisciplineCard userId={user.id} trades={trades} />}

      {/* Pre-market checklist synergy card */}
      {onOpenChecklist && chkStatus && (
        <button
          onClick={onOpenChecklist}
          className={cn(
            "w-full flex items-center gap-3 mb-4 md:mb-6 px-4 py-3 rounded-2xl border text-left transition-all animate-fade-in-up stagger-1 hover:-translate-y-0.5",
            chkStatus.locked
              ? "bg-emerald-500/[0.06] border-emerald-500/20 hover:bg-emerald-500/10"
              : "bg-cyan-500/[0.05] border-cyan-500/15 hover:bg-cyan-500/[0.09]",
          )}
        >
          <div
            className={cn(
              "w-9 h-9 rounded-xl border flex items-center justify-center shrink-0",
              chkStatus.locked
                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
            )}
          >
            <ClipboardCheck className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white">{t("chk.dashTitle")}</div>
            <div className="text-[11px] text-slate-400 truncate">
              {chkStatus.locked
                ? t("chk.dashLocked")
                : chkStatus.total > 0
                  ? `${chkStatus.n}/${chkStatus.total} ${t("chk.dashChecked")}`
                  : t("chk.dashStart")}
            </div>
          </div>
          <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-cyan-400 shrink-0">
            {t("chk.dashCta")} <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </button>
      )}

      {trades.length === 0 ? (
        /* ── Empty state: first-run experience ── */
        <div className="glass rounded-3xl p-8 md:p-14 text-center card-premium animate-fade-in-up stagger-1 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
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
          <button
            onClick={onAddTrade}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" /> {t("empty.cta")}
          </button>
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
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
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
          <div className="relative glass rounded-3xl p-4 md:p-6 card-premium animate-fade-in-up stagger-1 overflow-hidden mb-4 md:mb-6">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
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
                        gain ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400",
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
                      "px-2.5 md:px-3.5 py-1.5 rounded-lg text-[11px] md:text-xs font-bold uppercase transition-all",
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
              <div className="h-56 md:h-80 chart-organic chart-draw">
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
                    insight.longShare !== null ? `${Math.round(insight.longShare * 100)}% L` : "—"
                  }
                  sub={`${insight.longs}L · ${insight.shorts}S`}
                />
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
            <StatsCard
              title={t("stats.winRate")}
              value={formatPct(stats.winRate)}
              subtitle={`${stats.wins}W / ${stats.losses}L${stats.breakEven > 0 ? ` / ${stats.breakEven}BE` : ""}`}
              icon={<Target className="w-4 h-4" />}
              trend={stats.winRate >= 0.5 ? "up" : "down"}
              delay={0}
            />
            <StatsCard
              title={t("dashboard.profitFactor")}
              value={stats.profitFactor >= 99 ? "99+" : stats.profitFactor.toFixed(2)}
              subtitle={`${t("dashboard.avgRR")} ${stats.avgRR.toFixed(2)}`}
              icon={<Activity className="w-4 h-4" />}
              trend={stats.profitFactor >= 1.5 ? "up" : stats.profitFactor < 1 ? "down" : "neutral"}
              delay={60}
            />
            <StatsCard
              title={t("quant.expectancy")}
              value={formatPnl(quant.expectancy)}
              subtitle={`${quant.expectancyR >= 0 ? "+" : ""}${quant.expectancyR.toFixed(2)}R / trade`}
              icon={
                stats.totalPnl >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )
              }
              trend={quant.expectancy >= 0 ? "up" : "down"}
              delay={120}
            />
            <StatsCard
              title={t("dashboard.maxDrawdown")}
              value={formatPnl(-stats.maxDrawdown)}
              subtitle={
                quant.maxDrawdownPct !== null
                  ? `${(quant.maxDrawdownPct * 100).toFixed(1)}% · ${t("dashboard.peakToTrough")}`
                  : t("dashboard.peakToTrough")
              }
              icon={<BarChart3 className="w-4 h-4" />}
              trend="down"
              delay={180}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {/* Recent Trades */}
            <div className="col-span-1 md:col-span-2 glass rounded-2xl overflow-hidden card-premium animate-fade-in-up stagger-4">
              <div className="px-4 md:px-5 py-3 md:py-4 border-b border-white/[0.06]">
                <h3 className="text-sm font-semibold text-white">{t("dashboard.recentTrades")}</h3>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {recentTrades.length === 0 ? (
                  <div className="px-4 py-10 text-center text-slate-600 text-sm">
                    {t("dashboard.noTradesInPeriod")}
                  </div>
                ) : (
                  recentTrades.map((trade) => {
                    const be = isBreakEven(trade);
                    return (
                      <div
                        key={trade.id}
                        className="px-4 md:px-5 py-3 trade-card flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
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
                                "text-[9px] font-bold px-1.5 py-0.5 rounded",
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
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="glass rounded-2xl p-4 md:p-5 card-premium animate-fade-in-up stagger-5 space-y-2 md:space-y-3 self-start">
              <h3 className="text-sm font-semibold text-white">{t("stats.performance")}</h3>
              {[
                {
                  label: t("dashboard.avgWin"),
                  value: formatPnl(stats.avgWin),
                  color: "text-emerald-400",
                  dot: "bg-emerald-400",
                },
                {
                  label: t("dashboard.avgLoss"),
                  value: formatPnl(stats.avgLoss),
                  color: "text-red-400",
                  dot: "bg-red-400",
                },
                {
                  label: t("dashboard.bestTrade"),
                  value: stats.bestTrade ? formatPnl(stats.bestTrade.pnl) : "$0.00",
                  color: "text-emerald-400",
                  dot: "bg-emerald-400",
                },
                {
                  label: t("dashboard.worstTrade"),
                  value: stats.worstTrade ? formatPnl(stats.worstTrade.pnl) : "$0.00",
                  color: "text-red-400",
                  dot: "bg-red-400",
                },
                {
                  label: t("quant.planAdherence"),
                  value: formatPct(quant.planAdherence),
                  color: quant.planAdherence >= 0.8 ? "text-emerald-400" : "text-amber-400",
                  dot: quant.planAdherence >= 0.8 ? "bg-emerald-400" : "bg-amber-400",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between py-1.5 md:py-2 border-b border-white/[0.04]"
                >
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    <span className={cn("w-1.5 h-1.5 rounded-full", item.dot)} />
                    {item.label}
                  </span>
                  <span className={cn("text-xs md:text-sm font-bold tabular-nums", item.color)}>
                    {item.value}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between py-1.5 md:py-2">
                <span className="text-xs text-slate-500">{t("dashboard.currentStreak")}</span>
                <span
                  className={cn(
                    "text-xs md:text-sm font-bold",
                    stats.currentStreakType === "win"
                      ? "text-emerald-400"
                      : stats.currentStreakType === "loss"
                        ? "text-red-400"
                        : stats.currentStreakType === "be"
                          ? "text-slate-300"
                          : "text-slate-400",
                  )}
                >
                  {stats.currentStreak}
                  {stats.currentStreakType === "win"
                    ? "W"
                    : stats.currentStreakType === "loss"
                      ? "L"
                      : stats.currentStreakType === "be"
                        ? "BE"
                        : ""}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
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
      <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1 truncate">
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
