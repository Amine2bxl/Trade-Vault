import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import {
  EQUITY_ANIMATION,
  EQUITY_LINE,
  tooltipStyle,
  glowActiveDot,
  equityYDomain,
  EQUITY_X_PADDING,
} from "../utils/chartTheme";
import { formatShortDate } from "../utils/tradeCalcs";

// Equity curve chart, split into its own module so `recharts` (~150-200 KB)
// loads on demand instead of sitting in the eager Dashboard chunk. Behaviour
// and visuals are identical to the previous inline chart — only the bundle
// boundary changed.
export default function EquityChart({ data }: { data: { date: string; equity: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--tv-highlight)" stopOpacity={0.4} />
            <stop offset="55%" stopColor="var(--tv-accent)" stopOpacity={0.12} />
            <stop offset="100%" stopColor="var(--tv-accent)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="eqStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--tv-accent)" />
            <stop offset="100%" stopColor="var(--tv-highlight)" />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          padding={EQUITY_X_PADDING}
          tick={{ fill: "#475569", fontSize: 10 }}
          tickFormatter={(v) => {
            const p = v.split("-");
            return `${p[1]}/${p[0].slice(2)}`;
          }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={equityYDomain}
          tick={{ fill: "#475569", fontSize: 10 }}
          tickFormatter={(v) => `$${v}`}
          axisLine={false}
          tickLine={false}
          width={45}
        />
        <ReferenceLine y={0} stroke="#334155" strokeDasharray="4 4" />
        <Tooltip
          {...tooltipStyle}
          formatter={(value: number) => [`$${Number(value).toFixed(2)}`, "Equity"]}
          labelFormatter={(v) => formatShortDate(v as string)}
        />
        <Area
          type="natural"
          dataKey="equity"
          stroke="url(#eqStroke)"
          fill="url(#eqGrad)"
          dot={false}
          activeDot={glowActiveDot("var(--tv-highlight)")}
          style={{ filter: "drop-shadow(0 3px 8px rgb(var(--tv-highlight-rgb) / 0.4))" }}
          {...EQUITY_LINE}
          {...EQUITY_ANIMATION}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
