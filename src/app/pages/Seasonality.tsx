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
  CartesianGrid,
} from "recharts";
import {
  CalendarRange,
  TrendingUp,
  TrendingDown,
  Clock,
  CalendarDays,
  Info,
  Sparkles,
  Layers,
} from "lucide-react";
import { Trade } from "../types";
import { formatPnl } from "../utils/tradeCalcs";
import { MIN_BUCKET_SAMPLE } from "../utils/quantStats";
import {
  AXIS_TICK,
  BAR_FILL_GREEN,
  BAR_FILL_RED,
  BAR_RADIUS,
  CHART_GREEN,
  CHART_RED,
  CHART_ANIMATION,
  EQUITY_GRID,
  moneyAxisProps,
  tooltipStyle,
} from "../utils/chartTheme";
import {
  ASSET_SEASONALITY,
  CATEGORY_LABELS,
  MONTHS_SHORT,
  computeSeasonalStats,
  type AssetCategory,
  type SeasonalAsset,
} from "../utils/assetSeasonality";
import { useT } from "../i18n/LanguageContext";
import { Skeleton } from "../components/Skeleton";
import { usePersistedValue, nsKey, writeJSON } from "../utils/persistence";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../utils/cn";
import { PageContainer, Card } from "@/shared/ui";

interface SeasonalityProps {
  trades: Trade[];
  tradesLoading?: boolean;
}

export default function Seasonality(_props: SeasonalityProps) {
  return (
    <PageContainer>
      <AssetSeasonality />
    </PageContainer>
  );
}

/* ============================================================
 * Asset seasonal tendencies (curated historical dataset)
 * ============================================================ */

function AssetSeasonality() {
  const { t, lang } = useT();
  const { user } = useAuth();
  const catKey = nsKey(user?.id, "seasonality.cat");
  const symKey = nsKey(user?.id, "seasonality.sym");
  const savedCat = usePersistedValue<AssetCategory>(catKey, "indices");
  const category: AssetCategory = (Object.keys(CATEGORY_LABELS) as AssetCategory[]).includes(
    savedCat,
  )
    ? savedCat
    : "indices";
  const inCategory = useMemo(
    () => ASSET_SEASONALITY.filter((a) => a.category === category),
    [category],
  );

  const savedSym = usePersistedValue<string>(symKey, "");
  const asset: SeasonalAsset = inCategory.find((a) => a.symbol === savedSym) ?? inCategory[0];

  const currentMonth = new Date().getMonth();
  const monthLabel = (m: number) =>
    new Date(2026, m, 1).toLocaleDateString(lang, { month: "long" });

  const chartData = useMemo(
    () =>
      asset.monthlyAvg.map((avg, i) => ({
        month: MONTHS_SHORT[i],
        avg,
        win: asset.monthlyWin[i],
        current: i === currentMonth,
      })),
    [asset, currentMonth],
  );

  const stats = useMemo(() => computeSeasonalStats(asset, currentMonth), [asset, currentMonth]);

  const setCategory = (c: AssetCategory) => {
    writeJSON(catKey, c);
    writeJSON(symKey, "");
  };
  const setSymbol = (s: string) => writeJSON(symKey, s);

  return (
    <div className="animate-fade-in">
      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {(Object.keys(CATEGORY_LABELS) as AssetCategory[]).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              "h-8 px-3 rounded-lg border text-[11px] font-semibold transition",
              category === c
                ? "bg-cyan-500/15 border-cyan-500/25 text-cyan-300"
                : "bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-white/[0.12]",
            )}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {/* Asset selector */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {inCategory.map((a) => (
          <button
            key={a.symbol}
            onClick={() => setSymbol(a.symbol)}
            className={cn(
              "h-9 px-3.5 rounded-xl border text-xs font-bold transition",
              a.symbol === asset.symbol
                ? "bg-white/[0.06] border-cyan-500/30 text-white shadow-sm"
                : "bg-white/[0.02] border-white/[0.06] text-slate-500 hover:text-slate-300",
            )}
          >
            {a.symbol}{" "}
            <span className="hidden sm:inline text-slate-500 font-medium">· {a.name}</span>
          </button>
        ))}
      </div>

      {/* Highlight cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <HighlightCard
          icon={<Sparkles className="w-4 h-4" />}
          label={t("seasonality.thisMonth")}
          value={monthLabel(currentMonth)}
          sub={`${stats.currentMonthAvg >= 0 ? "+" : ""}${stats.currentMonthAvg.toFixed(1)}% · ${stats.currentMonthWin}% ${t("seasonality.win")}`}
          positive={stats.currentMonthAvg >= 0}
        />
        <HighlightCard
          icon={<TrendingUp className="w-4 h-4" />}
          label={t("seasonality.bestMonth")}
          value={monthLabel(stats.bestMonth.month)}
          sub={`+${stats.bestMonth.avg.toFixed(1)}%`}
          positive
        />
        <HighlightCard
          icon={<TrendingDown className="w-4 h-4" />}
          label={t("seasonality.worstMonth")}
          value={monthLabel(stats.worstMonth.month)}
          sub={`${stats.worstMonth.avg.toFixed(1)}%`}
          positive={false}
        />
        <HighlightCard
          icon={<CalendarRange className="w-4 h-4" />}
          label={t("seasonality.annualBias")}
          value={`${stats.annualAvg >= 0 ? "+" : ""}${stats.annualAvg.toFixed(1)}%`}
          sub={`${asset.years} ${t("seasonality.years")}`}
          positive={stats.annualAvg >= 0}
        />
      </div>

      {/* Monthly avg return chart */}
      <div className="glass rounded-3xl p-4 md:p-5 card-premium mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white mb-0.5">
              {asset.name} — {t("seasonality.monthlyBias")}
            </h3>
            <p className="text-[10px] text-slate-500">{t("seasonality.monthlyBiasSub")}</p>
          </div>
          <span className="tv-figure text-[10px] text-slate-500 shrink-0">
            {asset.years} {t("seasonality.years")}
          </span>
        </div>
        <div className="h-60 md:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <CartesianGrid {...EQUITY_GRID} />
              <XAxis
                dataKey="month"
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={40}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                {...tooltipStyle}
                formatter={
                  ((value: unknown, _n: unknown, item: unknown) => {
                    const win = (item as { payload?: { win?: number } })?.payload?.win;
                    return [
                      `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(1)}%  ·  ${win}% ${t("seasonality.win")}`,
                      t("seasonality.avgReturn"),
                    ];
                  }) as never
                }
              />
              <ReferenceLine y={0} stroke="rgba(148,163,184,0.25)" />
              <Bar dataKey="avg" radius={BAR_RADIUS} {...CHART_ANIMATION}>
                {chartData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.avg >= 0 ? BAR_FILL_GREEN : BAR_FILL_RED}
                    stroke={d.current ? "var(--tv-highlight)" : "transparent"}
                    strokeWidth={d.current ? 1.5 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Win-rate strip */}
        <div className="mt-3 pt-3 border-t border-white/[0.05] grid grid-cols-12 gap-1">
          {chartData.map((d, i) => (
            <div key={i} className="text-center">
              <div className="text-[11px] text-slate-600 font-semibold">{d.month.slice(0, 1)}</div>
              <div
                className={cn(
                  "tv-figure text-[11px]",
                  d.win >= 60
                    ? "text-emerald-400"
                    : d.win >= 50
                      ? "text-slate-300"
                      : "text-red-400/80",
                )}
              >
                {d.win}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Category heatmap */}
      <div className="glass rounded-3xl p-4 md:p-5 card-premium">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-cyan-400/70" />
          <div>
            <h3 className="text-sm font-semibold text-white">
              {CATEGORY_LABELS[category]} — {t("seasonality.heatmapAll")}
            </h3>
            <p className="text-[10px] text-slate-500">{t("seasonality.heatmapAllSub")}</p>
          </div>
        </div>
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="min-w-[620px]">
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: "5rem repeat(12, minmax(0,1fr))" }}
            >
              <div />
              {MONTHS_SHORT.map((m, i) => (
                <div
                  key={m}
                  className={cn(
                    "tv-label text-center pb-1",
                    i === currentMonth ? "text-cyan-300" : "text-slate-500",
                  )}
                >
                  {m}
                </div>
              ))}
              {inCategory.map((a) => (
                <AssetHeatRow
                  key={a.symbol}
                  asset={a}
                  currentMonth={currentMonth}
                  selected={a.symbol === asset.symbol}
                  onSelect={() => setSymbol(a.symbol)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer — moved to the bottom, out of the way of the data. */}
      <Card className="px-4 py-3 mt-4 flex items-start gap-2.5 border border-cyan-500/10">
        <Info className="w-4 h-4 text-cyan-400/80 shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed text-slate-400">
          {t("seasonality.assetDisclaimer")}
        </p>
      </Card>
    </div>
  );
}

function AssetHeatRow({
  asset,
  currentMonth,
  selected,
  onSelect,
}: {
  asset: SeasonalAsset;
  currentMonth: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const max = Math.max(...asset.monthlyAvg.map(Math.abs), 0.1);
  return (
    <>
      <button
        onClick={onSelect}
        className={cn(
          "tv-figure flex items-center text-[10px] truncate pr-1 transition-colors",
          selected ? "text-cyan-300" : "text-slate-400 hover:text-white",
        )}
      >
        {asset.symbol}
      </button>
      {asset.monthlyAvg.map((v, i) => {
        const intensity = Math.min(Math.abs(v) / max, 1);
        const bg =
          v >= 0
            ? `rgb(var(--tv-accent-rgb) / ${0.1 + intensity * 0.6})`
            : `rgba(239,68,68, ${0.1 + intensity * 0.55})`;
        return (
          <div
            key={i}
            title={`${asset.symbol} ${MONTHS_SHORT[i]}: ${v >= 0 ? "+" : ""}${v.toFixed(1)}%`}
            className={cn(
              "tv-figure h-8 rounded-md flex items-center justify-center text-[11px] cursor-default transition-transform hover:scale-[1.08]",
              i === currentMonth && "ring-1 ring-cyan-400/50",
            )}
            style={{ background: bg, color: "#f1f5f9" }}
          >
            {v >= 0 ? "+" : ""}
            {v.toFixed(1)}
          </div>
        );
      })}
    </>
  );
}

/* ============================================================
 * Personal seasonality — patterns from the user's own journal
 * ============================================================ */

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

function JournalSeasonality({ trades, tradesLoading }: SeasonalityProps) {
  const { t, lang } = useT();

  const monthLabel = (m: number) =>
    new Date(2026, m, 1).toLocaleDateString(lang, { month: "short" });
  const weekdayLabel = (dow: number) =>
    new Date(2026, 1, 2 + dow).toLocaleDateString(lang, { weekday: "short" });

  const data = useMemo(() => {
    const byMonth = Array.from({ length: 12 }, () => ({ pnl: 0, count: 0, wins: 0 }));
    const byYearMonth = new Map<number, number[]>();
    const byDow = Array.from({ length: 7 }, () => ({ pnl: 0, count: 0 }));
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

    // COURONNER un bucket est une INFÉRENCE, pas une lecture.
    //
    // Le P&L d'une heure est vrai quel que soit le nombre de trades — une somme
    // ne ment pas. Mais déclarer cette heure « ta meilleure » sur UN trade est
    // exactement le sur-apprentissage corrigé sur Analytics, en plus insidieux :
    // ici le chiffre est irréprochable, c'est le classement qui ne veut rien
    // dire. Un trader qui réorganise sa journée là-dessus optimise du bruit.
    //
    // On exige donc le même plancher d'échantillon que partout ailleurs avant
    // de désigner un vainqueur. Aucun bucket qualifié → aucun superlatif : ne
    // rien dire vaut mieux que couronner au hasard.
    const traded = monthly.filter((m) => m.count >= MIN_BUCKET_SAMPLE);
    const best = traded.length ? traded.reduce((a, b) => (b.pnl > a.pnl ? b : a)) : null;
    const worst = traded.length ? traded.reduce((a, b) => (b.pnl < a.pnl ? b : a)) : null;
    const tradedDays = weekdays.filter((d) => d.count >= MIN_BUCKET_SAMPLE);
    const bestDay = tradedDays.length ? tradedDays.reduce((a, b) => (b.pnl > a.pnl ? b : a)) : null;
    const qualifiedHours = hours.filter((h) => h.count >= MIN_BUCKET_SAMPLE);
    const bestHour = qualifiedHours.length
      ? qualifiedHours.reduce((a, b) => (b.pnl > a.pnl ? b : a))
      : null;

    return { monthly, years, heatMax, weekdays, hours, best, worst, bestDay, bestHour };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, lang]);

  if (tradesLoading) {
    return (
      <div className="animate-fade-in" aria-busy="true">
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
      <div className="glass rounded-3xl p-14 text-center animate-fade-in">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-5">
          <CalendarRange className="w-7 h-7 text-cyan-400" />
        </div>
        <h3 className="text-sm font-bold text-white mb-1.5">{t("seasonality.empty")}</h3>
        <p className="text-sm text-slate-500 max-w-sm mx-auto">{t("seasonality.emptySub")}</p>
      </div>
    );
  }

  const { monthly, years, heatMax, weekdays, hours, best, worst, bestDay, bestHour } = data;

  return (
    <div className="animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
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

      <div className="glass rounded-3xl p-4 md:p-5 card-premium mb-5">
        <h3 className="text-sm font-semibold text-white mb-0.5">{t("seasonality.monthly")}</h3>
        <p className="text-[10px] text-slate-500 mb-4">{t("seasonality.monthlySub")}</p>
        <div className="h-56 md:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <CartesianGrid {...EQUITY_GRID} />
              <XAxis
                dataKey="month"
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <YAxis {...moneyAxisProps(monthly.map((d) => d.pnl))} />
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
              <Bar dataKey="pnl" radius={BAR_RADIUS} {...CHART_ANIMATION}>
                {monthly.map((m, i) => (
                  <Cell
                    key={i}
                    /* Le vert de la DONNÉE, pas l'accent du thème : un mois
                       gagnant est vert sur Amber comme sur Steel. */
                    fill={
                      m.count === 0
                        ? "rgba(100,116,139,0.15)"
                        : m.pnl >= 0
                          ? BAR_FILL_GREEN
                          : BAR_FILL_RED
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass rounded-3xl p-4 md:p-5 card-premium mb-5">
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
                <div key={m.key} className="tv-label text-center text-slate-500 pb-1">
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
        <div className="glass rounded-3xl p-4 md:p-5 card-premium">
          <h3 className="text-sm font-semibold text-white mb-0.5">{t("seasonality.weekday")}</h3>
          <p className="text-[10px] text-slate-500 mb-4">{t("seasonality.weekdaySub")}</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekdays} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <CartesianGrid {...EQUITY_GRID} />
                <XAxis dataKey="day" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis {...moneyAxisProps(weekdays.map((d) => d.pnl))} />
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
                <Bar dataKey="pnl" radius={BAR_RADIUS} {...CHART_ANIMATION}>
                  {weekdays.map((d, i) => (
                    <Cell key={i} fill={d.pnl >= 0 ? BAR_FILL_GREEN : BAR_FILL_RED} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-3xl p-4 md:p-5 card-premium">
          <h3 className="text-sm font-semibold text-white mb-0.5">{t("seasonality.hourly")}</h3>
          <p className="text-[10px] text-slate-500 mb-4">{t("seasonality.hourlySub")}</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hours} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <CartesianGrid {...EQUITY_GRID} />
                <XAxis dataKey="hour" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis {...moneyAxisProps(hours.map((d) => d.pnl))} />
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
                <Bar dataKey="pnl" radius={BAR_RADIUS} {...CHART_ANIMATION}>
                  {hours.map((h, i) => (
                    <Cell key={i} fill={h.pnl >= 0 ? BAR_FILL_GREEN : BAR_FILL_RED} />
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
      <div className="tv-figure flex items-center text-[10px] text-slate-400">{year}</div>
      {values.map((v, i) => {
        const intensity = Math.min(Math.abs(v) / heatMax, 1);
        const bg =
          v === 0
            ? "rgba(100,116,139,0.08)"
            : v > 0
              ? `rgb(var(--tv-accent-rgb) / ${0.12 + intensity * 0.55})`
              : `rgba(239,68,68, ${0.12 + intensity * 0.5})`;
        return (
          <div
            key={i}
            title={v === 0 ? "—" : `$${v.toFixed(2)}`}
            className="tv-figure h-9 rounded-lg flex items-center justify-center text-[11px] transition-transform hover:scale-[1.06] cursor-default"
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
    <Card hover className="p-3.5 md:p-4 min-w-0">
      <div className="tv-label flex items-center gap-1.5 text-slate-500 mb-2 truncate">
        <span className={positive ? "text-emerald-400" : "text-red-400"}>{icon}</span>
        {label}
      </div>
      <div className="text-sm font-bold text-white font-display truncate">{value}</div>
      {sub && (
        <div
          className={cn(
            "tv-figure text-[11px] mt-0.5",
            positive ? "text-emerald-400" : "text-red-400",
          )}
        >
          {sub}
        </div>
      )}
    </Card>
  );
}
