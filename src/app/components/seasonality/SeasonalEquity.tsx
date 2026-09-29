import { useMemo } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Activity, LineChart as LineIcon } from "lucide-react";
import type { Trade } from "../../types";
import { useT } from "../../i18n/LanguageContext";
import { Kpi, KpiGrid } from "@/shared/ui";
import { formatPnl } from "../../utils/tradeCalcs";
import {
  AXIS_TICK,
  CHART_GREEN,
  CHART_RED,
  EQUITY_ANIMATION,
  EQUITY_FLOOR,
  EQUITY_GRID,
  EQUITY_LINE,
  formatAxisDate,
  glowActiveDot,
  moneyAxisProps,
  tooltipStyle,
} from "../../utils/chartTheme";
import { MONTHS_SHORT, type SeasonalAsset } from "../../utils/assetSeasonality";
import { assetEquity, readSeasonalPath, seasonalPath } from "../../utils/seasonalCurve";
import { cn } from "../../utils/cn";

const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

/**
 * LES COURBES DE SAISONNALITÉ.
 *
 * Les barres du dessus disent ce que rend CHAQUE mois. Ces courbes disent ce
 * que ça donne BOUT À BOUT :
 *
 * 1. La saison moyenne de l'actif — les rendements mensuels composés depuis
 *    le 1er janvier. On y lit où l'année culmine, le creux à traverser, et ce
 *    qu'il reste à courir d'ici décembre (la partie à venir est en pointillé).
 *    Les autres actifs de la catégorie passent en filigrane : la forme de
 *    l'actif se lit CONTRE celle de ses voisins.
 * 2. L'equity RÉELLE du trader sur cet actif, tirée de son journal, et son
 *    P&L par mois civil posé face au biais : trade-t-il avec la saison ou
 *    contre elle ?
 */
export function SeasonalEquity({
  asset,
  peers,
  currentMonth,
  trades,
}: {
  asset: SeasonalAsset;
  peers: SeasonalAsset[];
  currentMonth: number;
  trades: Trade[];
}) {
  const { t, lang } = useT();
  const monthName = (m: number) =>
    new Date(2026, m, 1).toLocaleDateString(lang, { month: "short" });

  const path = useMemo(() => seasonalPath(asset.monthlyAvg), [asset]);
  const reading = useMemo(() => readSeasonalPath(path, currentMonth), [path, currentMonth]);
  const others = useMemo(() => peers.filter((p) => p.symbol !== asset.symbol), [peers, asset]);

  // Une ligne par pas : la courbe de l'actif, coupée en « passé » (plein) et
  // « à venir » (pointillé) au début du mois courant — les deux se rejoignent
  // sur ce point — et une clé par voisin.
  const rows = useMemo(() => {
    const peerPaths = others.map((o) => seasonalPath(o.monthlyAvg));
    return path.map((p, i) => {
      const row: Record<string, number | null> = {
        step: p.step,
        cum: p.cum,
        past: p.step <= currentMonth ? p.cum : null,
        ahead: p.step >= currentMonth ? p.cum : null,
      };
      peerPaths.forEach((pp, k) => (row[`o${k}`] = pp[i].cum));
      return row;
    });
  }, [path, others, currentMonth]);

  const up = reading.year >= 0;
  const color = up ? CHART_GREEN : CHART_RED;
  const gradId = `tvSeasonArea-${asset.symbol}`;

  const mine = useMemo(() => assetEquity(trades, asset), [trades, asset]);
  const alignment = useMemo(() => {
    const active = mine.byMonth
      .map((m, i) => ({ ...m, i }))
      .filter((m) => m.trades > 0 && Math.abs(asset.monthlyAvg[m.i]) >= 0.05);
    const withSeason = active.filter((m) => Math.sign(m.pnl) === Math.sign(asset.monthlyAvg[m.i]));
    return { active: active.length, aligned: withSeason.length };
  }, [mine, asset]);
  const myColor = mine.total >= 0 ? CHART_GREEN : CHART_RED;
  const myMoney = useMemo(() => moneyAxisProps([0, ...mine.points.map((p) => p.cum)]), [mine]);

  return (
    <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      {/* ── 1. LA SAISON MOYENNE ─────────────────────────────────────── */}
      <section className="glass card-premium rounded-3xl p-4 md:p-5">
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="tv-title mb-0.5 flex items-center gap-2">
              <LineIcon className="h-4 w-4 shrink-0 text-[var(--tv-highlight)]" />
              <span className="truncate">
                {asset.name} — {t("seasonality.curveTitle")}
              </span>
            </h3>
            <p className="tv-hint">{t("seasonality.curveSub")}</p>
          </div>
          <span
            className={cn("tv-figure shrink-0 text-sm font-semibold", up ? "rp-pos" : "rp-neg")}
          >
            {pct(reading.year)}
          </span>
        </header>

        <div className="h-56 md:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid {...EQUITY_GRID} />
              <XAxis
                dataKey="step"
                type="number"
                domain={[0, 12]}
                ticks={[0, 2, 4, 6, 8, 10, 12]}
                tickFormatter={(s: number) => (s < 12 ? monthName(s) : "")}
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={42}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                {...tooltipStyle}
                labelFormatter={(s) =>
                  Number(s) === 0
                    ? t("seasonality.curveStart")
                    : `${t("seasonality.curveEndOf")} ${monthName(Number(s) - 1)}`
                }
                formatter={((v: unknown) => [pct(Number(v)), asset.symbol]) as never}
              />
              <ReferenceLine y={0} {...EQUITY_FLOOR} />
              {others.map((o, k) => (
                <Line
                  key={o.symbol}
                  dataKey={`o${k}`}
                  type="monotone"
                  stroke="var(--tv-text-muted)"
                  strokeOpacity={0.35}
                  strokeWidth={1.25}
                  dot={false}
                  activeDot={false}
                  tooltipType="none"
                  isAnimationActive={false}
                />
              ))}
              <Area
                dataKey="cum"
                type="monotone"
                stroke="none"
                fill={`url(#${gradId})`}
                tooltipType="none"
                activeDot={false}
                isAnimationActive={false}
              />
              <Line
                dataKey="past"
                type="monotone"
                stroke={color}
                {...EQUITY_LINE}
                dot={false}
                activeDot={glowActiveDot(color)}
                connectNulls={false}
                {...EQUITY_ANIMATION}
              />
              <Line
                dataKey="ahead"
                type="monotone"
                stroke={color}
                strokeWidth={1.75}
                strokeDasharray="4 4"
                strokeLinecap="round"
                dot={false}
                activeDot={glowActiveDot(color)}
                connectNulls={false}
                tooltipType="none"
                {...EQUITY_ANIMATION}
              />
              <ReferenceLine
                x={currentMonth}
                stroke="var(--tv-highlight)"
                strokeOpacity={0.55}
                strokeDasharray="2 3"
                label={{
                  value: t("seasonality.today"),
                  position: "insideTopRight",
                  fill: "var(--tv-highlight)",
                  fontSize: 10,
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-[2px] w-4 rounded-full" style={{ background: color }} />
            {t("seasonality.curvePast")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed" style={{ borderColor: color }} />
            {t("seasonality.curveAhead")}
          </span>
          {others.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-px w-4 bg-slate-500/50" />
              {others.map((o) => o.symbol).join(" · ")}
            </span>
          )}
        </div>

        <KpiGrid cols={4} className="mt-4">
          <Kpi
            inset
            label={t("seasonality.curveToDate")}
            value={pct(reading.toDate)}
            tone={reading.toDate >= 0 ? "pos" : "neg"}
            hint={`${monthName(0)} → ${monthName(currentMonth)}`}
          />
          <Kpi
            inset
            label={t("seasonality.curveRemaining")}
            value={pct(reading.remaining)}
            tone={reading.remaining >= 0 ? "pos" : "neg"}
            hint={`${monthName(currentMonth)} → ${monthName(11)}`}
          />
          <Kpi
            inset
            label={t("seasonality.curvePeak")}
            value={monthName(reading.peak.month)}
            hint={pct(reading.peak.cum)}
          />
          <Kpi
            inset
            label={t("seasonality.curveDip")}
            value={`-${reading.maxDrawdown.toFixed(1)}%`}
            tone={reading.maxDrawdown > 0 ? "neg" : "neutral"}
            hint={t("seasonality.curveDipHint")}
          />
        </KpiGrid>
      </section>

      {/* ── 2. L'EQUITY RÉELLE DU TRADER SUR CET ACTIF ──────────────── */}
      <section className="glass card-premium flex min-w-0 flex-col rounded-3xl p-4 md:p-5">
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="tv-title mb-0.5 flex items-center gap-2">
              <Activity className="h-4 w-4 shrink-0 text-[var(--tv-highlight)]" />
              <span className="truncate">
                {t("seasonality.mineTitle")} · {asset.symbol}
              </span>
            </h3>
            <p className="tv-hint truncate">
              {mine.points.length > 0
                ? `${mine.points.length} ${t("seasonality.trades")} · ${mine.symbols.join(", ")}`
                : t("seasonality.mineSub")}
            </p>
          </div>
          {mine.points.length > 0 && (
            <span
              className={cn(
                "tv-figure shrink-0 text-sm font-semibold",
                mine.total >= 0 ? "rp-pos" : "rp-neg",
              )}
            >
              {formatPnl(mine.total)}
            </span>
          )}
        </header>

        {mine.points.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--tv-border)] px-4 py-10 text-center">
            <p className="text-sm font-semibold text-slate-200">{t("seasonality.mineEmpty")}</p>
            <p className="tv-hint mt-1 max-w-xs">
              {t("seasonality.mineEmptySub").replace("{symbol}", asset.symbol)}
            </p>
          </div>
        ) : (
          <>
            <div className="h-44 md:h-48">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={[{ i: 0, cum: 0, date: "", pnl: 0 }, ...mine.points]}
                  margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient id={`${gradId}-mine`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={myColor} stopOpacity={0.24} />
                      <stop offset="100%" stopColor={myColor} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...EQUITY_GRID} />
                  <XAxis
                    dataKey="i"
                    type="number"
                    domain={[0, "dataMax"]}
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <YAxis {...myMoney} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <Tooltip
                    {...tooltipStyle}
                    labelFormatter={
                      ((_l: unknown, p: { payload?: { date?: string; i?: number } }[]) => {
                        const d = p?.[0]?.payload;
                        return d?.date
                          ? `#${d.i} · ${formatAxisDate(d.date)}`
                          : t("seasonality.curveStart");
                      }) as never
                    }
                    formatter={
                      ((v: unknown) => [formatPnl(Number(v)), t("seasonality.mineCum")]) as never
                    }
                  />
                  <ReferenceLine y={0} {...EQUITY_FLOOR} />
                  <Area
                    dataKey="cum"
                    type="monotone"
                    stroke={myColor}
                    fill={`url(#${gradId}-mine)`}
                    {...EQUITY_LINE}
                    dot={false}
                    activeDot={glowActiveDot(myColor)}
                    {...EQUITY_ANIMATION}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Le P&L du trader par mois civil, face au biais de l'actif. Le
                liseré du haut porte le SENS de la saison (vert = mois
                haussier en moyenne) ; la case porte le résultat réel. */}
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="tv-label text-slate-500">{t("seasonality.mineVsSeason")}</span>
                {alignment.active > 0 && (
                  <span className="tv-figure text-[11px] text-slate-400">
                    {t("seasonality.mineAligned")
                      .replace("{n}", String(alignment.aligned))
                      .replace("{total}", String(alignment.active))}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-6 gap-1 sm:grid-cols-12">
                {mine.byMonth.map((m, i) => {
                  const bias = asset.monthlyAvg[i];
                  return (
                    <div
                      key={i}
                      title={`${MONTHS_SHORT[i]} · ${formatPnl(m.pnl)} · ${m.trades} ${t("seasonality.trades")} · ${t("seasonality.avgReturn")} ${pct(bias)}`}
                      className={cn(
                        "flex flex-col items-center rounded-md border-t-2 bg-[var(--tv-plate-2)] px-0.5 py-1.5",
                        i === currentMonth && "ring-1 ring-[var(--tv-border-accent)]",
                      )}
                      style={{
                        borderTopColor:
                          bias >= 0
                            ? "rgb(var(--tv-chart-green-rgb) / 0.55)"
                            : "rgb(var(--tv-chart-red-rgb) / 0.55)",
                      }}
                    >
                      <span className="text-[10px] font-semibold text-slate-500">
                        {monthName(i).slice(0, 3)}
                      </span>
                      <span
                        className={cn(
                          "tv-figure mt-0.5 text-[10.5px] font-semibold",
                          m.trades === 0 ? "text-slate-600" : m.pnl >= 0 ? "rp-pos" : "rp-neg",
                        )}
                      >
                        {m.trades === 0 ? "—" : compactMoney(m.pnl)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/** « +1.2k » : la case d'un mois n'a pas la place d'un montant complet. */
function compactMoney(v: number): string {
  const a = Math.abs(v);
  const s = v >= 0 ? "+" : "-";
  if (a >= 1000) return `${s}${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k`;
  return `${s}${Math.round(a)}`;
}
