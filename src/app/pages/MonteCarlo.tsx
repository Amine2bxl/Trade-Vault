import { useState, useMemo, useCallback } from "react";
import { BarChart3, Play, Loader2, Zap, TrendingUp, TrendingDown, Target, AlertTriangle, RefreshCw, ChevronDown } from "lucide-react";
import { Trade, isBreakEven } from "../types";
import { formatPnl, formatPct } from "../utils/tradeCalcs";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import { PageHeader } from "@/shared/ui";
import {
  runMonteCarlo,
  sensitivityAnalysis,
  prepareTradeSamples,
  computeSampleStats,
  type MonteCarloInput,
  type MonteCarloOutput,
  type TradeSample,
} from "../utils/monteCarlo";
import { findFirm, findChallenge, formatMoney, type PropChallenge } from "../utils/propFirms";

interface Props { trades: Trade[]; }

const SIM_OPTIONS = [100, 500, 1000, 5000, 10000];

export default function MonteCarloPage({ trades }: Props) {
  const { t } = useT();

  // Data
  const samples = useMemo(() => prepareTradeSamples(trades), [trades]);
  const stats = useMemo(() => computeSampleStats(samples), [samples]);

  // Challenge selection
  const [firmId, setFirmId] = useState("apex");
  const [challengeId, setChallengeId] = useState("apex-50k");
  const challenge = useMemo(() => findChallenge(challengeId), [challengeId]);
  const firm = useMemo(() => findFirm(firmId), [firmId]);

  // Simulation
  const [simCount, setSimCount] = useState(1000);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MonteCarloOutput | null>(null);
  const [sensResult, setSensResult] = useState<ReturnType<typeof sensitivityAnalysis> | null>(null);

  const handleRun = useCallback(() => {
    if (!challenge || samples.length < 5) return;
    setRunning(true);
    const t0 = performance.now();
    setTimeout(() => {
      const input: MonteCarloInput = {
        samples,
        startingBalance: challenge.startingBalance,
        profitTarget: challenge.profitTarget,
        maxDrawdown: challenge.maxDrawdown,
        maxDailyLoss: challenge.maxDailyLoss,
        maxTradingDays: challenge.maxTradingDays,
        maxTradesPerDay: Math.min(challenge.maxTradesPerDay, 5),
        trailingDrawdown: challenge.trailingDrawdown,
        simulations: simCount,
      };
      const output = runMonteCarlo(input);
      setResult(output);
      if (trades.length >= 20) {
        setSensResult(sensitivityAnalysis(input, 1000));
      }
      setRunning(false);
    }, 50);
  }, [challenge, samples, simCount, trades.length]);

  const selectFirm = (fId: string) => {
    const f = findFirm(fId);
    if (f && f.challenges.length > 0) {
      setFirmId(fId);
      setChallengeId(f.challenges[0].id);
      setResult(null);
      setSensResult(null);
    }
  };

  if (trades.length === 0) {
    return (
      <div className="p-4 md:p-5 max-w-[1200px] mx-auto">
        <PageHeader title="Monte Carlo Lab" subtitle="Simule des milliers de scénarios à partir de tes performances réelles" />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-5">
            <BarChart3 className="w-7 h-7 text-cyan-400" />
          </div>
          <h3 className="text-base font-bold text-white mb-1.5">Ton Monte Carlo commence avec tes données</h3>
          <p className="text-sm text-slate-500 max-w-sm mb-6">Ajoute au moins 5 trades dans ton journal pour lancer ta première simulation.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-5 max-w-[1200px] mx-auto">
      <PageHeader
        title="Monte Carlo Lab"
        subtitle={`${trades.length} trades · ${firm?.name} · ${challenge?.name}`}
        actions={
          <button onClick={handleRun} disabled={running || !challenge}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-white text-sm font-bold shadow-lg shadow-cyan-500/20 hover:brightness-110 transition-all disabled:opacity-50">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? `${simCount} simulations...` : `Run ${simCount} simulations`}
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 mt-4">
        {/* LEFT: Configuration */}
        <div className="space-y-3">
          {/* Prop Firm */}
          <div className="glass rounded-2xl p-4">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Prop Firm</h4>
            <select value={firmId} onChange={(e) => selectFirm(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm font-semibold text-white focus:outline-none focus:border-cyan-500/40 transition mb-2">
              {[{ id: "apex", name: "Apex Trader Funding" }, { id: "topstep", name: "Topstep" }, { id: "custom", name: "Custom" }].map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <select value={challengeId} onChange={(e) => setChallengeId(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs font-medium text-slate-300 focus:outline-none focus:border-cyan-500/40 transition">
              {firm?.challenges.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Challenge params */}
          {challenge && (
            <div className="glass rounded-2xl p-4">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Challenge</h4>
              <div className="space-y-2 text-xs">
                <Row label="Balance" value={formatMoney(challenge.startingBalance)} />
                <Row label="Target" value={`+${formatMoney(challenge.profitTarget)} (${challenge.profitTargetPct}%)`} accent="text-emerald-400" />
                <Row label="Max DD" value={`-${formatMoney(challenge.maxDrawdown)} (${challenge.maxDrawdownPct}%)`} accent="text-red-400" />
                {challenge.maxDailyLoss > 0 && <Row label="Daily Loss" value={`-${formatMoney(challenge.maxDailyLoss)}`} accent="text-red-400" />}
                <Row label="Days" value={String(challenge.maxTradingDays)} />
                <Row label="DD Type" value={challenge.trailingDrawdown ? "Trailing" : "Static"} />
              </div>
            </div>
          )}

          {/* Trading Stats */}
          <div className="glass rounded-2xl p-4">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Your Stats</h4>
            <div className="space-y-1.5 text-xs">
              <Row label="Win Rate" value={formatPct(stats.winRate)} />
              <Row label="Avg Win" value={formatPnl(stats.avgWin)} accent="text-emerald-400" />
              <Row label="Avg Loss" value={formatPnl(-stats.avgLoss)} accent="text-red-400" />
              <Row label="Profit Factor" value={stats.profitFactor >= 99 ? "99+" : stats.profitFactor.toFixed(2)} />
              <Row label="Expectancy" value={formatPnl(stats.expectancy)} accent={stats.expectancy >= 0 ? "text-emerald-400" : "text-red-400"} />
              <Row label="Samples" value={String(stats.totalSamples)} />
            </div>
            {trades.length < 20 && (
              <p className="mt-3 text-[10px] text-amber-400/80 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Small sample — results uncertain</p>
            )}
          </div>

          {/* Sim count */}
          <div className="glass rounded-2xl p-4">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Simulations</h4>
            <div className="flex gap-1">
              {SIM_OPTIONS.map((n) => (
                <button key={n} onClick={() => setSimCount(n)} className={cn("flex-1 h-8 rounded-lg text-[10px] font-bold transition", simCount === n ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/25" : "bg-white/[0.03] text-slate-500 border border-white/[0.06] hover:text-slate-300")}>{n >= 1000 ? `${n / 1000}k` : n}</button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Results */}
        <div className="space-y-4">
          {result ? (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Pass Rate" value={`${(result.passRate * 100).toFixed(1)}%`} color="emerald" />
                <KpiCard label="Fail Rate" value={`${(result.failRate * 100).toFixed(1)}%`} color="red" />
                <KpiCard label="Time Out" value={`${(result.timeOutRate * 100).toFixed(1)}%`} color="amber" />
                <KpiCard label="Avg P&L (Passing)" value={formatPnl(result.avgPnlPassing)} color={result.avgPnlPassing >= 0 ? "emerald" : "red"} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Avg Days to Pass" value={result.avgDaysToPass.toFixed(1)} color="cyan" />
                <KpiCard label="Avg Trades to Pass" value={result.avgTradesToPass.toFixed(0)} color="cyan" />
                <KpiCard label="Median Max DD" value={formatMoney(result.medianMaxDrawdown)} color="red" />
                <KpiCard label="Median Final Balance" value={formatMoney(result.medianFinalBalance)} color="white" />
              </div>

              {/* Equity curves */}
              <div className="glass rounded-2xl p-4">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Equity Curves — Showing {Math.min(50, result.results.length)} of {result.results.length}
                </h4>
                <div className="h-52 md:h-64 relative">
                  <svg viewBox="0 0 600 200" className="w-full h-full" preserveAspectRatio="none">
                    {challenge && (
                      <>
                        <line x1="0" y1={yPos(challenge.startingBalance + challenge.profitTarget, challenge)} x2="600" y2={yPos(challenge.startingBalance + challenge.profitTarget, challenge)} stroke="#10b981" strokeWidth="1" strokeDasharray="6 4" opacity="0.6" />
                        <text x="5" y={yPos(challenge.startingBalance + challenge.profitTarget, challenge) - 4} fill="#10b981" fontSize="8" fontFamily="monospace">TARGET {formatMoney(challenge.profitTarget)}</text>
                        <line x1="0" y1={yPos(challenge.startingBalance - challenge.maxDrawdown, challenge)} x2="600" y2={yPos(challenge.startingBalance - challenge.maxDrawdown, challenge)} stroke="#ef4444" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
                        <text x="5" y={yPos(challenge.startingBalance - challenge.maxDrawdown, challenge) - 4} fill="#ef4444" fontSize="8" fontFamily="monospace">MAX DD</text>
                      </>
                    )}
                    {result.results.slice(0, 50).map((r, i) => {
                      const points = r.equityCurve.map((v, j) => `${(j / Math.max(r.equityCurve.length - 1, 1)) * 600},${yPos(v, challenge)}`).join(" ");
                      const color = r.passed ? "#10b981" : r.failed ? "#ef4444" : "#f59e0b";
                      return <polyline key={i} points={points} fill="none" stroke={color} strokeWidth="0.5" opacity="0.4" />;
                    })}
                  </svg>
                </div>
                <div className="flex items-center gap-4 mt-2 text-[10px]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Passed</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Failed</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Timed Out</span>
                </div>
              </div>

              {/* Sensitivity Analysis */}
              {sensResult && (
                <div className="glass rounded-2xl p-4">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">
                    Sensitivity Analysis — "What if my win rate changes?"
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[400px]">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          {["Win Rate", "Pass Rate", "Avg Days", "Fail Rate"].map((h) => (
                            <th key={h} className="px-3 py-2 text-[10px] font-bold uppercase text-slate-500 text-left">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sensResult.map((row) => {
                          const isCurrent = Math.abs(row.winRate - stats.winRate) < 0.03;
                          return (
                            <tr key={row.winRate} className={cn("border-b border-white/[0.04] text-xs", isCurrent && "bg-cyan-500/5")}>
                              <td className="px-3 py-2 font-bold text-white">{row.winRate === stats.winRate ? `${(stats.winRate * 100).toFixed(0)}%` : `${(row.winRate * 100).toFixed(0)}%`} {isCurrent && <span className="text-[10px] text-cyan-400 ml-1">← YOU</span>}</td>
                              <td className="px-3 py-2 text-emerald-400 font-semibold tabular-nums">{(row.passRate * 100).toFixed(1)}%</td>
                              <td className="px-3 py-2 text-slate-300 tabular-nums">{row.avgDays.toFixed(1)}</td>
                              <td className="px-3 py-2 text-red-400 tabular-nums">{(row.failRate * 100).toFixed(1)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Zap className="w-10 h-10 text-cyan-400/40 mb-4" />
              <p className="text-sm text-slate-500">Configure your challenge and run a simulation</p>
              {trades.length < 5 && (
                <p className="text-[11px] text-amber-400/80 mt-2">Minimum 5 trades required ({trades.length} available)</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function yPos(value: number, challenge: PropChallenge | undefined): number {
  if (!challenge) return 100;
  const min = challenge.startingBalance - challenge.maxDrawdown * 1.2;
  const max = challenge.startingBalance + challenge.profitTarget * 1.2;
  const range = max - min;
  return 200 - ((value - min) / range) * 200;
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="glass rounded-xl p-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-0.5">{label}</div>
      <div className={cn("font-display text-base font-extrabold tabular-nums",
        color === "emerald" ? "text-emerald-400" : color === "red" ? "text-red-400" : color === "amber" ? "text-amber-400" : color === "cyan" ? "text-cyan-400" : "text-white")}>{value}</div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={cn("font-semibold tabular-nums", accent || "text-white")}>{value}</span>
    </div>
  );
}
