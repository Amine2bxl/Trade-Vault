import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { Card, Kpi, KpiGrid, InfoTip } from "@/shared/ui";
import { useT } from "@/app/i18n/LanguageContext";
import { formatMoney } from "@/shared/currency";
import { numericText } from "@/shared/ui/NumericText";
import { histogram } from "./monteCarloViz";
import { AXIS_TICK, tooltipStyle } from "@/app/trading/chartTheme";
import type { StrategyProjection } from "@/modules/probability/strategy";

const H_DISTRIB = "h-[180px]";
export function StrategyDetails({ result }: { result: StrategyProjection }) {
  const { t } = useT();
  const { config: c, model: m } = result;
  const bins = useMemo(
    () =>
      histogram(
        result.finalPnl,
        Math.min(0, result.finalPnl[0]),
        Math.max(0, result.finalPnl.at(-1) ?? 0),
        24,
      ).map((b) => ({ ...b, probability: (b.count / result.runs) * 100 })),
    [result],
  );
  const lossProbability = result.maxDrawdowns.filter((v) => v >= c.lossLimit).length / result.runs;
  return (
    <div className="strategy-deeper">
      <KpiGrid cols={4}>
        <Kpi
          label={t("lab.netEdge")}
          value={`${result.netExpectancyR >= 0 ? "+" : ""}${result.netExpectancyR.toFixed(3)}R`}
          hint={formatMoney(result.netExpectancyR * c.risk) + " / " + t("mc.tradeWord")}
          tone={result.netExpectancyR > 0 ? "pos" : "neg"}
          adornment={<InfoTip text={t("lab.edgeHelp")} />}
        />
        <Kpi
          label={t("lab.breakEvenWR")}
          value={
            result.breakEvenWinRate === null
              ? "—"
              : `${(result.breakEvenWinRate * 100).toFixed(1)}%`
          }
          adornment={<InfoTip text={t("lab.breakevenHelp")} />}
        />
        <Kpi
          label={t("analytics.profitFactor")}
          value={
            result.netProfitFactor === null
              ? result.netExpectancyR > 0
                ? "∞"
                : "—"
              : result.netProfitFactor.toFixed(2)
          }
          adornment={<InfoTip text={t("lab.pfHelp")} />}
        />
        <Kpi
          label={t("lab.mcPrecision")}
          value={`${(result.mcInterval95.low * 100).toFixed(2)}–${(result.mcInterval95.high * 100).toFixed(2)}%`}
          adornment={<InfoTip text={t("lab.precisionHelp")} />}
        />
      </KpiGrid>
      <div className="strategy-detail-charts">
        <Card pad="tight">
          <h4 className="strategy-detail-title">{t("lab.finalDistribution")}</h4>
          <div className={H_DISTRIB}>
            <ResponsiveContainer debounce={100} width="100%" height="100%">
              <BarChart data={bins} margin={{ left: 0, right: 10, top: 12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--tv-border)" />
                <XAxis
                  dataKey="center"
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatMoney(v, { compact: true })}
                  minTickGap={35}
                />
                <YAxis
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  width={35}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  {...tooltipStyle}
                  labelFormatter={(v) => formatMoney(Number(v))}
                  formatter={(v: number) => [`${v.toFixed(1)}%`, t("lab.paths")]}
                />
                <Bar dataKey="probability" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                  {bins.map((bin, i) => (
                    <Cell
                      key={i}
                      fill={bin.center < 0 ? "var(--tv-chart-red)" : "var(--tv-chart-green)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card pad="tight">
          <h4 className="strategy-detail-title">{t("lab.ddExceedance")}</h4>
          <div className={H_DISTRIB}>
            <ResponsiveContainer debounce={100} width="100%" height="100%">
              <AreaChart
                data={result.drawdownExceedance.map((p) => ({
                  ...p,
                  probability: p.probability * 100,
                }))}
                margin={{ left: 0, right: 10, top: 12, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="var(--tv-border)" />
                <XAxis
                  dataKey="amount"
                  type="number"
                  domain={[0, "dataMax"]}
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatMoney(v, { compact: true })}
                  minTickGap={35}
                />
                <YAxis
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  width={35}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  {...tooltipStyle}
                  labelFormatter={(v) => formatMoney(Number(v))}
                  formatter={(v: number) => [`${v.toFixed(1)}%`, t("lab.exceeds")]}
                />
                <ReferenceLine x={c.lossLimit} stroke="var(--tv-chart-red)" strokeDasharray="3 3" />
                <Area
                  dataKey="probability"
                  type="linear"
                  stroke="var(--tv-chart-red)"
                  fill="var(--tv-chart-red)"
                  fillOpacity={0.1}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="tv-prose text-slate-400">
            {numericText(
              t("lab.ddReading")
                .replace("{p}", (lossProbability * 100).toFixed(1))
                .replace("{dd}", formatMoney(c.lossLimit)),
            )}
          </p>
        </Card>
      </div>
      <div className="strategy-explanations">
        <p>
          {numericText(
            t("lab.lossRunReading")
              .replace("{n}", String(Math.round(result.longestStreak95)))
              .replace("{r}", formatMoney(c.risk * result.longestStreak95)),
          )}
        </p>
        <p>
          {numericText(
            t("lab.edgeReading")
              .replace("{w}", (m.metrics.winRate * 100).toFixed(1))
              .replace(
                "{b}",
                result.breakEvenWinRate === null ? "—" : (result.breakEvenWinRate * 100).toFixed(1),
              ),
          )}
        </p>
      </div>
    </div>
  );
}
