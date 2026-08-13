import type { ReactNode } from "react";
import { cn } from "./cn";
import { density, type } from "./tokens";

/**
 * Metric — the single KPI tile of the product (label / big tabular number /
 * optional context). One primitive covers every stat surface:
 *
 *   • plain    → label + value + subtitle (compact stat)
 *   • `visual` → adds a radial gauge or a sparkline beside the value
 *   • `footer` → folds a secondary stat under a hairline separator
 *
 * `trend` drives the semantic colour (profit / loss / accent).
 */

export type MetricVisual =
  | { kind: "radial"; pct: number; color: string; center?: string }
  | { kind: "spark"; data: number[]; color: string }
  | { kind: "bar"; pct: number; color?: string };

export interface MetricProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  /** Optional gauge/sparkline rendered beside the value. */
  visual?: MetricVisual;
  /** Optional secondary stat folded into the tile footer. */
  footer?: { label: string; value: string; className?: string };
  /** Explicit colour class for the value (overrides `trend`). */
  valueClass?: string;
  /** Entrance stagger delay in ms. */
  delay?: number;
}

function trendClass(trend: MetricProps["trend"]) {
  return trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-white";
}

/** Radial progress dial (0..1). Pure SVG — no chart lib. */
function Radial({ pct, color, center }: { pct: number; color: string; center?: string }) {
  const R = 26;
  const C = 2 * Math.PI * R;
  const p = Math.max(0, Math.min(1, pct));
  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
        <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - p)}
          style={{ transition: "stroke-dashoffset 800ms cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      {center && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-bold tabular-nums text-slate-300">{center}</span>
        </div>
      )}
    </div>
  );
}

/** Horizontal progress bar (0..1). */
function ProgressBar({ pct, color }: { pct: number; color?: string }) {
  const p = Math.max(0, Math.min(1, pct));
  return (
    <div className="w-16 shrink-0 self-center">
      <div className="metric-bar">
        <div className="metric-bar-fill" style={{ width: `${p * 100}%`, background: color }} />
      </div>
    </div>
  );
}

/** Trend sparkline. Pure SVG — no chart lib. */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <div className="w-16 shrink-0" />;
  const W = 64;
  const H = 40;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = W / (data.length - 1);
  const pts = data.map((v, i) => [i * step, H - ((v - min) / range) * H] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const gid = `mspark-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <div className="w-16 shrink-0 self-center">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-10 overflow-visible">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon points={`0,${H} ${line} ${W},${H}`} fill={`url(#${gid})`} />
        <polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2" fill={color} />
      </svg>
    </div>
  );
}

export function Metric({
  title,
  value,
  subtitle,
  icon,
  trend,
  visual,
  footer,
  valueClass,
  delay = 0,
}: MetricProps) {
  return (
    <div
      className={cn("stat-card card-premium animate-fade-in-up", density.cardPad)}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1.5">
            {icon && (
              <span className={cn("shrink-0", trend ? trendClass(trend) : "text-cyan-400/70")}>
                {icon}
              </span>
            )}
            <span className={cn(type.label, "text-slate-500 truncate")}>{title}</span>
          </div>
          <div
            className={cn(
              "font-display text-xl md:text-[26px] font-extrabold tracking-tight tabular-nums leading-none",
              valueClass ?? trendClass(trend),
            )}
          >
            {value}
          </div>
          {subtitle && (
            <p className={cn(type.caption, "text-slate-500 mt-1 truncate")}>{subtitle}</p>
          )}
        </div>
        {visual?.kind === "radial" && (
          <Radial pct={visual.pct} color={visual.color} center={visual.center} />
        )}
        {visual?.kind === "spark" && <Sparkline data={visual.data} color={visual.color} />}
        {visual?.kind === "bar" && <ProgressBar pct={visual.pct} color={visual.color} />}
      </div>
      {footer && (
        <div className="mt-3 pt-2.5 border-t border-white/[0.05] flex items-center justify-between">
          <span className={cn(type.label, "text-slate-500")}>{footer.label}</span>
          <span
            className={cn("text-xs font-bold tabular-nums", footer.className ?? "text-slate-300")}
          >
            {footer.value}
          </span>
        </div>
      )}
    </div>
  );
}
