import { memo, useMemo } from "react";
import {
  AreaChart,
  Area,
  Line,
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
  formatAxisMoney,
  equityYDomain,
  EQUITY_X_PADDING,
} from "../utils/chartTheme";
import { formatShortDate } from "../utils/tradeCalcs";

type EquityPoint = { date: string; equity: number };

function EquityChart({ data }: { data: EquityPoint[] }) {
  const { min, max, breakEven, keyDots } = useMemo(() => {
    if (data.length === 0)
      return { min: 0, max: 0, breakEven: 0, keyDots: {} as Record<number, boolean> };
    let lo = data[0].equity;
    let hi = data[0].equity;
    let bestIdx = 0;
    let worstIdx = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i].equity > hi) {
        hi = data[i].equity;
        bestIdx = i;
      }
      if (data[i].equity < lo) {
        lo = data[i].equity;
        worstIdx = i;
      }
    }
    const keyDots: Record<number, boolean> = {};
    if (data.length >= 2) {
      keyDots[0] = true;
      keyDots[data.length - 1] = true;
    }
    if (bestIdx > 0 && bestIdx < data.length - 1) keyDots[bestIdx] = true;
    if (worstIdx > 0 && worstIdx < data.length - 1 && worstIdx !== bestIdx)
      keyDots[worstIdx] = true;
    return { min: lo, max: hi, breakEven: data[0].equity, keyDots };
  }, [data]);

  const gain = data.length > 0 && data[data.length - 1].equity >= data[0].equity;
  const accent = gain ? "var(--tv-accent)" : "#ef4444";

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 20, right: 20, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.18} />
            <stop offset="100%" stopColor={accent} stopOpacity={0} />
          </linearGradient>
          <filter id="dotGlow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.5)" />
          </filter>
        </defs>
        <CartesianGrid stroke="rgba(148,163,184,0.07)" strokeDasharray="4 12" vertical={false} />
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
        <ReferenceLine
          y={breakEven}
          stroke="rgba(148,163,184,0.22)"
          strokeWidth={1}
          strokeDasharray="6 6"
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const val = payload[0].value as number;
            const delta = val - breakEven;
            return (
              <div
                className="rounded-xl border border-white/[0.08] px-3 py-2"
                style={{
                  background: "rgba(10,15,30,0.98)",
                  boxShadow: "0 12px 32px -8px rgba(0,0,0,0.7)",
                }}
              >
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  {formatShortDate(label as string)}
                </p>
                <p
                  className="mt-0.5 text-sm font-extrabold text-white tabular-nums"
                  style={{ fontFamily: "'IBM Plex Sans',sans-serif" }}
                >
                  $
                  {Number(val).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <p
                  className={
                    delta >= 0
                      ? "text-[11px] text-emerald-400 font-semibold"
                      : "text-[11px] text-red-400 font-semibold"
                  }
                >
                  {delta >= 0 ? "+" : ""}
                  {delta >= 0 ? "$" : "-$"}
                  {Math.abs(delta).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            );
          }}
        />
        <Area
          type={EQUITY_CURVE_TYPE}
          dataKey="equity"
          stroke={accent}
          strokeWidth={2}
          fill="url(#eqGrad)"
          dot={false}
          activeDot={{
            r: 5,
            strokeWidth: 2.5,
            stroke: "#0a0f1e",
            fill: accent,
            filter: "url(#dotGlow)",
          }}
          {...EQUITY_ANIMATION}
        />
        <Line
          type={EQUITY_CURVE_TYPE}
          dataKey="equity"
          stroke="transparent"
          dot={(props: { cx: number; cy: number; index: number }) => {
            if (!keyDots[props.index]) return <g key={`dot-${props.index}`} />;
            const isPositive = data[props.index].equity >= breakEven;
            return (
              <circle
                key={`dot-${props.index}`}
                cx={props.cx}
                cy={props.cy}
                r={6}
                fill={isPositive ? accent : "#ef4444"}
                stroke="#0a0f1e"
                strokeWidth={2.5}
                filter="url(#dotGlow)"
              />
            );
          }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default memo(EquityChart);
