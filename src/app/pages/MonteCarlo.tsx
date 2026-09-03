import { useState, useMemo, useCallback } from "react";
import {
  Play,
  Loader2,
  BarChart3,
  Zap,
  TrendingUp,
  AlertTriangle,
  Info,
  ChevronDown,
  X,
} from "lucide-react";
import { Trade } from "../types";
import { formatPnl, formatPct } from "../utils/tradeCalcs";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import { usePageActions } from "../contexts/PageActionsContext";
import {
  extractRSamples,
  runMonteCarlo,
  computeStatistics,
  monteCarloSE,
  generateSamples,
  computeExpectancy,
  computeProfitFactor,
  type MonteCarloParams,
  type MonteCarloResult,
  type RMultipleSample,
  type SampleStatistics,
  type ManualTradeParams,
} from "../utils/monteCarlo";
import { findFirm, findChallenge, formatMoney, type PropChallenge } from "../utils/propFirms";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ComposedChart,
} from "recharts";
import { AXIS_TICK } from "../utils/chartTheme";

interface Props {
  trades: Trade[];
}

const SIM_OPTIONS = [100, 500, 1000, 5000, 10000];

/* ─────── PARAMETER INPUT ─────── */
function ParamRow({
  label,
  value,
  onChange,
  suffix = "",
  computed,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  computed?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-1 min-w-0">
        <span className="text-[11px] text-slate-400 truncate">{label}</span>
        {computed && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-cyan-500/60 shrink-0"
            title="Auto-computed from your data"
          />
        )}
        {hint && <Info className="w-3 h-3 text-slate-600 shrink-0" />}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="tv-figure w-[80px] h-7 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 text-[11px] text-white text-right focus:outline-none focus:border-cyan-500/40 transition"
        />
        {suffix && <span className="text-[10px] text-slate-500 w-3">{suffix}</span>}
      </div>
    </div>
  );
}

function SectionHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h4 className="tv-label text-slate-500">{title}</h4>
      {children}
    </div>
  );
}

/* ─────── KPI CARD ─────── */
function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: "emerald" | "red" | "amber" | "cyan" | "white";
}) {
  const cls =
    color === "emerald"
      ? "text-emerald-400"
      : color === "red"
        ? "text-red-400"
        : color === "amber"
          ? "text-amber-400"
          : color === "cyan"
            ? "text-cyan-400"
            : "text-white";
  return (
    <div className="glass rounded-xl p-3 text-center">
      <div className="tv-label text-slate-500 mb-1">{label}</div>
      <div className={cn("tv-figure text-base", cls)}>{value}</div>
      {sub && <div className="text-[10px] text-slate-600 mt-0.5">{sub}</div>}
    </div>
  );
}

/* ─────── EQUITY CURVE CHART ─────── */
function EquityCurves({
  result,
  challenge,
}: {
  result: MonteCarloResult;
  challenge: PropChallenge | undefined;
}) {
  // Build chart data: aggregate the first 100 runs
  const sampled = result.runs.slice(0, 100);
  const maxLen = Math.max(...sampled.map((r) => r.equity.length), 1);

  const chartData = useMemo(() => {
    // Compute percentile bands at each step
    const steps = 80; // downsample for performance
    const data: { step: number; p95: number; p75: number; p50: number; p25: number; p5: number }[] =
      [];
    for (let i = 0; i <= steps; i++) {
      const idx = Math.floor((i / steps) * (maxLen - 1));
      const vals = sampled
        .map((r) => r.equity[Math.min(idx, r.equity.length - 1)])
        .sort((a, b) => a - b);
      data.push({
        step: idx,
        p95: vals[Math.floor(vals.length * 0.95)],
        p75: vals[Math.floor(vals.length * 0.75)],
        p50: vals[Math.floor(vals.length * 0.5)],
        p25: vals[Math.floor(vals.length * 0.25)],
        p5: vals[Math.floor(vals.length * 0.05)],
      });
    }
    return data;
  }, [sampled, maxLen]);

  const targetVal = result.params.startingBalance + result.params.profitTarget;
  const ddVal = result.params.startingBalance - result.params.maxDrawdown;

  return (
    <div className="glass rounded-2xl p-4">
      <h4 className="tv-label text-slate-500 mb-3">
        Equity Curves — {result.runs.length.toLocaleString()} simulations
      </h4>
      <div className="h-64 md:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 10, bottom: 20, left: 0 }}>
            <defs>
              <linearGradient id="mcBand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--tv-highlight)" stopOpacity={0.08} />
                <stop offset="100%" stopColor="var(--tv-highlight)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(148,163,184,0.06)" strokeDasharray="4 8" vertical={false} />
            <XAxis dataKey="step" tick={false} axisLine={false} tickLine={false} />
            <YAxis
              tick={AXIS_TICK}
              tickFormatter={(v) => formatMoney(v)}
              axisLine={false}
              tickLine={false}
              width={55}
              domain={["dataMin - 500", "dataMax + 500"]}
            />
            <ReferenceLine y={targetVal} stroke="#10b981" strokeWidth={1} strokeDasharray="6 4" />
            <ReferenceLine y={ddVal} stroke="#ef4444" strokeWidth={1} strokeDasharray="4 4" />

            {/* P5-P95 band */}
            <Area type="monotone" dataKey="p95" stroke="none" fill="url(#mcBand)" fillOpacity={1} />

            {/* P25-P75 band */}
            <Area
              type="monotone"
              dataKey="p25"
              stroke="none"
              fill="rgba(34,211,238,0.04)"
              fillOpacity={1}
            />
            <Area
              type="monotone"
              dataKey="p75"
              stroke="none"
              fill="rgba(34,211,238,0.04)"
              fillOpacity={1}
            />

            {/* Median line */}
            <Line
              type="monotone"
              dataKey="p50"
              stroke="var(--tv-highlight)"
              strokeWidth={1.5}
              dot={false}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div
                    className="rounded-xl border border-white/[0.08] px-3 py-2"
                    style={{ background: "rgba(10,15,30,0.97)" }}
                  >
                    <p className="tv-label text-slate-500 mb-0.5">Equity Distribution</p>
                    <div className="space-y-0.5 text-[10px] tabular-nums">
                      <p className="text-emerald-400">P95: {formatMoney(d.p95)}</p>
                      <p className="text-cyan-300">P75: {formatMoney(d.p75)}</p>
                      <p className="text-white font-bold">Median: {formatMoney(d.p50)}</p>
                      <p className="text-cyan-300">P25: {formatMoney(d.p25)}</p>
                      <p className="text-red-400">P5: {formatMoney(d.p5)}</p>
                    </div>
                  </div>
                );
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-600">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          Median
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-0.5 w-3 bg-cyan-400/20" />
          P25-P75
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-0.5 w-3 bg-cyan-400/10" />
          P5-P95
        </span>
      </div>
    </div>
  );
}

/* ─────── MAIN PAGE ─────── */
export default function MonteCarloPage({ trades }: Props) {
  const { t } = useT();

  // Extract R-multiple samples from all trades
  const samples = useMemo(() => extractRSamples(trades), [trades]);
  const computedStats = useMemo(() => computeStatistics(samples), [samples]);

  // Manual input mode
  const [wrVal, setWrVal] = useState(0);
  const [awVal, setAwVal] = useState(0);
  const [alVal, setAlVal] = useState(0);
  const [beVal, setBeVal] = useState(0);
  const [useManual, setUseManual] = useState(trades.length === 0);

  const fillFromJournal = () => {
    if (computedStats.winRate > 0) setWrVal(Math.round(computedStats.winRate * 100));
    if (computedStats.avgWinR > 0) setAwVal(Math.round(computedStats.avgWinR * 10) / 10);
    if (computedStats.avgLossR > 0) setAlVal(Math.round(computedStats.avgLossR * 10) / 10);
    if (samples.length > 0)
      setBeVal(Math.round((samples.filter((s) => s.isBE).length / samples.length) * 100));
  };

  const manualParams: ManualTradeParams = useMemo(
    () => ({
      winRate: wrVal / 100,
      avgWinR: awVal,
      avgLossR: alVal,
      breakEvenRate: beVal / 100,
    }),
    [wrVal, awVal, alVal, beVal],
  );

  const manualExpectancy = computeExpectancy(wrVal / 100, awVal, alVal);
  const manualPF = computeProfitFactor(wrVal / 100, awVal, alVal);

  // ── Challenge preset ──
  const [firmId, setFirmId] = useState("apex");
  const [challengeId, setChallengeId] = useState("apex-50k");
  const firm = useMemo(() => findFirm(firmId), [firmId]);
  const challenge = useMemo(() => findChallenge(challengeId), [challengeId]);

  // Apply challenge preset as starting values
  const applyPreset = useCallback((ch: PropChallenge) => {
    setStartingBalance(ch.startingBalance);
    setProfitTarget(ch.profitTarget);
    setMaxDrawdown(ch.maxDrawdown);
    setMaxDailyLoss(ch.maxDailyLoss);
    setTrailingDD(ch.trailingDrawdown);
    setMaxTradingDays(ch.maxTradingDays);
    setMaxTradesPerDay(Math.min(ch.maxTradesPerDay, 5));
    setResult(null);
  }, []);

  // ── Overridable params ──
  const [startingBalance, setStartingBalance] = useState(50000);
  const [profitTarget, setProfitTarget] = useState(3000);
  const [maxDrawdown, setMaxDrawdown] = useState(2500);
  const [maxDailyLoss, setMaxDailyLoss] = useState(0);
  const [trailingDD, setTrailingDD] = useState(true);
  const [maxTradingDays, setMaxTradingDays] = useState(30);
  const [maxTradesPerDay, setMaxTradesPerDay] = useState(5);
  const [riskPerTrade, setRiskPerTrade] = useState(() =>
    Math.round(computedStats.avgLossPnl || 100),
  );

  // ── Simulation ──
  const [simCount, setSimCount] = useState(2000);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MonteCarloResult | null>(null);

  const selectFirm = (fId: string) => {
    const f = findFirm(fId);
    if (f && f.challenges.length > 0) {
      setFirmId(fId);
      setChallengeId(f.challenges[0].id);
      applyPreset(f.challenges[0]);
    }
  };

  const selectChallenge = (cId: string) => {
    setChallengeId(cId);
    const ch = findChallenge(cId);
    if (ch) applyPreset(ch);
  };

  const handleRun = useCallback(() => {
    const simSamples =
      useManual && wrVal > 0 && awVal > 0 && alVal > 0
        ? generateSamples(manualParams, 500)
        : samples;
    if (simSamples.length < 5) return;
    setRunning(true);
    setTimeout(() => {
      const params: MonteCarloParams = {
        startingBalance,
        profitTarget,
        maxDrawdown,
        maxDailyLoss,
        trailingDrawdown: trailingDD,
        maxTradingDays,
        maxTradesPerDay,
        riskPerTrade,
        simulations: Math.min(simCount, 5000),
      };
      const output = runMonteCarlo(params, simSamples);
      setResult(output);
      setRunning(false);
    }, 30);
  }, [
    useManual,
    manualParams,
    samples,
    startingBalance,
    profitTarget,
    maxDrawdown,
    maxDailyLoss,
    trailingDD,
    maxTradingDays,
    maxTradesPerDay,
    riskPerTrade,
    simCount,
    wrVal,
    awVal,
    alVal,
  ]);

  // Apply preset on first mount
  useMemo(() => {
    if (challenge) applyPreset(challenge);
  }, []);

  const se = result ? monteCarloSE(result.passRate, result.runs.length) : 0;

  const headerActions = useMemo(
    () => (
      <button
        onClick={handleRun}
        disabled={running || trades.length < 5}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl tv-accent-fill text-sm font-bold transition disabled:opacity-50"
      >
        {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        {running ? "Running..." : `Run ${simCount.toLocaleString()} simulations`}
      </button>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [running, simCount, trades.length, handleRun],
  );
  usePageActions(headerActions);

  if (trades.length === 0) {
    return (
      <div className="p-4 md:p-5 max-w-[1400px] mx-auto">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BarChart3 className="w-12 h-12 text-cyan-400/30 mb-5" />
          <h3 className="text-base font-bold text-white mb-1.5">
            Ton Monte Carlo commence avec tes données
          </h3>
          <p className="text-sm text-slate-500 max-w-sm">
            Ajoute au moins 5 trades dans ton journal pour lancer ta première simulation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-5 max-w-[1400px] mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        {/* LEFT: Configuration */}
        <div className="space-y-3">
          {/* Preset */}
          <div className="glass rounded-2xl p-4">
            <h4 className="tv-label text-slate-500 mb-2">Quick Preset</h4>
            <select
              value={firmId}
              onChange={(e) => selectFirm(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-cyan-500/40 transition mb-2"
            >
              {[
                { id: "apex", name: "Apex Trader Funding" },
                { id: "topstep", name: "Topstep" },
                { id: "custom", name: "Custom" },
              ].map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <select
              value={challengeId}
              onChange={(e) => selectChallenge(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-[11px] font-medium text-slate-300 focus:outline-none focus:border-cyan-500/40 transition"
            >
              {firm?.challenges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-2 italic">
              Selecting a preset fills the parameters below — you can override any value.
            </p>
          </div>

          {/* Account */}
          <div className="glass rounded-2xl p-4">
            <SectionHeader title="Account" />
            <div className="space-y-2">
              <ParamRow
                label="Starting Balance"
                value={startingBalance}
                onChange={setStartingBalance}
              />
            </div>
          </div>

          {/* Challenge Rules */}
          <div className="glass rounded-2xl p-4">
            <SectionHeader title="Challenge Rules" />
            <div className="space-y-2">
              <ParamRow label="Profit Target ($)" value={profitTarget} onChange={setProfitTarget} />
              <ParamRow label="Max Drawdown ($)" value={maxDrawdown} onChange={setMaxDrawdown} />
              <ParamRow
                label="Daily Loss Limit ($)"
                value={maxDailyLoss}
                onChange={setMaxDailyLoss}
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Trailing DD</span>
                <button
                  onClick={() => setTrailingDD(!trailingDD)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-[10px] font-bold transition border",
                    trailingDD
                      ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/25"
                      : "bg-white/[0.04] text-slate-500 border-white/[0.08]",
                  )}
                >
                  {trailingDD ? "Trailing" : "Static"}
                </button>
              </div>
              <ParamRow
                label="Max Trading Days"
                value={maxTradingDays}
                onChange={setMaxTradingDays}
              />
              <ParamRow
                label="Max Trades / Day"
                value={maxTradesPerDay}
                onChange={setMaxTradesPerDay}
              />
            </div>
          </div>

          {/* Risk */}
          <div className="glass rounded-2xl p-4">
            <SectionHeader title="Risk Model" />
            <div className="space-y-2">
              <ParamRow
                label="Risk per Trade ($)"
                value={riskPerTrade}
                onChange={setRiskPerTrade}
              />
              {startingBalance > 0 && (
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">Risk %</span>
                  <span className="tv-figure text-slate-400">
                    {((riskPerTrade / startingBalance) * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Your Stats — switchable: journal data or manual */}
          <div className="glass rounded-2xl p-4">
            <SectionHeader title="Your Data">
              <button
                onClick={() => setUseManual(!useManual)}
                className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-lg border transition",
                  useManual
                    ? "bg-amber-500/10 text-amber-300 border-amber-500/25"
                    : "bg-cyan-500/10 text-cyan-300 border-cyan-500/25",
                )}
              >
                {useManual ? "Manual" : "Journal"}
              </button>
            </SectionHeader>
            {useManual ? (
              <div className="space-y-1.5">
                <ParamRow label="Win Rate" value={wrVal} onChange={setWrVal} suffix="%" />
                <ParamRow label="Avg Win" value={awVal} onChange={setAwVal} suffix="R" />
                <ParamRow label="Avg Loss" value={alVal} onChange={setAlVal} suffix="R" />
                <ParamRow label="BE Rate" value={beVal} onChange={setBeVal} suffix="%" />
                {wrVal === 0 && trades.length > 0 && (
                  <button
                    onClick={fillFromJournal}
                    className="w-full mt-2 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[10px] text-cyan-300 font-semibold hover:bg-cyan-500/15 transition"
                  >
                    Fill from my journal data
                  </button>
                )}
                {wrVal > 0 && awVal > 0 && alVal > 0 && (
                  <div className="pt-2 mt-2 border-t border-white/[0.05] space-y-1">
                    <StatRow
                      label="Expectancy"
                      value={`${manualExpectancy >= 0 ? "+" : ""}${manualExpectancy.toFixed(2)}R`}
                      computed
                      accent={manualExpectancy >= 0 ? "text-emerald-400" : "text-red-400"}
                    />
                    <StatRow
                      label="Profit Factor"
                      value={manualPF >= 99 ? "99+" : manualPF.toFixed(2)}
                      computed
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <StatRow label="Win Rate" value={formatPct(computedStats.winRate)} computed />
                <StatRow
                  label="Avg Win R"
                  value={`+${computedStats.avgWinR.toFixed(2)}R`}
                  computed
                  accent="text-emerald-400"
                />
                <StatRow
                  label="Avg Loss R"
                  value={`-${computedStats.avgLossR.toFixed(2)}R`}
                  computed
                  accent="text-red-400"
                />
                <StatRow
                  label="Expectancy"
                  value={`${computedStats.expectancy >= 0 ? "+" : ""}${computedStats.expectancy.toFixed(2)}R`}
                  computed
                  accent={computedStats.expectancy >= 0 ? "text-emerald-400" : "text-red-400"}
                />
                <StatRow
                  label="Profit Factor"
                  value={
                    computedStats.profitFactor >= 99 ? "99+" : computedStats.profitFactor.toFixed(2)
                  }
                  computed
                />
                <StatRow label="Samples" value={`${computedStats.totalSamples}`} computed />
                {trades.length < 30 && (
                  <p className="mt-2 text-[10px] text-amber-400/80">
                    Small sample — results may vary significantly
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Simulations count */}
          <div className="glass rounded-2xl p-4">
            <SectionHeader title="Simulations" />
            <div className="flex gap-1">
              {SIM_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setSimCount(n)}
                  className={cn(
                    "flex-1 h-8 rounded-lg text-[10px] font-bold transition",
                    simCount === n
                      ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/25"
                      : "bg-white/[0.03] text-slate-500 border border-white/[0.06] hover:text-slate-300",
                  )}
                >
                  {n >= 1000 ? `${n / 1000}k` : n}
                </button>
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
                <KpiCard
                  label="Pass Rate"
                  value={`${(result.passRate * 100).toFixed(1)}%`}
                  sub={`±${(se * 100).toFixed(1)}% SE`}
                  color="emerald"
                />
                <KpiCard
                  label="Fail Rate"
                  value={`${(result.failRate * 100).toFixed(1)}%`}
                  color="red"
                />
                <KpiCard
                  label="Time Out"
                  value={`${(result.timeOutRate * 100).toFixed(1)}%`}
                  color="amber"
                />
                <KpiCard
                  label="Avg P&L (Pass)"
                  value={formatPnl(result.avgFinalBalancePassing - result.params.startingBalance)}
                  color="emerald"
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard
                  label="Avg Days to Pass"
                  value={result.avgDaysToPass.toFixed(1)}
                  color="cyan"
                />
                <KpiCard
                  label="Avg Trades to Pass"
                  value={result.avgTradesToPass.toFixed(0)}
                  color="cyan"
                />
                <KpiCard
                  label="Median Max DD"
                  value={formatMoney(result.medianMaxDD)}
                  color="red"
                />
                <KpiCard
                  label="P95 Final Balance"
                  value={formatMoney(result.finalBalanceDistribution.p95)}
                  color="white"
                />
              </div>

              {/* Confidence intervals */}
              <div className="glass rounded-2xl p-4">
                <h4 className="tv-label text-slate-500 mb-2">Final Balance Distribution</h4>
                <div className="flex items-end gap-1 h-10">
                  {(["p5", "p25", "p50", "p75", "p95"] as const).map((k) => {
                    const v = result.finalBalanceDistribution[k];
                    const maxV = result.finalBalanceDistribution.p95;
                    const minV = result.params.startingBalance - result.params.maxDrawdown;
                    const range = maxV - minV;
                    const h = range > 0 ? ((v - minV) / range) * 100 : 50;
                    return (
                      <div key={k} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] text-slate-500 tabular-nums">
                          {formatMoney(v)}
                        </span>
                        <div
                          className={cn(
                            "w-full rounded-t",
                            k === "p50" ? "bg-cyan-500/60" : "bg-white/[0.08]",
                          )}
                          style={{ height: `${Math.max(2, h)}%` }}
                        />
                        <span className="tv-label text-slate-600">{k.toUpperCase()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Equity curves */}
              <EquityCurves result={result} challenge={challenge} />

              {/* Methodology note */}
              <div className="glass rounded-2xl p-4 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div className="text-[10px] text-slate-500 leading-relaxed">
                  <p className="font-semibold text-slate-400 mb-1">Methodology</p>
                  <p>
                    Bootstrap resampling from your {computedStats.totalSamples} trades with
                    replacement. Each simulation draws independently from your actual R-multiple
                    distribution, preserving the correlation between win/loss direction and
                    magnitude. This is a Monte Carlo estimate — results reflect historical patterns,
                    not predictions.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Zap className="w-10 h-10 text-cyan-400/40 mb-4" />
              <p className="text-sm text-slate-500">
                Configure your parameters and run a simulation
              </p>
              {trades.length < 5 && (
                <p className="text-[11px] text-amber-400/80 mt-2">Minimum 5 trades required</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  computed,
  accent,
}: {
  label: string;
  value: string;
  computed?: boolean;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1">
        {computed && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-cyan-500/60 shrink-0"
            title="Computed from your data"
          />
        )}
        <span className="text-[10px] text-slate-500">{label}</span>
      </div>
      <span className={cn("tv-figure text-[10px]", accent || "text-white")}>{value}</span>
    </div>
  );
}
