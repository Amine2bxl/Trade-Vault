import { Bot, Shield, BarChart3, TrendingUp, AlertTriangle, Brain } from "lucide-react";

/**
 * FeaturesBento — grille bento des capacités qui font la différence.
 *
 * On ne liste pas des fonctionnalités : on montre les 5 choses qui créent
 * réellement de la valeur pour le trader — Jarvis (coach), la détection
 * d'erreurs, l'Edge Score, les analytics R-multiple, et la progression.
 */

export function FeaturesBento() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {/* ── 1 · Jarvis — le coach (large) ── */}
      <div className="glass relative col-span-full overflow-hidden rounded-2xl border border-white/[0.06] sm:col-span-2 lg:col-span-3">
        <div className="flex flex-col h-full">
          <div className="px-6 pt-6">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 shadow-lg shadow-cyan-500/20">
                <Bot className="w-4.5 h-4.5 text-white" />
              </div>
              <h2 className="font-display text-lg font-bold text-white">Jarvis, ton coach IA</h2>
            </div>
            <p className="mt-2 text-xs text-slate-500 leading-5">
              Un coach qui lit chacun de tes trades et te dit exactement quoi corriger.
            </p>
          </div>
          {/* Mini conversation */}
          <div className="px-6 py-4 mt-auto space-y-2">
            <div className="max-w-[85%] rounded-xl rounded-bl-md bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-[11px] text-slate-300">
              <span className="text-red-300 font-bold">Pattern détecté :</span> tes pertes sont 2.4× plus grandes après 2 gains. Excès de confiance.
            </div>
            <div className="max-w-[70%] ml-auto rounded-xl rounded-br-md bg-gradient-to-r from-cyan-500 to-teal-500 px-3 py-2 text-[11px] text-white font-medium">
              Comment je corrige ça demain ?
            </div>
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.05] px-3 py-2 text-[10px]">
              <span className="text-emerald-400 font-bold uppercase text-[9px] tracking-wider">Mission du jour</span>
              <div className="text-slate-200 mt-0.5">2 trades max · stop après 1 perte</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2 · Détection d'erreurs ── */}
      <div className="glass relative col-span-full overflow-hidden rounded-2xl border border-white/[0.06] sm:col-span-1 lg:col-span-3">
        <div className="flex flex-col h-full px-6 pt-6 pb-6">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-red-500/15 border border-red-500/20">
              <AlertTriangle className="w-4.5 h-4.5 text-red-400" />
            </div>
            <h2 className="font-display text-lg font-bold text-white">Erreurs détectées</h2>
          </div>
          <p className="mt-2 text-xs text-slate-500 leading-5">TradeVault repère automatiquement ce qui te coûte de l'argent.</p>
          <div className="mt-4 space-y-2">
            {[
              { name: "Revenge trading", count: "7×", cost: "-$1,240", pct: 82 },
              { name: "FOMO entry", count: "12×", cost: "-$890", pct: 58 },
              { name: "Overtrading", count: "9×", cost: "-$670", pct: 42 },
            ].map((m) => (
              <div key={m.name} className="flex items-center justify-between rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-slate-200 truncate">{m.name}</div>
                  <div className="text-[10px] text-slate-500">{m.count} ce mois-ci</div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className="text-[11px] font-bold text-red-400 tabular-nums">{m.cost}</div>
                  <div className="w-16 h-1 rounded-full bg-white/[0.05] overflow-hidden mt-1">
                    <div className="h-full rounded-full bg-red-500/60" style={{ width: `${m.pct}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 3 · Edge Score ── */}
      <div className="glass relative col-span-full overflow-hidden rounded-2xl border border-white/[0.06] sm:col-span-1 lg:col-span-2">
        <div className="px-6 pt-6 pb-6 text-center">
          <div className="flex items-center justify-center gap-2.5">
            <Brain className="w-4.5 h-4.5 text-cyan-400" />
            <h2 className="font-display text-lg font-bold text-white">Edge Score</h2>
          </div>
          <p className="mt-2 text-xs text-slate-500 leading-5">Un score qui te dit si tu es prêt à trader.</p>
          {/* Circular gauge */}
          <div className="relative mx-auto mt-5 flex h-28 w-28 items-center justify-center">
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

      {/* ── 4 · Analytics R-multiple ── */}
      <div className="glass relative col-span-full overflow-hidden rounded-2xl border border-white/[0.06] sm:col-span-1 lg:col-span-2">
        <div className="px-6 pt-6 pb-6">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-4.5 h-4.5 text-cyan-400" />
            <h2 className="font-display text-lg font-bold text-white">Analytics pro</h2>
          </div>
          <p className="mt-2 text-xs text-slate-500 leading-5">20+ métriques calculées sur tes données réelles.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              { l: "Win rate", v: "64%" },
              { l: "Profit Factor", v: "2.31" },
              { l: "Expectancy", v: "+0.68R" },
              { l: "Sharpe", v: "1.84" },
            ].map((s) => (
              <div key={s.l} className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2 text-center">
                <div className="text-[9px] uppercase font-bold text-slate-500">{s.l}</div>
                <div className="font-display text-sm font-extrabold text-cyan-300 tabular-nums mt-0.5">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 5 · Progression (courbe equity) ── */}
      <div className="glass relative col-span-full overflow-hidden rounded-2xl border border-white/[0.06] sm:col-span-2 lg:col-span-2">
        <div className="px-6 pt-6 pb-6">
          <div className="flex items-center gap-2.5">
            <TrendingUp className="w-4.5 h-4.5 text-cyan-400" />
            <h2 className="font-display text-lg font-bold text-white">Ta progression</h2>
          </div>
          <p className="mt-2 text-xs text-slate-500 leading-5">Vois ton capital évoluer et ta discipline s'améliorer.</p>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-xl font-extrabold text-emerald-400 tabular-nums">+$4,218.50</span>
              <span className="text-[11px] font-bold text-emerald-400/70">+16.9%</span>
            </div>
            <svg viewBox="0 0 320 80" className="mt-2 w-full h-16" preserveAspectRatio="none">
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
