// ── Monte Carlo Engine ──
// Bootstrap resampling from real trades. Pure functions, no React dependency.
// Run in Web Worker if needed. Testable independently.

export interface TradeSample {
  pnl: number;
  rMultiple: number;
  isWin: boolean;
  isLoss: boolean;
  isBreakEven: boolean;
}

export interface SimulationResult {
  trades: number[];
  equityCurve: number[];
  finalBalance: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  peakBalance: number;
  passed: boolean;
  failed: boolean;
  timedOut: boolean;
  failReason: string | null;
  tradingDays: number;
}

export interface MonteCarloInput {
  samples: TradeSample[];
  startingBalance: number;
  profitTarget: number;
  maxDrawdown: number;
  maxDailyLoss: number;
  maxTradingDays: number;
  maxTradesPerDay: number;
  trailingDrawdown: boolean;
  simulations: number;
  seed?: number;
}

export interface MonteCarloOutput {
  results: SimulationResult[];
  passRate: number;
  failRate: number;
  timeOutRate: number;
  avgPnlPassing: number;
  avgDaysToPass: number;
  medianMaxDrawdown: number;
  avgTradesToPass: number;
  medianFinalBalance: number;
  inputSummary: {
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    expectancy: number;
    totalSamples: number;
  };
}

class SeededRandom {
  private state: number;
  constructor(seed?: number) {
    this.state = seed ?? (Math.random() * 2147483647) | 0;
  }
  next(): number {
    this.state = (this.state * 16807 + 0) % 2147483647;
    return (this.state - 1) / 2147483646;
  }
}

function bootstrapSample(samples: TradeSample[], rng: SeededRandom, count: number): TradeSample[] {
  const result: TradeSample[] = [];
  for (let i = 0; i < count; i++) {
    result.push(samples[Math.floor(rng.next() * samples.length)]);
  }
  return result;
}

function computeDrawdown(equityCurve: number[]): { maxDD: number; maxDDPct: number; peak: number } {
  let peak = equityCurve[0];
  let maxDD = 0;
  let maxDDPct = 0;
  for (const v of equityCurve) {
    if (v > peak) peak = v;
    const dd = peak - v;
    const ddPct = peak > 0 ? dd / peak : 0;
    if (dd > maxDD) maxDD = dd;
    if (ddPct > maxDDPct) maxDDPct = ddPct;
  }
  return { maxDD, maxDDPct, peak };
}

export function simulateSingle(
  input: MonteCarloInput,
  rng: SeededRandom,
): SimulationResult {
  const { samples, startingBalance, profitTarget, maxDrawdown, maxDailyLoss, maxTradingDays, maxTradesPerDay, trailingDrawdown } = input;
  const days = Math.min(maxTradingDays, 120); // cap at 120 days for performance
  const tradesPerDay = Math.max(1, Math.min(maxTradesPerDay, 5));
  const totalSlots = days * tradesPerDay;

  // Bootstrap enough trades to fill all slots
  const bootstrapped = bootstrapSample(samples, rng, totalSlots);

  let balance = startingBalance;
  let peak = startingBalance;
  let trailingFloor = startingBalance - maxDrawdown;
  const equity: number[] = [startingBalance];
  const trades: number[] = [];
  let day = 0;
  let tradeCount = 0;

  for (let d = 0; d < days; d++) {
    day = d + 1;
    let dayStartBalance = balance;
    let dayLoss = 0;

    for (let t = 0; t < tradesPerDay; t++) {
      const sample = bootstrapped[d * tradesPerDay + t];
      balance += sample.pnl;
      equity.push(balance);
      trades.push(sample.pnl);
      tradeCount++;

      if (balance > peak) peak = balance;

      // Trailing drawdown: floor moves up with peak, never down
      if (trailingDrawdown) {
        trailingFloor = peak - maxDrawdown;
      }

      // Check daily loss limit
      dayLoss = dayStartBalance - balance;
      if (maxDailyLoss > 0 && dayLoss >= maxDailyLoss) {
        return {
          trades, equityCurve: equity, finalBalance: balance,
          maxDrawdown: 0, maxDrawdownPct: 0, peakBalance: peak,
          passed: false, failed: true, timedOut: false,
          failReason: `Daily loss limit reached on day ${day}`,
          tradingDays: day,
        };
      }

      // Check max drawdown
      const dd = trailingDrawdown ? (peak - balance) : (startingBalance - balance);
      if (dd >= maxDrawdown) {
        return {
          trades, equityCurve: equity, finalBalance: balance,
          maxDrawdown: dd, maxDrawdownPct: balance > 0 ? dd / startingBalance : 1,
          peakBalance: peak,
          passed: false, failed: true, timedOut: false,
          failReason: trailingDrawdown
            ? `Trailing drawdown hit on day ${day}`
            : `Max drawdown reached on day ${day}`,
          tradingDays: day,
        };
      }

      // Check profit target
      if (balance >= startingBalance + profitTarget) {
        const { maxDD, maxDDPct } = computeDrawdown(equity);
        return {
          trades, equityCurve: equity, finalBalance: balance,
          maxDrawdown: maxDD, maxDrawdownPct: maxDDPct, peakBalance: peak,
          passed: true, failed: false, timedOut: false,
          failReason: null, tradingDays: day,
        };
      }
    }
  }

  // Timed out
  const { maxDD, maxDDPct } = computeDrawdown(equity);
  return {
    trades, equityCurve: equity, finalBalance: balance,
    maxDrawdown: maxDD, maxDrawdownPct: maxDDPct, peakBalance: peak,
    passed: false, failed: false, timedOut: true,
    failReason: "Max trading days reached",
    tradingDays: days,
  };
}

export function prepareTradeSamples(trades: { pnl: number; rMultiple: number; direction: "long" | "short" | "be" }[]): TradeSample[] {
  return trades.map((t) => ({
    pnl: t.pnl,
    rMultiple: t.rMultiple,
    isWin: t.direction !== "be" && t.pnl > 0,
    isLoss: t.direction !== "be" && t.pnl < 0,
    isBreakEven: t.direction === "be",
  }));
}

export function computeSampleStats(samples: TradeSample[]) {
  const wins = samples.filter((s) => s.isWin);
  const losses = samples.filter((s) => s.isLoss);
  const be = samples.filter((s) => s.isBreakEven);
  const decisive = wins.length + losses.length;

  const totalProfits = wins.reduce((s, t) => s + t.pnl, 0);
  const totalLosses = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));

  return {
    winRate: decisive > 0 ? wins.length / decisive : 0,
    avgWin: wins.length > 0 ? totalProfits / wins.length : 0,
    avgLoss: losses.length > 0 ? totalLosses / losses.length : 0,
    profitFactor: totalLosses > 0 ? totalProfits / totalLosses : totalProfits > 0 ? 99 : 0,
    expectancy: samples.length > 0 ? samples.reduce((s, t) => s + t.pnl, 0) / samples.length : 0,
    breakEvenRate: samples.length > 0 ? be.length / samples.length : 0,
    totalSamples: samples.length,
    wins: wins.length,
    losses: losses.length,
    breakEven: be.length,
  };
}

export function runMonteCarlo(input: MonteCarloInput): MonteCarloOutput {
  const rng = new SeededRandom(input.seed);
  const results: SimulationResult[] = [];

  for (let i = 0; i < input.simulations; i++) {
    results.push(simulateSingle(input, rng));
  }

  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => r.failed);
  const timedOut = results.filter((r) => r.timedOut);

  return {
    results,
    passRate: results.length > 0 ? passed.length / results.length : 0,
    failRate: results.length > 0 ? failed.length / results.length : 0,
    timeOutRate: results.length > 0 ? timedOut.length / results.length : 0,
    avgPnlPassing: passed.length > 0 ? passed.reduce((s, r) => s + r.finalBalance, 0) / passed.length - input.startingBalance : 0,
    avgDaysToPass: passed.length > 0 ? passed.reduce((s, r) => s + r.tradingDays, 0) / passed.length : 0,
    medianMaxDrawdown: results.length > 0 ? median(results.map((r) => r.maxDrawdown)) : 0,
    avgTradesToPass: passed.length > 0 ? passed.reduce((s, r) => s + r.trades.length, 0) / passed.length : 0,
    medianFinalBalance: results.length > 0 ? median(results.map((r) => r.finalBalance)) : 0,
    inputSummary: computeSampleStats(input.samples),
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Sensitivity analysis: vary win rate to see impact on pass rate */
export function sensitivityAnalysis(
  input: MonteCarloInput,
  simulationsPerStep = 2000,
): { winRate: number; passRate: number; avgDays: number; failRate: number }[] {
  const results: { winRate: number; passRate: number; avgDays: number; failRate: number }[] = [];
  const steps = [0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70];

  for (const targetWR of steps) {
    // Adjust samples to target win rate by re-weighting
    const adjustedSamples = adjustWinRate(input.samples, targetWR);
    const runInput = { ...input, samples: adjustedSamples, simulations: simulationsPerStep };
    const output = runMonteCarlo(runInput);
    results.push({
      winRate: targetWR,
      passRate: output.passRate,
      avgDays: output.avgDaysToPass,
      failRate: output.failRate,
    });
  }

  return results;
}

function adjustWinRate(samples: TradeSample[], targetWR: number): TradeSample[] {
  const wins = samples.filter((s) => s.isWin);
  const losses = samples.filter((s) => s.isLoss);
  const be = samples.filter((s) => s.isBreakEven);

  if (wins.length === 0 && losses.length === 0) return samples;

  const totalDecisive = wins.length + losses.length;
  const targetWins = Math.round(targetWR * totalDecisive);
  const targetLosses = totalDecisive - targetWins;

  // Sample with replacement from win and loss pools
  const adjusted: TradeSample[] = [];
  for (let i = 0; i < targetWins; i++) {
    adjusted.push(wins[Math.floor(Math.random() * wins.length)] || wins[0]);
  }
  for (let i = 0; i < targetLosses; i++) {
    adjusted.push(losses[Math.floor(Math.random() * losses.length)] || losses[0]);
  }
  adjusted.push(...be);

  return adjusted;
}
