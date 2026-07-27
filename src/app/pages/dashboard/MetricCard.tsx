import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

// A richer dashboard metric card: a headline value paired with either a radial
// gauge (bounded metrics) or a sparkline (trend metrics), plus a folded-in
// secondary stat in the footer. Pure SVG — no chart lib, so it stays in the
// eager Dashboard chunk without weight.

interface BaseProps {
  icon: ReactNode;
  label: string;
  value: string;
  /** Tailwind text-color class for the headline value. */
  valueClass?: string;
  /** Folded secondary stat (e.g. current streak, avg win/loss). */
  footerLabel: string;
  footerValue: string;
  footerClass?: string;
  delay?: number;
}

type Visual =
  | { kind: "radial"; pct: number; color: string; center?: string }
  | { kind: "spark"; data: number[]; color: string };

type MetricCardProps = BaseProps & { visual: Visual };

function Radial({ pct, color, center }: { pct: number; color: string; center?: string }) {
  const R = 26;
  const C = 2 * Math.PI * R;
  const p = Math.max(0, Math.min(1, pct));
  return (
    <div className="relative w-[64px] h-[64px] shrink-0">
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
          <span className="text-[10px] font-bold tabular-nums text-slate-300">{center}</span>
        </div>
      )}
    </div>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) {
    return <div className="w-[64px] h-[64px] shrink-0" />;
  }
  const W = 64;
  const H = 40;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = W / (data.length - 1);
  const pts = data.map((v, i) => [i * step, H - ((v - min) / range) * H] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `0,${H} ${line} ${W},${H}`;
  const gid = `spark-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <div className="w-[64px] shrink-0 self-center">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-10 overflow-visible">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#${gid})`} />
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

export default function MetricCard({
  icon,
  label,
  value,
  valueClass,
  footerLabel,
  footerValue,
  footerClass,
  visual,
  delay = 0,
}: MetricCardProps) {
  return (
    <div
      className="glass rounded-2xl p-4 card-premium animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">
            <span className="text-cyan-400/60">{icon}</span>
            <span className="truncate">{label}</span>
          </div>
          <div className={cn("font-display text-2xl md:text-[26px] font-extrabold tabular-nums leading-none", valueClass)}>
            {value}
          </div>
        </div>
        {visual.kind === "radial" ? (
          <Radial pct={visual.pct} color={visual.color} center={visual.center} />
        ) : (
          <Sparkline data={visual.data} color={visual.color} />
        )}
      </div>
      <div className="mt-3 pt-2.5 border-t border-white/[0.05] flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
          {footerLabel}
        </span>
        <span className={cn("text-xs font-bold tabular-nums", footerClass ?? "text-slate-300")}>
          {footerValue}
        </span>
      </div>
    </div>
  );
}
