import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { CalendarRange, TrendingUp, TrendingDown, Clock, CalendarDays } from "lucide-react";
import { Trade } from "../types";
import { formatPnl } from "../utils/tradeCalcs";
import { CHART_ANIMATION, tooltipStyle } from "../utils/chartTheme";
import { useT } from "../i18n/LanguageContext";
import { Skeleton } from "../components/Skeleton";
import { cn } from "../utils/cn";

interface SeasonalityProps {
  trades: Trade[];
  tradesLoading?: boolean;
}

const MONTH_KEYS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export default function Seasonality({ trades, tradesLoading }: SeasonalityProps) {
  const { t, lang } = useT();

  const monthLabel = (m: number) =>
    new Date(2026, m, 1).toLocaleDateString(lang, { month: "short" });
  const weekdayLabel = (dow: number) =>
    new Date(2026, 1, 2 + dow).toLocaleDateString(lang, { weekday: "short" }); // 2026-02-02 is a Monday

  const data = useMemo(() => {
    // Monthly aggregate (all years) -------------------------------------------------
    const byMonth = Array.from({ length: 12 }, () => ({ pnl: 0, count: 0, wins: 0 }));
    // Year × month heatmap ----------------------------------------------------------
    const byYearMonth = new Map<number, number[]>();
    // Weekday -----------------------------------------------------------------------
    const byDow = Array.from({ length: 7 }, () => ({ pnl: 0, count: 0 }));
    // Entry hour ---------------------------------------------------------------------
    const byHour = new Map<number, { pnl: number; count: number }>();

    for (const tr of trades) {
      const d = new Date(tr.date + "T00:00:00");
      if (Number.isNaN(d.getTime())) continue;
      const m = d.getMonth();
      const y = d.getFullYear();
      byMonth[m].pnl += tr.pnl;
      byMonth[m].count += 1;
      if (tr.direction !== "be" && tr.pnl > 0) byMonth[m].wins += 1;

      if (!byYearMonth.has(y))
        byYearMonth.set(
          y,
          Array.from({ length: 12 }, () => 0),
        );
      byYearMonth.get(y)![m] += tr.pnl;

      byDow[d.getDay()].pnl += tr.pnl;
      byDow[d.getDay()].count += 1;

      const h = parseInt(tr.entryTime?.split(":")[0] ?? "", 10);
      if (!Number.isNaN(h) && h >= 0 && h <= 23) {
        const cur = byHour.get(h) ?? { pnl: 0, count: 0 };
        cur.pnl += tr.pnl;
        cur.count += 1;
        byHour.set(h, cur);
      }
    }

    const monthly = byMonth.map((m, i) => ({
      month: monthLabel(i),
      key: MONTH_KEYS[i],
      pnl: Math.round(m.pnl * 100) / 100,
      count: m.count,
    }));
    const years = [...byYearMonth.entries()].sort((a, b) => b[0] - a[0]);
    const heatMax = Math.max(1, ...years.flatMap(([, arr]) => arr.map(Math.abs)));

    // Mon→Fri first, then weekend if traded
    const dowOrder = [1, 2, 3, 4, 5, 6, 0].filter((d) => byDow[d].count > 0 || (d >= 1 && d <= 5));
    const weekdays = dowOrder.map((d) => ({
      day: weekdayLabel(d),
      pnl: Math.round(byDow[d].pnl * 100) / 100,
      count: byDow[d].count,
    }));

    const hours = [...byHour.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([h, v]) => ({
        hour: `${String(h).padStart(2, "0")}h`,
        pnl: Math.round(v.pnl * 100) / 100,
        count: v.count,
      }));

    const traded = monthly.filter((m) => m.count > 0);
    const best = traded.length ? traded.reduce((a, b) => (b.pnl > a.pnl ? b : a)) : null;
    const worst = traded.length ? traded.reduce((a, b) => (b.pnl < a.pnl ? b : a)) : null;
    const tradedDays = weekdays.filter((d) => d.count > 0);
    const bestDay = tradedDays.length ? tradedDays.reduce((a, b) => (b.pnl > a.pnl ? b : a)) : null;
    const bestHour = hours.length ? hours.reduce((a, b) => (b.pnl > a.pnl ? b : a)) : null;

    return { monthly, years, heatMax, weekdays, hours, best, worst, bestDay, bestHour };
    // monthLabel/weekdayLabel depend only on lang
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, lang]);

  if (tradesLoading) {
    return (
      <div className="p-4 md:p-8 max-w-[1400px] mx-auto" aria-busy="true">
        <div className="mb-6 space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-3xl mb-5" />
        <div className="grid md:grid-cols-2 gap-5">
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (trades.length < 5) {
    return (
      <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
        <div className="mb-6 animate-fade-in-up">
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            {t("seasonality.title")}
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">{t("seasonality.subtitle")}</p>
        </div>
        <div className="glass rounded-3xl p-14 text-center animate-fade-in-up stagger-1">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-5">
            <CalendarRange className="w-7 h-7 text-cyan-400" />
          </div>
          <h3 className="text-base font-bold text-white mb-1.5">{t("seasonality.empty")}</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">{t("seasonality.emptySub")}</p>
        </div>
      </div>
    );
  }

  const { monthly, years, heatMax, weekdays, hours, best, worst, bestDay, bestHour } = data;

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <div className="mb-4 md:mb-6 animate-fade-in-up stagger-0">
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          {t("seasonality.title")}
        </h1>
        <p className="text-xs md:text-sm text-slate-500 mt-1">{t("seasonality.subtitle")}</p>
      </div>

      {/* Highlight cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5 animate-fade-in-up stagger-1">
        <HighlightCard
          icon={<TrendingUp className="w-4 h-4" />}
          label={t("seasonality.bestMonth")}
          value={best ? best.month : "—"}
          sub={best ? formatPnl(best.pnl) : ""}
          positive
        />
        <HighlightCard
          icon={<TrendingDown className="w-4 h-4" />}
          label={t("seasonality.worstMonth")}
          value={worst ? worst.month : "—"}
          sub={worst ? formatPnl(worst.pnl) : ""}
          positive={false}
        />
        <HighlightCard
          icon={<CalendarDays className="w-4 h-4" />}
          label={t("seasonality.bestDay")}
          value={bestDay ? bestDay.day : "—"}
          sub={bestDay ? formatPnl(bestDay.pnl) : ""}
          positive={!!bestDay && bestDay.pnl >= 0}
        />
        <HighlightCard
          icon={<Clock className="w-4 h-4" />}
          label={t("seasonality.bestHour")}
          value={bestHour ? bestHour.hour : "—"}
          sub={bestHour ? formatPnl(bestHour.pnl) : ""}
          positive={!!bestHour && bestHour.pnl >= 0}
        />
      </div>

      {/* Monthly aggregate */}
      <div className="glass rounded-3xl p-4 md:p-6 card-premium mb-5 animate-fade-in-up stagger-2">
        <h3 className="text-sm font-semibold text-white mb-0.5">{t("seasonality.monthly")}</h3>
        <p className="text-[10px] text-slate-500 mb-4">{t("seasonality.monthlySub")}</p>
        <div className="h-56 md:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <XAxis
                dataKey="month"
                tick={{ fill: "#64748b", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={52}
                tickFormatter={(v: number) => `$${v}`}
              />
              <Tooltip
                {...tooltipStyle}
                formatter={
                  ((value: unknown) => [
                    `$${Number(value).toFixed(2)}`,
                    t("journal.colPnl" as never),
                  ]) as never
                }
              />
              <ReferenceLine y={0} stroke="rgba(148,163,184,0.25)" />
              <Bar dataKey="pnl" radius={[6, 6, 0, 0]} {...CHART_ANIMATION}>
                {monthly.map((m, i) => (
                  <Cell
                    key={i}
                    fill={
                      m.count === 0
                        ? "rgba(100,116,139,0.15)"
                        : m.pnl >= 0
                          ? "var(--tv-accent)"
                          : "#ef4444"
                    }
                    fillOpacity={m.count === 0 ? 1 : 0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Year × month heatmap */}
      <div className="glass rounded-3xl p-4 md:p-6 card-premium mb-5 animate-fade-in-up stagger-3">
        <h3 className="text-sm font-semibold text-white mb-0.5">{t("seasonality.heatmap")}</h3>
        <p className="text-[10px] text-slate-500 mb-4">{t("seasonality.heatmapSub")}</p>
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="min-w-[560px]">
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: "3.2rem repeat(12, minmax(0,1fr))" }}
            >
              <div />
              {monthly.map((m) => (
                <div
                  key={m.key}
                  className="text-center text-[9px] font-bold uppercase tracking-wide text-slate-500 pb-1"
                >
                  {m.month}
                </div>
              ))}
              {years.map(([year, arr]) => (
                <YearRow key={year} year={year} values={arr} heatMax={heatMax} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Weekday */}
        <div className="glass rounded-3xl p-4 md:p-6 card-premium animate-fade-in-up stagger-4">
          <h3 className="text-sm font-semibold text-white mb-0.5">{t("seasonality.weekday")}</h3>
          <p className="text-[10px] text-slate-500 mb-4">{t("seasonality.weekdaySub")}</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekdays} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <XAxis
                  dataKey="day"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={
                    ((value: unknown) => [
                      `$${Number(value).toFixed(2)}`,
                      t("journal.colPnl" as never),
                    ]) as never
                  }
                />
                <ReferenceLine y={0} stroke="rgba(148,163,184,0.25)" />
                <Bar dataKey="pnl" radius={[6, 6, 0, 0]} {...CHART_ANIMATION}>
                  {weekdays.map((d, i) => (
                    <Cell
                      key={i}
                      fill={d.pnl >= 0 ? "var(--tv-accent-2)" : "#ef4444"}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hour of day */}
        <div className="glass rounded-3xl p-4 md:p-6 card-premium animate-fade-in-up stagger-5">
          <h3 className="text-sm font-semibold text-white mb-0.5">{t("seasonality.hourly")}</h3>
          <p className="text-[10px] text-slate-500 mb-4">{t("seasonality.hourlySub")}</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hours} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <XAxis
                  dataKey="hour"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={
                    ((value: unknown) => [
                      `$${Number(value).toFixed(2)}`,
                      t("journal.colPnl" as never),
                    ]) as never
                  }
                />
                <ReferenceLine y={0} stroke="rgba(148,163,184,0.25)" />
                <Bar dataKey="pnl" radius={[6, 6, 0, 0]} {...CHART_ANIMATION}>
                  {hours.map((h, i) => (
                    <Cell
                      key={i}
                      fill={h.pnl >= 0 ? "var(--tv-highlight)" : "#ef4444"}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function YearRow({ year, values, heatMax }: { year: number; values: number[]; heatMax: number }) {
  return (
    <>
      <div className="flex items-center text-[10px] font-bold text-slate-400 tabular-nums">
        {year}
      </div>
      {values.map((v, i) => {
        const intensity = Math.min(Math.abs(v) / heatMax, 1);
        const bg =
          v === 0
            ? "rgba(100,116,139,0.08)"
            : v > 0
              ? `rgba(var(--tv-accent-rgb), ${0.12 + intensity * 0.55})`
              : `rgba(239,68,68, ${0.12 + intensity * 0.5})`;
        return (
          <div
            key={i}
            title={v === 0 ? "—" : `$${v.toFixed(2)}`}
            className="h-9 rounded-lg flex items-center justify-center text-[9px] font-bold tabular-nums transition-transform hover:scale-[1.06] cursor-default"
            style={{ background: bg, color: v === 0 ? "#475569" : "#f1f5f9" }}
          >
            {v === 0 ? "" : `${v > 0 ? "+" : ""}${Math.round(v)}`}
          </div>
        );
      })}
    </>
  );
}

function HighlightCard({
  icon,
  label,
  value,
  sub,
  positive,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  positive: boolean;
}) {
  return (
    <div className="glass rounded-2xl p-3.5 md:p-4 card-premium min-w-0">
      <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2 truncate">
        <span className={positive ? "text-emerald-400" : "text-red-400"}>{icon}</span>
        {label}
      </div>
      <div className="text-lg md:text-xl font-bold text-white font-display truncate">{value}</div>
      {sub && (
        <div
          className={cn(
            "text-[11px] font-bold tabular-nums mt-0.5",
            positive ? "text-emerald-400" : "text-red-400",
          )}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
