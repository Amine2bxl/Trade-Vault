import { TrendingUp, AlertTriangle, AlertOctagon, Info, ArrowRight } from "lucide-react";
import type { Insight } from "../utils/insights";
import { cn } from "../utils/cn";

/**
 * InsightList — the "so what" block. Renders ranked verdicts with their next
 * action, so a page stops being a wall of numbers and starts telling the trader
 * what to do. Nothing renders when there is nothing honest to say.
 */

const TONE = {
  good: { ring: "border-emerald-500/20 bg-emerald-500/[0.05]", text: "text-emerald-400", Icon: TrendingUp },
  warn: { ring: "border-amber-500/20 bg-amber-500/[0.05]", text: "text-amber-400", Icon: AlertTriangle },
  bad: { ring: "border-red-500/20 bg-red-500/[0.05]", text: "text-red-400", Icon: AlertOctagon },
  neutral: { ring: "border-white/[0.07] bg-white/[0.02]", text: "text-slate-400", Icon: Info },
} as const;

export default function InsightList({
  insights,
  title,
  max = 4,
  className,
}: {
  insights: Insight[];
  title: string;
  max?: number;
  className?: string;
}) {
  if (insights.length === 0) return null;
  return (
    <section className={cn("animate-fade-in-up", className)}>
      <h2 className="mb-2.5 text-[11px] uppercase tracking-wider font-semibold text-slate-500">
        {title}
      </h2>
      <div className="grid gap-2.5 md:grid-cols-2">
        {insights.slice(0, max).map((i) => {
          const tone = TONE[i.tone];
          return (
            <div key={i.id} className={cn("rounded-2xl border px-3.5 py-3", tone.ring)}>
              <div className="flex items-start gap-2.5">
                <tone.Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone.text)} />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-snug text-slate-100">{i.title}</p>
                  {i.action && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-snug text-slate-400">
                      <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-slate-600" />
                      {i.action}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
