import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  AXIS_TICK,
  EQUITY_ANIMATION,
  EQUITY_CURVE_TYPE,
  EQUITY_GRID,
  EQUITY_LINE,
  formatAxisMoney,
  tooltipStyle,
  glowActiveDot,
  equityYDomain,
  EQUITY_X_PADDING,
} from "../utils/chartTheme";
import { formatShortDate } from "../utils/tradeCalcs";

// Equity curve chart, split into its own module so `recharts` (~150-200 KB)
// loads on demand instead of sitting in the eager Dashboard chunk.
//
// Visual language: institutional, not decorative. One solid accent stroke, a
// faint area wash, a hairline horizontal grid and a single break-even
// reference. No gradient stroke, no drop-shadow, no breathing glow — the shape
// of the curve is the only thing asking for attention.
export default function EquityChart({ data }: { data: { date: string; equity: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--tv-accent)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--tv-accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...EQUITY_GRID} />
        <XAxis
          dataKey="date"
          padding={EQUITY_X_PADDING}
          tick={AXIS_TICK}
          minTickGap={28}
          tickFormatter={(v) => {
            const p = v.split("-");
            return `${p[2]}/${p[1]}`;
          }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={equityYDomain}
          tick={AXIS_TICK}
          tickFormatter={formatAxisMoney}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <ReferenceLine y={0} stroke="rgba(148,163,184,0.28)" strokeWidth={1} />
        <Tooltip
          {...tooltipStyle}
          formatter={(value: number) => [`$${Number(value).toFixed(2)}`, "Equity"]}
          labelFormatter={(v) => formatShortDate(v as string)}
        />
        <Area
          type={EQUITY_CURVE_TYPE}
          dataKey="equity"
          stroke="var(--tv-accent)"
          fill="url(#eqGrad)"
          dot={false}
          activeDot={glowActiveDot("var(--tv-accent)")}
          {...EQUITY_LINE}
          {...EQUITY_ANIMATION}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
