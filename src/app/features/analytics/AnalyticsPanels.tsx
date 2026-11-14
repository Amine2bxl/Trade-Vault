import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Trade, TradeStats } from "@/app/types";
import { formatMoney } from "@/shared/currency";
import { InfoTip } from "@/shared/ui/InfoTip";
import { cn } from "@/shared/ui/cn";
import { numericText } from "@/shared/ui/NumericText";
import { useT } from "@/app/i18n/LanguageContext";
import { AXIS_TICK, CHART_GREEN, CHART_RED, tooltipStyle } from "@/app/trading/chartTheme";
import { journalOutlook, OUTLOOK_MIN_TRADES, OUTLOOK_TRADES } from "@/modules/probability/outlook";
import { histogram } from "../monte-carlo/monteCarloViz";

/**
 * LES DEUX PANNEAUX GRAPHIQUES DES ANALYSES.
 *
 * Ils n'affichent que des résultats : la courbe et son drawdown (de
 * `computeStats`), et « tes 100 prochains trades » (de `journalOutlook`, le
 * moteur Monte Carlo appliqué au journal). Aucune mécanique à l'écran — pas
 * de « trajectoires », de « tirages » ni de courbe de dépassement : un
 * histogramme et trois chiffres en clair.
 */

export function EquityPanel({ stats, className }: { stats: TradeStats; className?: string }) {
  const { t, lang } = useT();
  const dayFmt = useMemo(
    () => new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", timeZone: "UTC" }),
    [lang],
  );
  // « 2026-10-14 » → « 14 oct. », lu en UTC : une date civile ne glisse pas.
  const shortDate = (v: string) => {
    const [y, m, d] = v.split("-").map(Number);
    return y && m && d ? dayFmt.format(new Date(Date.UTC(y, m - 1, d))) : v;
  };
  const equity = useMemo(() => {
    let peak = -Infinity;
    return stats.equityCurve.map((p) => {
      peak = Math.max(peak, p.equity);
      return { date: p.date, equity: p.equity, dd: p.equity - peak };
    });
  }, [stats.equityCurve]);

  return (
    <section className={cn("dash-panel", className)}>
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
                  labelFormatter={(v) => shortDate(String(v))}
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
                  labelFormatter={(v) => shortDate(String(v))}
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
  );
}

export function NextTradesPanel({
  trades,
  balance,
  className,
}: {
  trades: Trade[];
  balance: number;
  className?: string;
}) {
  const { t } = useT();
  const outlook = useMemo(() => journalOutlook(trades, balance), [trades, balance]);
  const view = useMemo(() => {
    if (!outlook) return null;
    const f = outlook.projection.finalPnl; // trié, du pire au meilleur
    const q = (p: number) => f[Math.min(f.length - 1, Math.floor(p * f.length))];
    const bins = histogram(f, Math.min(0, f[0]), Math.max(0, f.at(-1) ?? 0), 20).map((b) => ({
      ...b,
      share: (b.count / f.length) * 100,
    }));
    const dd = outlook.projection.maxDrawdowns;
    return {
      bins,
      median: q(0.5),
      lo: q(0.05),
      hi: q(0.95),
      lossChance: f.filter((v) => v < 0).length / f.length,
      ddChance: dd.filter((v) => v >= outlook.drawdownLimit).length / dd.length,
    };
  }, [outlook]);
  const realCount = trades.filter((x) => !x.isExample).length;
  const pct = (v: number) => `${(v * 100).toFixed(v > 0 && v < 0.01 ? 1 : 0)}%`;

  return (
    <section className={cn("dash-panel", className)}>
      <div className="dash-panel-head">
        <h2 className="dash-panel-title">
          {t("analytics.s.next100").replace("{n}", String(OUTLOOK_TRADES))}
        </h2>
        {outlook && (
          <InfoTip text={t("analytics.s.nextHow").replace("{n}", String(outlook.sample))} />
        )}
      </div>
      {outlook && view ? (
        <>
          <div className="ana-chart">
            <ResponsiveContainer debounce={100} width="100%" height="100%">
              <BarChart data={view.bins} margin={{ left: 0, right: 6, top: 6, bottom: 0 }}>
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
                  formatter={(v: number) => [`${v.toFixed(1)}%`, t("analytics.s.chance")]}
                />
                <Bar dataKey="share" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                  {view.bins.map((b, i) => (
                    <Cell key={i} fill={b.center < 0 ? CHART_RED : CHART_GREEN} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="dash-month-stats ana-next-stats">
            <span>
              <small className="tv-label">{t("analytics.s.typical")}</small>
              <b
                className="tv-figure"
                // La couleur en style : la règle `.dash-month-stats b` (hors couche)
                // l'emporterait sur une classe utilitaire.
                style={{ color: view.median >= 0 ? CHART_GREEN : CHART_RED }}
              >
                {formatMoney(view.median, { whole: true, signed: true })}
              </b>
            </span>
            <span>
              <small className="tv-label">{t("analytics.s.range")}</small>
              <b className="tv-figure">
                {numericText(
                  `${formatMoney(view.lo, { whole: true, signed: true })} → ${formatMoney(view.hi, { whole: true, signed: true })}`,
                )}
              </b>
            </span>
            <span>
              <small className="tv-label">{t("analytics.s.lossChance")}</small>
              <b className="tv-figure">{pct(view.lossChance)}</b>
            </span>
            <span>
              <small className="tv-label">
                {t("analytics.s.ddChance").replace(
                  "{dd}",
                  formatMoney(outlook.drawdownLimit, { whole: true, compact: true }),
                )}
              </small>
              <b className="tv-figure">{pct(view.ddChance)}</b>
            </span>
          </div>
        </>
      ) : (
        <div className="ana-empty">
          {numericText(
            t("analytics.ob.notEnough")
              .replace("{n}", String(OUTLOOK_MIN_TRADES))
              .replace("{have}", String(realCount)),
          )}
        </div>
      )}
    </section>
  );
}
