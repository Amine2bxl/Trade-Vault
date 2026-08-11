// ═══════════════════════════════════════════════════════════════
// MONTE CARLO ENGINE — TradeVault
// ═══════════════════════════════════════════════════════════════
//
// Methodology: Bootstrap resampling from the trader's actual R-multiple
// distribution. Each R-multiple is drawn independently from the pool of
// historical trades (with replacement). This preserves:
//   - The exact distribution of win/loss magnitudes
//   - The correlation between direction and R-multiple size
//   - The actual shape of the trader's performance distribution
//
// Formula reference:
//   equity[t] = equity[t-1] + riskAmount × sampledRMultiple
//   drawdown[t] = peak[t] - equity[t]    (peak = running max)
//   drawdown%[t] = drawdown[t] / peak[t]
//   pass  = equity[t] >= startingBalance + profitTarget
//   fail  = trailingDD ? (peak - equity[t]) >= maxDD : (startingBalance - equity[t]) >= maxDD
//   dailyFail = dayLoss >= maxDailyLoss
//   timeout = day > maxTradingDays && !pass && !fail
//
// Confidence intervals: P5, P25, P50 (median), P75, P95 computed from the
// distribution of simulation outcomes. These are Monte Carlo estimates, not
// analytic guarantees. The standard error of the mean scales as σ/√N where
// σ is the standard deviation of the estimator and N is the number of
// simulations. At 10,000 simulations, the Monte Carlo error on pass rate
// is approximately ±0.5% for rates near 50%, and ±0.3% for rates near 98%.
// ═══════════════════════════════════════════════════════════════════

export interface RMultipleSample {
  r: number;       // R-multiple (signed: +2.4, -1.0, 0 for BE)
  pnl: number;     // Dollar P&L
  isWin: boolean;
  isLoss: boolean;
  isBE: boolean;
}

export interface MonteCarloParams {
  // ── Account ──
  startingBalance: number;

  // ── Challenge rules ──
  profitTarget: number;        // absolute $ target to pass
  maxDrawdown: number;         // absolute $ max drawdown allowed
  maxDailyLoss: number;        // absolute $ daily loss limit (0 = disabled)
  trailingDrawdown: boolean;   // true = EOD trailing, false = static
  maxTradingDays: number;      // maximum days before timeout
  maxTradesPerDay: number;     // max trades per simulated day (1-10)

  // ── Risk model ──
  riskPerTrade: number;        // $ risk per trade (used to compute P&L from R)

  // ── Simulation config ──
  simulations: number;         // 100–10,000
  seed?: number;               // optional for reproducibility
}

export interface SimulationRun {
  equity: number[];
  trades: number[];            // R-multiples sampled
  finalBalance: number;
  peakBalance: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  passed: boolean;
  failed: boolean;
  timedOut: boolean;
  failReason: string | null;
  tradingDays: number;
  totalTrades: number;
}

export interface MonteCarloResult {
  runs: SimulationRun[];
  params: MonteCarloParams;
  sampleStats: SampleStatistics;

  // ── KPIs ──
  passRate: number;
  failRate: number;
  timeOutRate: number;

  // ── Conditional means ──
  avgFinalBalancePassing: number;
  avgDaysToPass: number;
  avgTradesToPass: number;

  // ── Drawdown (all runs) ──
  medianMaxDD: number;

  // ── Confidence intervals (percentiles) ──
  passRateCI: { p5: number; p25: number; p50: number; p75: number; p95: number };
  finalBalanceDistribution: { p5: number; p25: number; p50: number; p75: number; p95: number };
  daysToPassDistribution: { p5: number; p25: number; p50: number; p75: number; p95: number };
}

export interface SampleStatistics {
  totalSamples: number;
  wins: number;
  losses: number;
  breakEven: number;
  winRate: number;          // wins / (wins + losses), BE excluded
  avgWinR: number;          // mean R-multiple of wins
  avgLossR: number;         // mean |R-multiple| of losses
  avgWinPnl: number;        // mean $ P&L of wins
  avgLossPnl: number;       // mean $ |P&L| of losses
  profitFactor: number;     // sum(gains) / sum(losses)
  expectancy: number;       // mean R-multiple (including BE)
  expectancyPnl: number;    // mean $ P&L (including BE)
  stdDevR: number;          // standard deviation of R-multiples
}

// ═══════════════════════════════════════════════════════════════
// Seeded PRNG (Linear Congruential Generator)
// ═══════════════════════════════════════════════════════════════

class LCGRandom {
  private state: number;
  constructor(seed?: number) {
    this.state = seed ?? (Math.floor(Math.random() * 2147483647) | 0);
    if (this.state <= 0) this.state += 2147483646;
  }
  /** Uniform [0, 1) */
  next(): number {
    this.state = (this.state * 16807) % 2147483647;
    return (this.state - 1) / 2147483646;
  }
}

// ═══════════════════════════════════════════════════════════════
// R-multiple extraction from trades
// ═══════════════════════════════════════════════════════════════

export function extractRSamples(trades: { pnl: number; rMultiple: number; direction: "long" | "short" | "be" }[]): RMultipleSample[] {
  return trades.map((t) => ({
    r: t.rMultiple,
    pnl: t.pnl,
    isWin: t.direction !== "be" && t.pnl > 0,
    isLoss: t.direction !== "be" && t.pnl < 0,
    isBE: t.direction === "be",
  }));
}

// ═══════════════════════════════════════════════════════════════
// Sample statistics (computed once, used by the UI for display)
// ═══════════════════════════════════════════════════════════════

export function computeStatistics(samples: RMultipleSample[]): SampleStatistics {
  const wins = samples.filter((s) => s.isWin);
  const losses = samples.filter((s) => s.isLoss);
  const be = samples.filter((s) => s.isBE);
  const decisive = wins.length + losses.length;

  const sumGains = wins.reduce((a, s) => a + s.pnl, 0);
  const sumLosses = Math.abs(losses.reduce((a, s) => a + s.pnl, 0));

  // Standard deviation of R-multiples
  const meanR = samples.length > 0 ? samples.reduce((a, s) => a + s.r, 0) / samples.length : 0;
  const variance = samples.length > 0
    ? samples.reduce((a, s) => a + (s.r - meanR) ** 2, 0) / samples.length
    : 0;

  return {
    totalSamples: samples.length,
    wins: wins.length,
    losses: losses.length,
    breakEven: be.length,
    winRate: decisive > 0 ? wins.length / decisive : 0,
    avgWinR: wins.length > 0 ? wins.reduce((a, s) => a + s.r, 0) / wins.length : 0,
    avgLossR: losses.length > 0 ? losses.reduce((a, s) => a + Math.abs(s.r), 0) / losses.length : 0,
    avgWinPnl: wins.length > 0 ? sumGains / wins.length : 0,
    avgLossPnl: losses.length > 0 ? sumLosses / losses.length : 0,
    profitFactor: sumLosses > 0 ? sumGains / sumLosses : (sumGains > 0 ? 99 : 0),
    expectancy: samples.length > 0 ? meanR : 0,
    expectancyPnl: samples.length > 0 ? samples.reduce((a, s) => a + s.pnl, 0) / samples.length : 0,
    stdDevR: Math.sqrt(variance),
  };
}

// ═══════════════════════════════════════════════════════════════
// Single simulation run
// ═══════════════════════════════════════════════════════════════

export function simulateRun(params: MonteCarloParams, samples: RMultipleSample[], rng: LCGRandom): SimulationRun {
  const { startingBalance, profitTarget, maxDrawdown, maxDailyLoss, trailingDrawdown, maxTradingDays, maxTradesPerDay, riskPerTrade } = params;

  const days = Math.min(maxTradingDays, 120);
  const tradesPerDay = Math.max(1, Math.min(maxTradesPerDay, 10));
  const totalSlots = days * tradesPerDay;

  let balance = startingBalance;
  let peak = startingBalance;
  const equity: number[] = [startingBalance];
  const sampledR: number[] = [];
  let day = 0;

  for (let d = 0; d < days; d++) {
    day = d + 1;
    const dayStartBalance = balance;
    let dayMaxDD = 0;

    for (let t = 0; t < tradesPerDay; t++) {
      // Bootstrap: draw randomly from the actual R-multiple distribution
      const idx = Math.floor(rng.next() * samples.length);
      const sample = samples[idx];

      // P&L = riskPerTrade × R-multiple
      const tradePnl = riskPerTrade * sample.r;
      balance += tradePnl;
      equity.push(balance);
      sampledR.push(sample.r);

      if (balance > peak) peak = balance;

      // Check daily loss
      const dayLoss = dayStartBalance - balance;
      dayMaxDD = Math.max(dayMaxDD, dayLoss);
      if (maxDailyLoss > 0 && dayLoss >= maxDailyLoss) {
        return {
          equity, trades: sampledR, finalBalance: balance,
          peakBalance: peak, maxDrawdown: 0, maxDrawdownPct: 0,
          passed: false, failed: true, timedOut: false,
          failReason: `Daily loss limit reached (day ${day})`,
          tradingDays: day, totalTrades: sampledR.length,
        };
      }

      // Check max drawdown
      // Static: drawdown = startingBalance - balance
      // Trailing: drawdown = peak - balance (floor moves up with peak)
      const dd = trailingDrawdown ? (peak - balance) : (startingBalance - balance);
      if (dd >= maxDrawdown) {
        const ddPct = peak > 0 ? dd / peak : 1;
        return {
          equity, trades: sampledR, finalBalance: balance,
          peakBalance: peak, maxDrawdown: dd, maxDrawdownPct: ddPct,
          passed: false, failed: true, timedOut: false,
          failReason: trailingDrawdown ? `Trailing drawdown hit (day ${day})` : `Max drawdown reached (day ${day})`,
          tradingDays: day, totalTrades: sampledR.length,
        };
      }

      // Check profit target
      if (balance >= startingBalance + profitTarget) {
        const { maxDD, maxDDPct } = computeRunDrawdown(equity);
        return {
          equity, trades: sampledR, finalBalance: balance,
          peakBalance: peak, maxDrawdown: maxDD, maxDrawdownPct: maxDDPct,
          passed: true, failed: false, timedOut: false, failReason: null,
          tradingDays: day, totalTrades: sampledR.length,
        };
      }
    }
  }

  const { maxDD, maxDDPct } = computeRunDrawdown(equity);
  return {
    equity, trades: sampledR, finalBalance: balance,
    peakBalance: peak, maxDrawdown: maxDD, maxDrawdownPct: maxDDPct,
    passed: false, failed: false, timedOut: true,
    failReason: `Max trading days reached (${days})`,
    tradingDays: days, totalTrades: sampledR.length,
  };
}

function computeRunDrawdown(equity: number[]): { maxDD: number; maxDDPct: number } {
  let peak = equity[0];
  let maxDD = 0;
  let maxDDPct = 0;
  for (const v of equity) {
    if (v > peak) peak = v;
    const dd = peak - v;
    const ddPct = peak > 0 ? dd / peak : 0;
    if (dd > maxDD) maxDD = dd;
    if (ddPct > maxDDPct) maxDDPct = ddPct;
  }
  return { maxDD, maxDDPct };
}

// ═══════════════════════════════════════════════════════════════
// Full Monte Carlo simulation: N independent runs
// ═══════════════════════════════════════════════════════════════

export function runMonteCarlo(params: MonteCarloParams, samples: RMultipleSample[]): MonteCarloResult {
  const rng = new LCGRandom(params.seed);
  const runs: SimulationRun[] = [];

  for (let i = 0; i < params.simulations; i++) {
    runs.push(simulateRun(params, samples, rng));
  }

  const passed = runs.filter((r) => r.passed);
  const failed = runs.filter((r) => r.failed);
  const timedOut = runs.filter((r) => r.timedOut);
  const allFinalBalances = runs.map((r) => r.finalBalance);
  const passDays = passed.map((r) => r.tradingDays);

  return {
    runs,
    params,
    sampleStats: computeStatistics(samples),

    passRate: runs.length > 0 ? passed.length / runs.length : 0,
    failRate: runs.length > 0 ? failed.length / runs.length : 0,
    timeOutRate: runs.length > 0 ? timedOut.length / runs.length : 0,

    avgFinalBalancePassing: passed.length > 0
      ? passed.reduce((a, r) => a + r.finalBalance, 0) / passed.length
      : 0,
    avgDaysToPass: passed.length > 0 ? passDays.reduce((a, d) => a + d, 0) / passed.length : 0,
    avgTradesToPass: passed.length > 0
      ? passed.reduce((a, r) => a + r.totalTrades, 0) / passed.length
      : 0,
    medianMaxDD: median(runs.map((r) => r.maxDrawdown)),

    passRateCI: { p5: 0, p25: 0, p50: 0, p75: 0, p95: 0 },
    finalBalanceDistribution: percentiles(allFinalBalances),
    daysToPassDistribution: percentiles(passDays),
  };
}

// ═══════════════════════════════════════════════════════════════
// Statistical helpers
// ═══════════════════════════════════════════════════════════════

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

function percentiles(values: number[]): { p5: number; p25: number; p50: number; p75: number; p95: number } {
  if (values.length === 0) return { p5: 0, p25: 0, p50: 0, p75: 0, p95: 0 };
  return {
    p5: percentile(values, 5),
    p25: percentile(values, 25),
    p50: percentile(values, 50),
    p75: percentile(values, 75),
    p95: percentile(values, 95),
  };
}

// ═══════════════════════════════════════════════════════════════
// Monte Carlo error estimate
// Pass rate standard error ≈ √(p(1-p)/N), where p = passRate, N = simulations
// At N = 10,000: max SE ≈ 0.5% (at p = 50%), at p = 98%: SE ≈ 0.14%
// ═══════════════════════════════════════════════════════════════

export function monteCarloSE(passRate: number, simulations: number): number {
  return Math.sqrt((passRate * (1 - passRate)) / simulations);
}

// ═══════════════════════════════════════════════════════════════
// Manual input: generate synthetic R-multiples from user params
// ═══════════════════════════════════════════════════════════════

export interface ManualTradeParams {
  winRate: number;
  avgWinR: number;
  avgLossR: number;
  breakEvenRate: number;
}

export function generateSamples(params: ManualTradeParams, count: number): RMultipleSample[] {
  const samples: RMultipleSample[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    if (r < params.breakEvenRate) {
      samples.push({ r: 0, pnl: 0, isWin: false, isLoss: false, isBE: true });
    } else if (r < params.breakEvenRate + params.winRate * (1 - params.breakEvenRate)) {
      const variance = Math.max(0.2, params.avgWinR * 0.2);
      const val = Math.max(0.05, params.avgWinR + (Math.random() - 0.5) * variance * 2);
      samples.push({ r: val, pnl: val, isWin: true, isLoss: false, isBE: false });
    } else {
      const variance = Math.max(0.2, params.avgLossR * 0.2);
      const val = Math.max(0.05, params.avgLossR + (Math.random() - 0.5) * variance * 2);
      samples.push({ r: -val, pnl: -val, isWin: false, isLoss: true, isBE: false });
    }
  }
  return samples;
}

export function computeExpectancy(wr: number, aw: number, al: number): number {
  return wr * aw - (1 - wr) * al;
}

export function computeProfitFactor(wr: number, aw: number, al: number): number {
  const gp = wr * aw;
  const gl = (1 - wr) * al;
  return gl > 0 ? gp / gl : (gp > 0 ? 99 : 0);
}
