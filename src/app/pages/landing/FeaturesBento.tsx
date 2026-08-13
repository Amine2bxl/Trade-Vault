import { Bot, AlertTriangle, Brain, BarChart3, TrendingUp } from "lucide-react";

/**
 * FeaturesBento — grille bento des capacités qui font la différence.
 *
 * Chaque carte utilise la même surface `.glass-card` que le reste de la
 * landing (glassmorphism + hover lift cyan), les mêmes rayons, les mêmes
 * icônes `.feat-icon` et la même typographie `font-display`.
 */

export function FeaturesBento() {
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
              <h2 className="font-display text-lg font-bold text-white">Jarvis, ton coach IA</h2>
            </div>
            <p className="mt-2.5 text-[13px] leading-6 text-slate-400">
              Un coach qui lit chacun de tes trades et te dit exactement quoi corriger.
            </p>
          </div>
          {/* Mini conversation */}
          <div className="mt-auto space-y-2 px-6 py-5">
            <div className="max-w-[85%] rounded-xl rounded-bl-md border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-[11px] leading-5 text-slate-300">
              <span className="font-bold text-red-300">Pattern détecté :</span> tes pertes sont 2.4× plus grandes
              après 2 gains. Excès de confiance.
            </div>
            <div className="ml-auto max-w-[70%] rounded-xl rounded-br-md bg-gradient-to-r from-cyan-500 to-teal-500 px-3.5 py-2.5 text-[11px] font-medium text-white">
              Comment je corrige ça demain ?
            </div>
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.05] px-3.5 py-2.5">
              <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">Mission du jour</div>
              <div className="mt-0.5 text-[11px] text-slate-200">2 trades max · stop après 1 perte</div>
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
            <h2 className="font-display text-lg font-bold text-white">Erreurs détectées</h2>
          </div>
          <p className="mt-2.5 text-[13px] leading-6 text-slate-400">
            TradeVault repère automatiquement ce qui te coûte de l'argent.
          </p>
          <div className="mt-5 space-y-2">
            {[
              { name: "Revenge trading", count: "7×", cost: "-$1,240", pct: 82 },
              { name: "FOMO entry", count: "12×", cost: "-$890", pct: 58 },
              { name: "Overtrading", count: "9×", cost: "-$670", pct: 42 },
            ].map((m) => (
              <div key={m.name} className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-medium text-slate-200">{m.name}</div>
                  <div className="text-[10px] text-slate-500">{m.count} ce mois-ci</div>
                </div>
                <div className="ml-3 shrink-0 text-right">
                  <div className="text-[11px] font-bold tabular-nums text-red-400">{m.cost}</div>
                  <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-white/[0.05]">
                    <div className="h-full rounded-full bg-red-500/60" style={{ width: `${m.pct}%` }} />
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
            <h2 className="font-display text-lg font-bold text-white">Edge Score</h2>
          </div>
          <p className="mt-2.5 text-[13px] leading-6 text-slate-400">
            Un score qui te dit si tu es prêt à trader.
          </p>
          <div className="relative mx-auto mt-6 flex h-28 w-28 items-center justify-center">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
              <circle cx="60" cy="60" r="52" fill="none" stroke="#22d3ee" strokeWidth="10" strokeLinecap="round"
                strokeDasharray="326" strokeDashoffset={326 - 326 * 0.78} style={{ filter: "drop-shadow(0 0 6px rgba(34,211,238,0.5))" }} />
            </svg>
            <span className="absolute font-display text-2xl font-extrabold text-cyan-300">78</span>
          </div>
          <div className="mt-3 text-[11px] font-semibold text-emerald-400">Ready to trade</div>
        </div>
      </div>

      {/* ── 4 · Analytics pro ── */}
      <div className="glass-card col-span-full overflow-hidden sm:col-span-1 lg:col-span-2">
        <div className="px-6 pt-6 pb-6">
          <div className="flex items-center gap-3">
            <div className="feat-icon h-10 w-10">
              <BarChart3 className="h-5 w-5" />
            </div>
            <h2 className="font-display text-lg font-bold text-white">Analytics pro</h2>
          </div>
          <p className="mt-2.5 text-[13px] leading-6 text-slate-400">
            20+ métriques calculées sur tes données réelles.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {[
              { l: "Win rate", v: "64%" },
              { l: "Profit Factor", v: "2.31" },
              { l: "Expectancy", v: "+0.68R" },
              { l: "Sharpe", v: "1.84" },
            ].map((s) => (
              <div key={s.l} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5 text-center">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{s.l}</div>
                <div className="mt-0.5 font-display text-sm font-extrabold tabular-nums text-cyan-300">{s.v}</div>
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
            <h2 className="font-display text-lg font-bold text-white">Ta progression</h2>
          </div>
          <p className="mt-2.5 text-[13px] leading-6 text-slate-400">
            Vois ton capital évoluer et ta discipline s'améliorer.
          </p>
          <div className="mt-5">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-xl font-extrabold tabular-nums text-emerald-400">+$4,218.50</span>
              <span className="text-[11px] font-bold text-emerald-400/70">+16.9%</span>
            </div>
            <svg viewBox="0 0 320 80" className="mt-3 h-16 w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="featEq" x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor="#22d3ee" stopOpacity="0.18" />
                  <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points="0,70 40,56 80,62 120,40 160,50 200,28 240,38 280,18 320,10 320,80 0,80" fill="url(#featEq)" />
              <polyline points="0,70 40,56 80,62 120,40 160,50 200,28 240,38 280,18 320,10" fill="none" stroke="#22d3ee" strokeWidth="2" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
