import { Bot, AlertTriangle, Brain, BarChart3, TrendingUp } from "lucide-react";
import { useLandingT } from "./i18n";

/**
 * FeaturesBento — grille bento des capacités qui font la différence.
 */

export function FeaturesBento() {
  const { t } = useLandingT();

  const mistakes = [
    { name: "Revenge trading", count: "7×", cost: "-$1,240", pct: 82 },
    { name: "FOMO entry", count: "12×", cost: "-$890", pct: 58 },
    { name: "Overtrading", count: "9×", cost: "-$670", pct: 42 },
  ];

  const metrics = [
    { l: "Win rate", v: "64%" },
    { l: "Profit Factor", v: "2.31" },
    { l: "Expectancy", v: "+0.68R" },
    { l: "Sharpe", v: "1.84" },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {/* ── 1 · Jarvis — le coach (large) ── */}
      <div className="glass-card col-span-full overflow-hidden sm:col-span-2 lg:col-span-3">
        <div className="flex h-full flex-col">
          <div className="px-6 pt-6">
            <div className="flex items-center gap-3">
              <div className="feat-icon h-10 w-10">
                <Bot className="h-5 w-5" />
              </div>
              <h2 className="font-display text-lg font-bold text-white">{t("bento.jarvis.t")}</h2>
            </div>
            <p className="mt-2.5 text-[13px] leading-6 text-slate-400">{t("bento.jarvis.d")}</p>
          </div>
          <div className="mt-auto space-y-2 px-6 py-5">
            <div className="max-w-[85%] rounded-xl rounded-bl-md border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-[11px] leading-5 text-slate-300">
              <span className="font-bold text-red-300">{t("bento.jarvis.pattern")}</span>{" "}
              {t("bento.jarvis.msg")}
            </div>
            <div className="ml-auto max-w-[70%] rounded-xl rounded-br-md tv-accent-fill px-3.5 py-2.5 text-[11px] font-medium">
              {t("bento.jarvis.q")}
            </div>
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.05] px-3.5 py-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                {t("bento.jarvis.mission")}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-200">{t("bento.jarvis.mission.d")}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2 · Détection d'erreurs ── */}
      <div className="glass-card col-span-full overflow-hidden sm:col-span-1 lg:col-span-3">
        <div className="px-6 pt-6 pb-6">
          <div className="flex items-center gap-3">
            <div className="feat-icon h-10 w-10">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2 className="font-display text-lg font-bold text-white">{t("bento.errors.t")}</h2>
          </div>
          <p className="mt-2.5 text-[13px] leading-6 text-slate-400">{t("bento.errors.d")}</p>
          <div className="mt-5 space-y-2">
            {mistakes.map((m) => (
              <div
                key={m.name}
                className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-medium text-slate-200">{m.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {m.count} {t("bento.errors.thismonth")}
                  </div>
                </div>
                <div className="ml-3 shrink-0 text-right">
                  <div className="text-[11px] font-bold tabular-nums text-red-400">{m.cost}</div>
                  <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className="h-full rounded-full bg-red-500/60"
                      style={{ width: `${m.pct}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 3 · Edge Score ── */}
      <div className="glass-card col-span-full overflow-hidden sm:col-span-1 lg:col-span-2">
        <div className="px-6 pt-6 pb-6 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="feat-icon h-10 w-10">
              <Brain className="h-5 w-5" />
            </div>
            <h2 className="font-display text-lg font-bold text-white">{t("bento.edge.t")}</h2>
          </div>
          <p className="mt-2.5 text-[13px] leading-6 text-slate-400">{t("bento.edge.d")}</p>
          <div className="relative mx-auto mt-6 flex h-28 w-28 items-center justify-center">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="10"
              />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="var(--tv-highlight)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray="326"
                strokeDashoffset={326 - 326 * 0.78}
              />
            </svg>
            <span className="absolute font-display text-2xl font-bold text-cyan-300">78</span>
          </div>
          <div className="mt-3 text-[11px] font-semibold text-emerald-400">
            {t("bento.edge.ready")}
          </div>
        </div>
      </div>

      {/* ── 4 · Analytics pro ── */}
      <div className="glass-card col-span-full overflow-hidden sm:col-span-1 lg:col-span-2">
        <div className="px-6 pt-6 pb-6">
          <div className="flex items-center gap-3">
            <div className="feat-icon h-10 w-10">
              <BarChart3 className="h-5 w-5" />
            </div>
            <h2 className="font-display text-lg font-bold text-white">{t("bento.analytics.t")}</h2>
          </div>
          <p className="mt-2.5 text-[13px] leading-6 text-slate-400">{t("bento.analytics.d")}</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {metrics.map((s) => (
              <div
                key={s.l}
                className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5 text-center"
              >
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {s.l}
                </div>
                <div className="mt-0.5 tv-figure text-sm text-cyan-300">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 5 · Progression ── */}
      <div className="glass-card col-span-full overflow-hidden sm:col-span-2 lg:col-span-2">
        <div className="px-6 pt-6 pb-6">
          <div className="flex items-center gap-3">
            <div className="feat-icon h-10 w-10">
              <TrendingUp className="h-5 w-5" />
            </div>
            <h2 className="font-display text-lg font-bold text-white">{t("bento.progress.t")}</h2>
          </div>
          <p className="mt-2.5 text-[13px] leading-6 text-slate-400">{t("bento.progress.d")}</p>
          <div className="mt-5">
            <div className="flex items-baseline gap-2">
              <span className="tv-figure text-xl text-emerald-400">+$4,218.50</span>
              <span className="text-[11px] font-bold text-emerald-400/70">+16.9%</span>
            </div>
            <svg viewBox="0 0 320 80" className="mt-3 h-16 w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="featEq" x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor="var(--tv-highlight)" stopOpacity="0.18" />
                  <stop offset="1" stopColor="var(--tv-highlight)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon
                points="0,70 40,56 80,62 120,40 160,50 200,28 240,38 280,18 320,10 320,80 0,80"
                fill="url(#featEq)"
              />
              <polyline
                points="0,70 40,56 80,62 120,40 160,50 200,28 240,38 280,18 320,10"
                fill="none"
                stroke="var(--tv-highlight)"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
