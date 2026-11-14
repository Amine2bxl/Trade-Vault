import { useMemo, type ReactNode } from "react";
import { InfoTip } from "@/shared/ui/InfoTip";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Trade, TradeStats } from "@/app/types";
import { measuredR } from "@/domain/trade";
import { formatPct } from "@/domain/tradeCalcs";
import type { computeQuantStats } from "@/domain/quantStats";
import { formatMoney } from "@/shared/currency";
import { numericText } from "@/shared/ui/NumericText";
import { cn } from "@/shared/ui/cn";
import { useT } from "@/app/i18n/LanguageContext";
import { AXIS_TICK, CHART_GREEN, CHART_RED, tooltipStyle } from "@/app/trading/chartTheme";
import { journalOutlook, OUTLOOK_MIN_TRADES, OUTLOOK_TRADES } from "@/modules/probability/outlook";
import { histogram } from "../monte-carlo/monteCarloViz";

/**
 * LES PANNEAUX DE LA VUE D'ENSEMBLE — une matière, une grammaire.
 *
 * La page (`Analytics.tsx`) les ORDONNE en trois sections — Performance,
 * Mois et ratios, Projection — à côté des blocs historiques (le camembert
 * Gagnés/Perdus, la performance mensuelle). Chaque panneau : `.dash-panel`,
 * un titre, un graphe ou une liste, une ligne de lecture chiffrée. Chaque
 * chiffre vient d'un moteur déterministe (`computeStats`, `computeQuantStats`,
 * `journalOutlook`) et dit d'où il vient (n, gagné/perdu…), sans phrase.
 */
type Quant = ReturnType<typeof computeQuantStats>;

export function OverviewBoard({
  trades,
  stats,
  quant,
  balance,
  winLoss,
  monthly,
}: {
  trades: Trade[];
  stats: TradeStats;
  quant: Quant;
  balance: number;
  /** Le camembert Gagnés/Perdus (un panneau de la page). */
  winLoss: ReactNode;
  /** La performance mensuelle (un panneau large de la page). */
  monthly: ReactNode;
}) {
  const { t, lang } = useT();
  // « 2026-10-14 » → « 14 oct. » ; lu en UTC : une date civile ne glisse pas
  // d'un jour selon le fuseau de l'appareil.
  const dayFmt = useMemo(
    () => new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", timeZone: "UTC" }),
    [lang],
  );
  const shortDate = (v: string) => {
    const [y, m, d] = v.split("-").map(Number);
    return y && m && d ? dayFmt.format(new Date(Date.UTC(y, m - 1, d))) : v;
  };

  const won = useMemo(
    () => trades.filter((x) => x.pnl > 0).reduce((s, x) => s + x.pnl, 0),
    [trades],
  );
  const lost = useMemo(
    () => -trades.filter((x) => x.pnl < 0).reduce((s, x) => s + x.pnl, 0),
    [trades],
  );
  const decided = stats.wins + stats.losses;

  const kpis = [
    {
      label: t("analytics.ob.netPnl"),
      value: formatMoney(stats.totalPnl, { signed: true }),
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
      label: t("analytics.ob.expectancy"),
      value: stats.totalTrades ? formatMoney(quant.expectancy, { signed: true }) : "—",
      sub:
        quant.expectancyR === null
          ? t("analytics.ob.perTrade")
          : `${quant.expectancyR >= 0 ? "+" : ""}${quant.expectancyR.toFixed(2)}R ${t("analytics.ob.perTrade")}`,
      tone: quant.expectancy >= 0 ? "text-emerald-400" : "text-red-400",
    },
    {
      label: t("dashboard.avgR"),
      value:
        stats.avgRR === null
          ? "—"
          : `${stats.avgRR >= 0 ? "+" : "−"}${Math.abs(stats.avgRR).toFixed(2)}R`,
      sub: t("dashboard.rKnown")
        .replace("{n}", String(stats.rSampleSize))
        .replace("{total}", String(stats.totalTrades)),
      tone: stats.avgRR === null ? "" : stats.avgRR >= 0 ? "text-emerald-400" : "text-red-400",
    },
    {
      label: t("analytics.ob.maxDd"),
      value: stats.totalTrades ? formatMoney(-Math.abs(stats.maxDrawdown), { whole: true }) : "—",
      sub: quant.maxDrawdownPct === null ? "—" : `${(quant.maxDrawdownPct * 100).toFixed(1)}%`,
      tone: stats.maxDrawdown ? "text-red-400" : "",
    },
    {
      label: t("analytics.ob.avgWin"),
      value: stats.wins ? formatMoney(stats.avgWin, { signed: true }) : "—",
      sub: t("analytics.ob.nTrades").replace("{n}", String(stats.wins)),
      tone: stats.wins ? "text-emerald-400" : "",
    },
    {
      label: t("analytics.ob.avgLoss"),
      value: stats.losses ? formatMoney(-Math.abs(stats.avgLoss), { signed: true }) : "—",
      sub: t("analytics.ob.nTrades").replace("{n}", String(stats.losses)),
      tone: stats.losses ? "text-red-400" : "",
    },
  ];

  /* Les ratios — leur valeur, ou « — » et la raison en une ligne. */
  const ratios = [
    {
      label: "Sharpe",
      value: quant.sharpe === null ? "—" : quant.sharpe.toFixed(2),
      sub:
        quant.sharpeStatus === "unverified_returns"
          ? t("quant.verifiedReturnsNeeded")
          : quant.sharpeStatus === "insufficient"
            ? t("quant.needTenDays")
            : quant.sharpeStatus === "no_variance"
              ? t("quant.noVariance")
              : t("quant.annualized"),
      info: t("quant.infoSharpe"),
      tone: quant.sharpe === null ? "" : quant.sharpe >= 1 ? "text-emerald-400" : "text-slate-200",
    },
    {
      label: "Sortino",
      value: quant.sortino === null ? "—" : quant.sortino.toFixed(2),
      sub:
        quant.sortinoStatus === "unverified_returns"
          ? t("quant.verifiedReturnsNeeded")
          : quant.sortinoStatus === "insufficient"
            ? t("quant.needTenDays")
            : quant.sortinoStatus === "no_downside"
              ? t("quant.noDownside")
              : t("quant.annualized"),
      info: t("quant.infoSortino"),
      tone:
        quant.sortino === null ? "" : quant.sortino >= 1.5 ? "text-emerald-400" : "text-slate-200",
    },
    {
      label: "Kelly",
      value: quant.kelly === null ? "—" : `${(quant.kelly * 100).toFixed(1)}%`,
      sub: t("quant.kellyHint"),
      info: t("quant.infoKelly"),
      tone: "",
    },
    {
      label: t("quant.consistency"),
      value: quant.consistencyScore === null ? "—" : `${quant.consistencyScore.toFixed(0)}/100`,
      sub:
        quant.bestDayShare === null
          ? "—"
          : `${t("quant.bestDay")} ${(quant.bestDayShare * 100).toFixed(0)}%`,
      info: t("quant.infoConsistency"),
      tone: "",
    },
    {
      label: t("quant.recovery"),
      value: quant.recoveryDays === null ? "—" : `${quant.recoveryDays}d`,
      sub: t("quant.recoverySub"),
      info: t("quant.infoRecovery"),
      tone: "",
    },
  ];

  /* La courbe et son drawdown, sur le même axe de temps. */
  const equity = useMemo(() => {
    let peak = -Infinity;
    return stats.equityCurve.map((p) => {
      peak = Math.max(peak, p.equity);
      return { date: p.date, equity: p.equity, dd: p.equity - peak };
    });
  }, [stats.equityCurve]);

  /* Où atterrissent les trades : en R mesuré quand il couvre l'essentiel
     du journal, sinon en dollars — l'unité est écrite sur l'axe. */
  const land = useMemo(() => {
    const rs = trades.map((x) => measuredR(x)).filter((r): r is number => r !== null);
    const useR = rs.length >= 10 && rs.length >= trades.length * 0.6;
    const values = useR ? rs : trades.map((x) => x.pnl);
    if (values.length < 5) return null;
    const lo = Math.min(0, ...values);
    const hi = Math.max(0, ...values);
    const bins = histogram(
      values,
      lo,
      hi,
      Math.min(16, Math.max(6, Math.round(values.length / 3))),
    );
    const sorted = [...values].sort((a, b) => a - b);
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    return {
      useR,
      bins: bins.map((b) => ({ ...b, share: (b.count / values.length) * 100 })),
      avg,
      median: sorted[Math.floor(sorted.length / 2)],
      n: values.length,
    };
  }, [trades]);
  const fmtUnit = (v: number, useR: boolean) =>
    useR ? `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}R` : formatMoney(v, { compact: true });

  /* Les 100 prochains trades, rééchantillonnés depuis le journal. */
  const outlook = useMemo(() => journalOutlook(trades, balance), [trades, balance]);
  const finish = useMemo(() => {
    if (!outlook) return null;
    const f = outlook.projection.finalPnl;
    const bins = histogram(f, Math.min(0, f[0]), Math.max(0, f.at(-1) ?? 0), 20).map((b) => ({
      ...b,
      share: (b.count / f.length) * 100,
    }));
    const q = (p: number) => f[Math.min(f.length - 1, Math.floor(p * f.length))];
    return { bins, p5: q(0.05), p50: q(0.5), p95: q(0.95) };
  }, [outlook]);
  const exceed = useMemo(
    () =>
      outlook
        ? outlook.projection.drawdownExceedance.map((p) => ({ ...p, pct: p.probability * 100 }))
        : [],
    [outlook],
  );
  const exceedAtLimit = outlook
    ? outlook.projection.maxDrawdowns.filter((v) => v >= outlook.drawdownLimit).length /
      outlook.projection.maxDrawdowns.length
    : 0;

  const realCount = trades.filter((x) => !x.isExample).length;
  const notEnough = (
    <div className="ana-empty">
      {numericText(
        t("analytics.ob.notEnough")
          .replace("{n}", String(OUTLOOK_MIN_TRADES))
          .replace("{have}", String(realCount)),
      )}
    </div>
  );

  return (
    <div className="ana-overview">
      <section className="dash-panel ana-kpi-panel" aria-label={t("analytics.viewOverview")}>
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

      {/* ── PERFORMANCE ── */}
      <h2 className="ana-group">{t("analytics.group.performance")}</h2>
      <div className="ana-board">
        {/* 1 — LA COURBE ET SON DRAWDOWN */}
        <section className="dash-panel ana-span-2">
          <div className="dash-panel-head">
            <h2 className="dash-panel-title">{t("analytics.ob.equityDd")}</h2>
          </div>
          {equity.length > 1 ? (
            <>
              <div className="ana-chart-main">
                <ResponsiveContainer debounce={100} width="100%" height="100%">
                  <AreaChart data={equity} margin={{ left: 0, right: 8, top: 6, bottom: 0 }}>
                    <defs>
                      <linearGradient id="anaEq" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_GREEN} stopOpacity={0.22} />
                        <stop offset="100%" stopColor={CHART_GREEN} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--tv-border)" />
                    <XAxis dataKey="date" hide />
                    <YAxis
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      width={48}
                      tickFormatter={(v) => formatMoney(v, { compact: true })}
                    />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(v: number) => [formatMoney(v), t("chart.balance")]}
                    />
                    <Area
                      dataKey="equity"
                      type="monotone"
                      stroke={CHART_GREEN}
                      strokeWidth={2}
                      fill="url(#anaEq)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="ana-chart-dd">
                <ResponsiveContainer debounce={100} width="100%" height="100%">
                  <AreaChart data={equity} margin={{ left: 0, right: 8, top: 2, bottom: 0 }}>
                    <XAxis
                      dataKey="date"
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={40}
                      tickFormatter={shortDate}
                    />
                    <YAxis
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      width={48}
                      tickFormatter={(v) => formatMoney(v, { compact: true })}
                    />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(v: number) => [formatMoney(v), t("analytics.ob.drawdown")]}
                    />
                    <Area
                      dataKey="dd"
                      type="monotone"
                      stroke={CHART_RED}
                      strokeWidth={1.5}
                      fill={CHART_RED}
                      fillOpacity={0.14}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="ana-empty">{t("dashboard.noTradesInPeriod")}</div>
          )}
        </section>

        {winLoss}
      </div>

      {/* ── MOIS ET RATIOS ── */}
      <h2 className="ana-group">{t("analytics.group.regularity")}</h2>
      <div className="ana-board">
        {monthly}
        {/* LES RATIOS — Sharpe, Sortino, Kelly, régularité, récupération :
            une liste clé/valeur, chaque ligne avec son ⓘ et sa provenance. */}
        <section className="dash-panel">
          <div className="dash-panel-head">
            <h2 className="dash-panel-title">{t("analytics.ob.ratios")}</h2>
          </div>
          <dl className="ana-ratios">
            {ratios.map((r) => (
              <div key={r.label} className="ana-ratio">
                <dt>
                  <span className="truncate">{r.label}</span>
                  <InfoTip text={r.info} />
                </dt>
                <dd>
                  <span className={cn("tv-figure", r.tone)}>{r.value}</span>
                  <small className="tv-num">{numericText(r.sub)}</small>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {/* ── PROJECTION — tirée de ton journal ── */}
      <h2 className="ana-group">{t("analytics.group.projection")}</h2>
      <div className="ana-board">
        {/* 3 — OÙ ATTERRISSENT TES TRADES */}
        <section className="dash-panel">
          <div className="dash-panel-head">
            <h2 className="dash-panel-title">{t("analytics.ob.tradesLand")}</h2>
          </div>
          {land ? (
            <>
              <div className="ana-chart">
                <ResponsiveContainer debounce={100} width="100%" height="100%">
                  <BarChart data={land.bins} margin={{ left: 0, right: 6, top: 6, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--tv-border)" />
                    <XAxis
                      dataKey="center"
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={30}
                      tickFormatter={(v) => fmtUnit(Number(v), land.useR)}
                    />
                    <YAxis hide />
                    <Tooltip
                      {...tooltipStyle}
                      labelFormatter={(v) => fmtUnit(Number(v), land.useR)}
                      formatter={(v: number) => [`${v.toFixed(1)}%`, t("common.trades")]}
                    />
                    <Bar dataKey="share" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                      {land.bins.map((b, i) => (
                        <Cell key={i} fill={b.center < 0 ? CHART_RED : CHART_GREEN} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="ana-read tv-num">
                {numericText(
                  t("analytics.ob.landRead")
                    .replace("{a}", fmtUnit(land.avg, land.useR))
                    .replace("{m}", fmtUnit(land.median, land.useR))
                    .replace("{n}", String(land.n)),
                )}
              </p>
            </>
          ) : (
            <div className="ana-empty">{t("dashboard.noTradesInPeriod")}</div>
          )}
        </section>

        {/* 2 — OÙ FINISSENT LES 100 PROCHAINS TRADES */}
        <section className="dash-panel">
          <div className="dash-panel-head">
            <h2 className="dash-panel-title">
              {t("analytics.ob.pathsFinish").replace("{n}", String(OUTLOOK_TRADES))}
            </h2>
          </div>
          {outlook && finish ? (
            <>
              <div className="ana-chart">
                <ResponsiveContainer debounce={100} width="100%" height="100%">
                  <BarChart data={finish.bins} margin={{ left: 0, right: 6, top: 6, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--tv-border)" />
                    <XAxis
                      dataKey="center"
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={30}
                      tickFormatter={(v) => formatMoney(v, { compact: true })}
                    />
                    <YAxis hide />
                    <Tooltip
                      {...tooltipStyle}
                      labelFormatter={(v) => formatMoney(Number(v))}
                      formatter={(v: number) => [`${v.toFixed(1)}%`, t("lab.paths")]}
                    />
                    <Bar dataKey="share" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                      {finish.bins.map((b, i) => (
                        <Cell key={i} fill={b.center < 0 ? CHART_RED : CHART_GREEN} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="ana-read tv-num">
                {numericText(
                  t("analytics.ob.finishRead")
                    .replace("{m}", formatMoney(finish.p50, { whole: true, signed: true }))
                    .replace("{lo}", formatMoney(finish.p5, { whole: true, signed: true }))
                    .replace("{hi}", formatMoney(finish.p95, { whole: true, signed: true })),
                )}
              </p>
            </>
          ) : (
            notEnough
          )}
        </section>

        {/* 4 — À QUELLE FRÉQUENCE UN DRAWDOWN EST DÉPASSÉ */}
        <section className="dash-panel">
          <div className="dash-panel-head">
            <h2 className="dash-panel-title">{t("lab.ddExceedance")}</h2>
          </div>
          {outlook ? (
            <>
              <div className="ana-chart">
                <ResponsiveContainer debounce={100} width="100%" height="100%">
                  <AreaChart data={exceed} margin={{ left: 0, right: 6, top: 6, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--tv-border)" />
                    <XAxis
                      dataKey="amount"
                      type="number"
                      domain={[0, "dataMax"]}
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={30}
                      tickFormatter={(v) => formatMoney(v, { compact: true })}
                    />
                    <YAxis
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      width={34}
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      {...tooltipStyle}
                      labelFormatter={(v) => formatMoney(Number(v))}
                      formatter={(v: number) => [`${v.toFixed(1)}%`, t("lab.exceeds")]}
                    />
                    <ReferenceLine
                      x={outlook.drawdownLimit}
                      stroke={CHART_RED}
                      strokeDasharray="3 3"
                    />
                    <Area
                      dataKey="pct"
                      type="linear"
                      stroke={CHART_RED}
                      fill={CHART_RED}
                      fillOpacity={0.1}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="ana-read tv-num">
                {numericText(
                  t("analytics.ob.ddRead")
                    .replace("{p}", (exceedAtLimit * 100).toFixed(1))
                    .replace("{dd}", formatMoney(outlook.drawdownLimit, { whole: true })),
                )}
              </p>
            </>
          ) : (
            notEnough
          )}
        </section>
      </div>
    </div>
  );
}
