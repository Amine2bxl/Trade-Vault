import { useEffect, useMemo, useReducer, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Trade } from "@/app/types";
import { computeStats, formatPct } from "@/domain/tradeCalcs";
import { computeQuantStats, MIN_BUCKET_SAMPLE } from "@/domain/quantStats";
import { analyticsInsights, type InsightBucket } from "@/domain/analyticsInsights";
import { loadStartingBalance } from "@/app/store";
import { useAuth } from "@/app/contexts/AuthContext";
import { useAccounts } from "@/app/contexts/AccountContext";
import { nsKey, usePersistedValue, writeJSON } from "@/app/utils/persistence";
import { cn } from "@/shared/ui/cn";
import {
  EmptyState,
  FilterControls,
  FilterSection,
  Kpi,
  MultiPicker,
  PageContainer,
  RangePicker,
  ScrollArea,
  rangeBounds,
  type RangeValue,
} from "@/shared/ui";
import { numericText } from "@/shared/ui/NumericText";
import { AXIS_TICK, CHART_GREEN, CHART_RED, tooltipStyle } from "@/app/trading/chartTheme";
import { useT } from "@/app/i18n/LanguageContext";
import { useAvailableHeight } from "@/app/hooks/useAvailableHeight";
import { usePageActions } from "@/app/contexts/PageActionsContext";
import { useLiveTable } from "@/app/hooks/useLiveTable";
import { formatMoney } from "@/shared/currency";
import { EquityPanel, NextTradesPanel } from "./AnalyticsPanels";

/**
 * LES ANALYSES — une page, des réponses.
 *
 * Plus d'onglets Vue d'ensemble / Exécution / Timing, plus de Sharpe, de
 * Sortino ni de Kelly, plus d'intervalles ni de courbes de dépassement : le
 * trader lit des résultats, pas une méthode. Trois sections :
 *
 *   • Résultats — six chiffres, la courbe et son drawdown, Gagnés/Perdus ;
 *   • Ce qui marche — meilleur et pire setup, marché, jour, heure ; les mois ;
 *   • La suite — tes 100 prochains trades, et ta régularité.
 *
 * La page ne CALCULE rien : chaque chiffre sort d'un moteur pur et testé —
 * `computeStats`, `computeQuantStats`, `analyticsInsights`, `journalOutlook`
 * — le même code que le serveur et Jarvis utilisent. Chaque chiffre porte son
 * `n` ; sous l'échantillon minimum, « — ».
 */

interface AnalyticsProps {
  trades: Trade[];
}

type AnalyticsPeriod = "all" | "7d" | "30d" | "90d" | "1y";
const PERIOD_DAYS: Record<AnalyticsPeriod, number | null> = {
  all: null,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};
const ALL_PERIOD: RangeValue<AnalyticsPeriod> = { kind: "preset", preset: "all" };
const NO_DAYS: string[] = [];

const weekdayOf = (date: string) => new Date(`${date}T12:00:00`).getDay();

export default function Analytics({ trades }: AnalyticsProps) {
  const { boxRef, height } = useAvailableHeight();
  const { t, lang } = useT();
  const { user } = useAuth();
  const { activeId } = useAccounts();

  /* Filtres MÉMORISÉS : période et jours de la semaine, en amont de tout. */
  const periodKey = nsKey(user?.id, "analytics.period");
  const daysKey = nsKey(user?.id, "analytics.days");
  const period = usePersistedValue<RangeValue<AnalyticsPeriod>>(periodKey, ALL_PERIOD);
  const setPeriod = (v: RangeValue<AnalyticsPeriod>) => writeJSON(periodKey, v);
  const days = usePersistedValue<string[]>(daysKey, NO_DAYS);
  const setDays = (v: string[]) => writeJSON(daysKey, v);

  const inPeriod = useMemo(() => {
    const bounds = rangeBounds(period, PERIOD_DAYS);
    return bounds ? trades.filter((x) => x.date >= bounds.from && x.date <= bounds.to) : trades;
  }, [trades, period]);
  const scoped = useMemo(
    () =>
      days.length === 0
        ? inPeriod
        : inPeriod.filter((x) => days.includes(String(weekdayOf(x.date)))),
    [inPeriod, days],
  );

  const [startingBalance, setStartingBalance] = useState(0);
  const [liveRev, bumpLive] = useReducer((n: number) => n + 1, 0);
  useLiveTable("profiles", bumpLive);
  useLiveTable("accounts", bumpLive);
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    loadStartingBalance(user.id)
      .then((b) => active && setStartingBalance(b))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.id, activeId, liveRev]);

  /* ── Les moteurs ── */
  const stats = useMemo(() => computeStats(scoped), [scoped]);
  const quant = useMemo(
    () => computeQuantStats(scoped, startingBalance),
    [scoped, startingBalance],
  );
  const insights = useMemo(() => analyticsInsights(scoped), [scoped]);
  const balance = Math.max(0, startingBalance + stats.totalPnl) || startingBalance;

  /* ── La mise en forme ── */
  const weekday = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(lang, { weekday: "long", timeZone: "UTC" });
    // 2024-01-01 était un lundi : clé « 1 » = lundi … « 7 » = dimanche.
    return (key: string) => {
      const s = fmt.format(new Date(Date.UTC(2024, 0, Number(key))));
      return s.charAt(0).toUpperCase() + s.slice(1);
    };
  }, [lang]);
  const monthFmt = useMemo(
    () => new Intl.DateTimeFormat(lang, { month: "short", year: "2-digit", timeZone: "UTC" }),
    [lang],
  );
  const shortDays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(lang, { weekday: "short" });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2023, 0, 1 + i)));
  }, [lang]);
  const periodDayCount = useMemo(() => {
    const acc: Record<number, number> = {};
    for (const x of inPeriod) acc[weekdayOf(x.date)] = (acc[weekdayOf(x.date)] ?? 0) + 1;
    return acc;
  }, [inPeriod]);

  let won = 0;
  let lost = 0;
  for (const x of scoped) {
    if (x.pnl > 0) won += x.pnl;
    else if (x.pnl < 0) lost -= x.pnl;
  }
  const decided = stats.wins + stats.losses;
  const signed = (v: number) => formatMoney(v, { signed: true });

  const kpis = [
    {
      label: t("analytics.ob.netPnl"),
      value: signed(stats.totalPnl),
      sub: t("analytics.ob.nTrades").replace("{n}", String(stats.totalTrades)),
      tone: stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400",
    },
    {
      label: t("stats.winRate"),
      value: decided ? formatPct(stats.winRate) : "—",
      sub: t("dashboard.winLoss")
        .replace("{w}", String(stats.wins))
        .replace("{l}", String(stats.losses)),
      tone: decided ? (stats.winRate >= 0.5 ? "text-emerald-400" : "text-red-400") : "",
    },
    {
      label: t("dashboard.profitFactor"),
      value: stats.profitFactor === null ? "—" : stats.profitFactor.toFixed(2),
      sub: decided
        ? `${formatMoney(won, { whole: true })} / ${formatMoney(-lost, { whole: true })}`
        : "—",
      tone:
        stats.profitFactor === null
          ? ""
          : stats.profitFactor >= 1
            ? "text-emerald-400"
            : "text-red-400",
    },
    {
      label: t("analytics.s.avgTrade"),
      value: stats.totalTrades ? signed(quant.expectancy) : "—",
      sub:
        quant.expectancyR === null
          ? t("analytics.ob.perTrade")
          : `${quant.expectancyR >= 0 ? "+" : ""}${quant.expectancyR.toFixed(2)}R ${t("analytics.ob.perTrade")}`,
      tone: quant.expectancy >= 0 ? "text-emerald-400" : "text-red-400",
    },
    {
      label: t("analytics.s.winLossSize"),
      value:
        stats.wins || stats.losses
          ? `${formatMoney(stats.avgWin, { whole: true })} / ${formatMoney(-Math.abs(stats.avgLoss), { whole: true })}`
          : "—",
      sub: t("analytics.s.winLossSizeSub"),
      tone: "",
    },
    {
      label: t("analytics.ob.maxDd"),
      value: stats.totalTrades ? formatMoney(-Math.abs(stats.maxDrawdown), { whole: true }) : "—",
      sub: quant.maxDrawdownPct === null ? "—" : `${(quant.maxDrawdownPct * 100).toFixed(1)}%`,
      tone: stats.maxDrawdown ? "text-red-400" : "",
    },
  ];

  const winLossData = [
    { name: t("common.win"), value: stats.wins, color: CHART_GREEN },
    { name: t("common.loss"), value: stats.losses, color: CHART_RED },
    ...(stats.breakEven > 0
      ? [{ name: t("common.be"), value: stats.breakEven, color: "var(--tv-text-muted)" }]
      : []),
  ];

  /* Une case « ce qui marche » : son nom, son P&L, son n. */
  const tile = (label: string, b: InsightBucket | null, name: (k: string) => string) => ({
    label,
    value: b ? name(b.key) : "—",
    hint: b
      ? t("analytics.s.tileHint")
          .replace("{pnl}", signed(b.pnl))
          .replace("{n}", String(b.count))
          .replace("{wr}", b.winRate === null ? "—" : formatPct(b.winRate))
      : t("analytics.s.needN").replace("{n}", String(MIN_BUCKET_SAMPLE)),
    tone: !b ? ("neutral" as const) : b.pnl >= 0 ? ("pos" as const) : ("neg" as const),
  });
  const hourName = (k: string) => `${k.padStart(2, "0")}:00`;
  const same = (k: string) => k;
  const tiles = [
    tile(t("analytics.s.bestSetup"), insights.setup.best, same),
    tile(t("analytics.s.worstSetup"), insights.setup.worst, same),
    tile(t("analytics.s.bestSymbol"), insights.symbol.best, same),
    tile(t("analytics.s.bestDay"), insights.day.best, weekday),
    tile(t("analytics.s.bestHour"), insights.hour.best, hourName),
    tile(t("analytics.s.worstHour"), insights.hour.worst, hourName),
  ];

  const months = insights.months.slice(-12).map((m) => {
    const [y, mo] = m.month.split("-").map(Number);
    return { ...m, label: monthFmt.format(new Date(Date.UTC(y, mo - 1, 1))) };
  });
  const greenMonths = months.filter((m) => m.pnl > 0).length;

  const regularity = [
    {
      label: t("analytics.s.bestDayShare"),
      value: quant.bestDayShare === null ? "—" : `${(quant.bestDayShare * 100).toFixed(0)}%`,
    },
    {
      label: t("analytics.s.backToHigh"),
      value:
        quant.recoveryDays === null
          ? "—"
          : t("analytics.s.days").replace("{n}", String(quant.recoveryDays)),
    },
    { label: t("analytics.s.winStreak"), value: String(insights.longestWinStreak) },
    { label: t("analytics.s.lossStreak"), value: String(insights.longestLossStreak) },
  ];

  /* ── Les filtres : période et jours, à deux gestes ── */
  const pageControls = useMemo(
    () => (
      <FilterControls
        label={t("common.filters")}
        summary={[
          period.kind === "custom"
            ? `${period.from} – ${period.to}`
            : period.preset !== "all"
              ? t(`common.${period.preset}`)
              : "",
          ...days.map((d) => shortDays[Number(d)]),
        ]
          .filter(Boolean)
          .join(" · ")}
        onReset={() => {
          setDays([]);
          setPeriod(ALL_PERIOD);
        }}
        resetLabel={t("common.reset")}
        doneLabel={t("common.done")}
        liveLabel={t("filters.live")}
        count={days.length + (period.kind === "custom" || period.preset !== "all" ? 1 : 0)}
      >
        <FilterSection
          label={t("common.period")}
          summary={
            period.kind === "custom"
              ? `${period.from} – ${period.to}`
              : t(`common.${period.preset}`)
          }
        >
          <RangePicker
            inline
            label={t("common.period")}
            value={period}
            onChange={setPeriod}
            neutralPreset="all"
            presets={[
              { value: "all", label: t("common.all") },
              { value: "7d", label: t("common.7d") },
              { value: "30d", label: t("common.30d") },
              { value: "90d", label: t("common.90d") },
              { value: "1y", label: t("common.1y") },
            ]}
            customLabel={t("picker.custom")}
            fromLabel={t("picker.from")}
            toLabel={t("picker.to")}
            applyLabel={t("picker.apply")}
            todayLabel={t("calendar.today")}
            locale={lang}
          />
        </FilterSection>
        <FilterSection
          label={t("journal.filterDay")}
          summary={days.length ? days.map((d) => shortDays[Number(d)]).join(", ") : t("common.all")}
        >
          <MultiPicker
            inline
            label={t("journal.filterDay")}
            values={days}
            onChange={setDays}
            options={[1, 2, 3, 4, 5].map((d) => ({
              value: String(d),
              label: shortDays[d].charAt(0).toUpperCase() + shortDays[d].slice(1),
              count: periodDayCount[d] ?? 0,
            }))}
            allLabel={t("common.all")}
            clearLabel={t("common.clear")}
            doneLabel={t("common.done")}
            countLabel={t("picker.nSelected")}
          />
        </FilterSection>
      </FilterControls>
    ),
    // setPeriod / setDays écrivent dans le stockage : stables par clé.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, days, period, lang, shortDays, periodDayCount, periodKey, daysKey],
  );
  usePageActions(trades.length > 0 ? pageControls : null);

  if (trades.length === 0)
    return (
      <div className="p-3 md:p-4">
        <EmptyState title={t("analytics.noTrades")} />
      </div>
    );

  return (
    <PageContainer ref={boxRef} fit height={height}>
      <ScrollArea className="tv-grow animate-fade-in">
        <div className="ana-overview">
          {/* ── RÉSULTATS ── */}
          <section className="dash-panel ana-kpi-panel" aria-label={t("analytics.s.results")}>
            <div className="dash-kpis ana-kpis">
              {kpis.map((k) => (
                <div key={k.label} className="dash-kpi">
                  <span className="tv-label dash-kpi-label">{k.label}</span>
                  <span className={cn("tv-figure dash-kpi-value", k.tone)}>{k.value}</span>
                  <span className="dash-kpi-sub tv-num">{numericText(k.sub)}</span>
                </div>
              ))}
            </div>
          </section>
          <div className="ana-board">
            <EquityPanel stats={stats} className="ana-span-2" />
            <section className="dash-panel">
              <div className="dash-panel-head">
                <h2 className="dash-panel-title">{t("analytics.winLoss")}</h2>
              </div>
              <div className="ana-donut">
                <ResponsiveContainer debounce={100} width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={winLossData}
                      cx="50%"
                      cy="50%"
                      innerRadius="68%"
                      outerRadius="92%"
                      paddingAngle={3}
                      cornerRadius={5}
                      dataKey="value"
                      stroke="none"
                      isAnimationActive={false}
                    >
                      {winLossData.map((e, i) => (
                        // Le secteur est un `role="img"` : sans nom, un lecteur
                        // d'écran n'annonce rien (axe `svg-img-alt`).
                        <Cell key={i} aria-label={`${e.name} : ${e.value}`} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <span className="ana-donut-center">
                  <b className="tv-figure">{decided ? formatPct(stats.winRate) : "—"}</b>
                  <small className="tv-label">{t("analytics.winRateLabel")}</small>
                </span>
              </div>
              <div className="dash-month-stats ana-wl-stats">
                {winLossData.map((e) => (
                  <span key={e.name}>
                    <small className="tv-label">
                      <i className="ana-dot" style={{ background: e.color }} />
                      {e.name}
                    </small>
                    <b className="tv-figure">{e.value}</b>
                  </span>
                ))}
              </div>
            </section>
          </div>

          {/* ── CE QUI MARCHE ── */}
          <h2 className="ana-group">{t("analytics.s.whatWorks")}</h2>
          <div className="ana-board">
            <section className="dash-panel ana-span-2">
              <div className="ana-tiles">
                {tiles.map((k) => (
                  <Kpi key={k.label} label={k.label} value={k.value} hint={k.hint} tone={k.tone} />
                ))}
              </div>
            </section>
            <section className="dash-panel">
              <div className="dash-panel-head">
                <h2 className="dash-panel-title">{t("analytics.s.months")}</h2>
              </div>
              {months.length ? (
                <>
                  <div className="ana-chart ana-chart-sm">
                    <ResponsiveContainer debounce={100} width="100%" height="100%">
                      <BarChart data={months} margin={{ left: 0, right: 6, top: 6, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="var(--tv-border)" />
                        <XAxis
                          dataKey="label"
                          tick={AXIS_TICK}
                          tickLine={false}
                          axisLine={false}
                          minTickGap={8}
                        />
                        <YAxis
                          tick={AXIS_TICK}
                          tickLine={false}
                          axisLine={false}
                          width={42}
                          tickFormatter={(v) => formatMoney(v, { compact: true })}
                        />
                        <Tooltip
                          {...tooltipStyle}
                          formatter={(v: number) => [formatMoney(v), "P&L"]}
                        />
                        <Bar dataKey="pnl" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                          {months.map((m, i) => (
                            <Cell key={i} fill={m.pnl < 0 ? CHART_RED : CHART_GREEN} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="ana-read tv-num">
                    {numericText(
                      t("analytics.s.monthsRead")
                        .replace("{g}", String(greenMonths))
                        .replace("{n}", String(months.length)),
                    )}
                  </p>
                </>
              ) : (
                <div className="ana-empty">{t("analytics.noData")}</div>
              )}
            </section>
          </div>

          {/* ── LA SUITE ── */}
          <h2 className="ana-group">{t("analytics.s.next")}</h2>
          <div className="ana-board">
            <NextTradesPanel trades={scoped} balance={balance} className="ana-span-2" />
            <section className="dash-panel">
              <div className="dash-panel-head">
                <h2 className="dash-panel-title">{t("analytics.s.regularity")}</h2>
              </div>
              <dl className="ana-ratios">
                {regularity.map((r) => (
                  <div key={r.label} className="ana-ratio">
                    <dt>
                      <span className="truncate">{r.label}</span>
                    </dt>
                    <dd>
                      <span className="tv-figure">{r.value}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </div>
      </ScrollArea>
    </PageContainer>
  );
}
