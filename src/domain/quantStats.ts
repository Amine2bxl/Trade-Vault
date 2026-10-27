import { Trade, isBreakEven } from "./trade";
import { compareRealizedChronological, hasVerifiedRealizedOrder } from "./tradeOrder";

// ── Trading sessions (ET, ICT convention) ──────────────────────────────────
// Times entered in the journal are treated as US Eastern (the reference for
// NQ/ES futures traders): London 02:00–08:00, New York 08:00–16:30, Asia the
// overnight remainder.
export type TradingSession = "asia" | "london" | "newyork";

/** Horaires du Journal : 24 h, heure minute strictement valide, sans seconde inférée. */
function entryMinute(entryTime: string): number | null {
  const matched = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(entryTime.trim());
  return matched ? Number(matched[1]) * 60 + Number(matched[2]) : null;
}

export function getSession(entryTime: string): TradingSession | null {
  const mins = entryMinute(entryTime);
  if (mins === null) return null;
  if (mins >= 120 && mins < 480) return "london";
  if (mins >= 480 && mins < 990) return "newyork";
  return "asia";
}

/** Broker and unreviewed CSV display-clock times are not evidence of
 * America/New_York timestamps. Persisted timezone provenance is a Lot 1 gate.
 * Manual journal entries follow TradeVault's existing ET/ICT convention. */
export function hasUnverifiedEtTime(trade: Pick<Trade, "broker" | "reviewPending">): boolean {
  return Boolean(trade.broker || trade.reviewPending);
}

export function getSessionForTrade(
  trade: Pick<Trade, "entryTime" | "broker" | "reviewPending">,
): TradingSession | null {
  return hasUnverifiedEtTime(trade) ? null : getSession(trade.entryTime);
}

// ── Événements macro confirmés ─────────────────────────────────────────────
// Les dates de NFP/FOMC ne sont jamais inférées à partir du calendrier civil.
// Elles proviennent uniquement du cache économique externe historisé.
export interface VerifiedMacroEvent {
  startsAt: string;
  title: string;
  source: string;
}

/** Jour de publication à New York, indépendant du fuseau de l'appareil. */
function macroDayNy(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Ne renvoie aucun badge à partir d'une date seule ni d'un calendrier approximatif. */
export function getMacroEvents(date: string, events: readonly VerifiedMacroEvent[] = []): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const found = new Set<string>();
  for (const event of events) {
    if (event.source === "builtin") continue;
    const instant = new Date(event.startsAt);
    if (Number.isNaN(instant.getTime()) || macroDayNy(instant) !== date) continue;
    const title = event.title.toLowerCase();
    if (/non[ -]?farm (?:payrolls|employment change)/.test(title) && !title.includes("adp"))
      found.add("NFP");
    if (/\bfomc\b|federal funds rate/.test(title)) found.add("FOMC");
  }
  return [...found];
}

// ── Quant metrics ───────────────────────────────────────────────────────────
/** Trades décisifs requis avant d'afficher Kelly (cf. commentaire du calcul). */
export const MIN_KELLY_SAMPLE = 30;

/** One verified account-return observation for every included trading session,
 * including zero-return sessions. Cashflows must be neutralized upstream.
 * The Data Integrity lot will supply this source; trade P&L is not a proxy. */
export interface VerifiedDailyReturns {
  basis: "verified-account-equity";
  dailyReturns: readonly number[];
}

export interface QuantStats {
  /** Average $ result per trade (all trades, BE included) */
  expectancy: number;
  /** Average R result per trade (pnl / risk, trades with risk > 0) */
  expectancyR: number | null;
  /** Annualized Sharpe on verified daily account returns only. */
  sharpe: number | null;
  sharpeStatus: "unverified_returns" | "insufficient" | "no_variance" | "available";
  /** Sortino non défini si aucun risque baissier observé (jamais de plafond fictif). */
  sortino: number | null;
  sortinoStatus: "unverified_returns" | "insufficient" | "no_downside" | "available";
  /** Max drawdown as % of (starting balance + peak equity); null without starting balance */
  maxDrawdownPct: number | null;
  /** Kelly fraction (indication only); null when wins or losses are missing */
  kelly: number | null;
  /** Best day PnL as share of total profit (TopStep-style consistency); null if not profitable */
  bestDayShare: number | null;
  /** 100 − bestDayShare% clamped to [0,100]; higher = more consistent */
  consistencyScore: number | null;
  /** Days from max-drawdown trough back to a new equity high; null = no drawdown, -1 = still in it */
  recoveryDays: number | null;
  /** Share of trades logged with zero mistakes */
  /**
   * Part des trades journalisés SANS erreur cochée.
   *
   * ATTENTION — ce n'est PAS l'adhérence aux règles. Cet indicateur mesure ce
   * que le trader s'est lui-même reproché ; `ruleAdherence.ts` mesure ce que le
   * moteur de discipline constate, règle par règle, sur une fenêtre de 30 jours.
   * Les deux portaient le même libellé « Respect du plan » et affichaient des
   * valeurs différentes : le tableau de bord pouvait annoncer 90 % pendant que
   * Jarvis disait 55 %. Un chiffre qui diverge entre deux écrans détruit la
   * confiance dans un produit d'analyse — c'est la règle n°1 du projet.
   */
  cleanTrades: number;
}

export function computeQuantStats(
  trades: Trade[],
  startingBalance = 0,
  verifiedReturns?: VerifiedDailyReturns,
): QuantStats {
  const empty: QuantStats = {
    expectancy: 0,
    expectancyR: null,
    sharpe: null,
    sharpeStatus: "unverified_returns",
    sortino: null,
    sortinoStatus: "unverified_returns",
    maxDrawdownPct: null,
    kelly: null,
    bestDayShare: null,
    consistencyScore: null,
    recoveryDays: null,
    cleanTrades: 0,
  };
  if (trades.length === 0) return empty;

  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const expectancy = totalPnl / trades.length;

  const withRisk = trades.filter((t) => t.riskAmount > 0);
  const expectancyR =
    withRisk.length > 0
      ? withRisk.reduce((s, t) => s + t.pnl / t.riskAmount, 0) / withRisk.length
      : null;

  // Daily PnL series in date order
  const dailyMap: Record<string, number> = {};
  for (const t of trades) dailyMap[t.date] = (dailyMap[t.date] || 0) + t.pnl;
  const dates = Object.keys(dailyMap).sort();
  const daily = dates.map((d) => dailyMap[d]);

  let sharpe: number | null = null;
  let sortino: number | null = null;
  let sharpeStatus: QuantStats["sharpeStatus"] = "unverified_returns";
  let sortinoStatus: QuantStats["sortinoStatus"] = "unverified_returns";
  const verified =
    verifiedReturns?.basis === "verified-account-equity" &&
    verifiedReturns.dailyReturns.every((value) => Number.isFinite(value))
      ? verifiedReturns.dailyReturns
      : null;
  if (verified) {
    sharpeStatus = "insufficient";
    sortinoStatus = "insufficient";
    if (verified.length >= 10) {
      // These are account returns with cashflows neutralized and flat sessions
      // included. An annualization of trade-day PnL would be misleading.
      const mean = verified.reduce((s, x) => s + x, 0) / verified.length;
      const variance = verified.reduce((s, x) => s + (x - mean) ** 2, 0) / (verified.length - 1);
      const std = Math.sqrt(variance);
      sharpeStatus = "no_variance";
      sortinoStatus = "no_downside";
      // A constant return series has no volatility even if floating-point
      // summation leaves an epsilon-sized nonzero standard deviation.
      const varies = verified.some((value) => value !== verified[0]);
      if (varies && std > 0) {
        sharpe = (mean / std) * Math.sqrt(252);
        sharpeStatus = "available";
      }
      const downside = Math.sqrt(
        verified.reduce((s, x) => s + Math.min(x, 0) ** 2, 0) / verified.length,
      );
      if (downside > 0) {
        sortino = (mean / downside) * Math.sqrt(252);
        sortinoStatus = "available";
      }
    }
  }

  // Max drawdown (trade order by date) + % + recovery
  const sorted = [...trades].sort(
    (a, b) => compareRealizedChronological(a, b) || a.id.localeCompare(b.id),
  );
  const realizedOrderVerified = hasVerifiedRealizedOrder(trades);
  let equity = 0,
    peak = 0,
    maxDD = 0,
    peakAtMaxDD = 0;
  let troughIndex = -1;
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    equity += t.pnl;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) {
      maxDD = dd;
      peakAtMaxDD = peak;
      troughIndex = i;
    }
  }
  const ddBase = startingBalance > 0 ? startingBalance + peakAtMaxDD : 0;
  // If an initial balance is known and there is no drawdown, the observed
  // drawdown ratio is exactly 0; it is not an unavailable measurement.
  const maxDrawdownPct = realizedOrderVerified && ddBase > 0 ? maxDD / ddBase : null;

  let recoveryDays: number | null = null;
  if (realizedOrderVerified && maxDD > 0 && troughIndex >= 0) {
    // Recompute the equity *after the actual trough trade*, not simply after
    // its calendar date. Recovery within the same session is 0 days.
    let eq = 0;
    let recoveredOn: string | null = null;
    for (let i = 0; i < sorted.length; i++) {
      eq += sorted[i].pnl;
      if (i > troughIndex && eq >= peakAtMaxDD) {
        recoveredOn = sorted[i].date;
        break;
      }
    }
    const troughDate = sorted[troughIndex].date;
    recoveryDays = recoveredOn
      ? Math.round(
          (Date.parse(recoveredOn + "T12:00:00Z") - Date.parse(troughDate + "T12:00:00Z")) /
            86400000,
        )
      : -1;
  }

  // Kelly: W − (1−W)/R avec R = avgWin/|avgLoss|
  //
  // PLANCHER D'ÉCHANTILLON — le garde-fou le plus important de ce fichier.
  // Kelly ne décrit pas une performance passée : il RECOMMANDE une taille de
  // position. Il était calculé dès qu'un gagnant et un perdant existaient, donc
  // affiché à partir de DEUX trades. Trois trades chanceux produisent un Kelly
  // de plusieurs dizaines de pourcents ; un trader qui le suit fait sauter son
  // compte. La mention « indicatif uniquement » ne protège personne — un
  // chiffre affiché est un chiffre lu.
  //
  // 30 trades décisifs : même esprit que le plancher de 10 jours du Sharpe, à
  // un seuil plus élevé parce que la conséquence d'une erreur est ici une
  // décision de risque, pas une appréciation.
  const decisive = trades.filter((t) => !isBreakEven(t));
  const wins = decisive.filter((t) => t.pnl > 0);
  const losses = decisive.filter((t) => t.pnl < 0);
  let kelly: number | null = null;
  if (decisive.length >= MIN_KELLY_SAMPLE && wins.length > 0 && losses.length > 0) {
    const w = wins.length / (wins.length + losses.length);
    const avgWin = wins.reduce((s, t) => s + t.pnl, 0) / wins.length;
    const avgLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length);
    if (avgLoss > 0) kelly = w - (1 - w) / (avgWin / avgLoss);
  }

  // Consistency: best day's profit as share of total PnL (prop-firm style)
  let bestDayShare: number | null = null;
  let consistencyScore: number | null = null;
  if (totalPnl > 0) {
    const bestDay = Math.max(...daily);
    if (bestDay > 0) {
      bestDayShare = bestDay / totalPnl;
      consistencyScore = Math.max(0, Math.min(100, 100 - bestDayShare * 100));
    }
  }

  const cleanTrades = trades.filter((t) => t.mistakes.length === 0).length / trades.length;

  return {
    expectancy,
    expectancyR,
    sharpe,
    sharpeStatus,
    sortino,
    sortinoStatus,
    maxDrawdownPct,
    kelly,
    bestDayShare,
    consistencyScore,
    recoveryDays,
    cleanTrades,
  };
}

// ── Breakdown helpers (heatmaps / per-bucket win rates) ─────────────────────
export interface BucketStat {
  pnl: number;
  count: number;
  wins: number;
  breakEven: number;
}

function addToBucket(map: Record<string, BucketStat>, key: string, t: Trade) {
  if (!map[key]) map[key] = { pnl: 0, count: 0, wins: 0, breakEven: 0 };
  map[key].pnl += t.pnl;
  map[key].count++;
  if (isBreakEven(t)) map[key].breakEven++;
  else if (t.pnl > 0) map[key].wins++;
}

export function statsBySession(trades: Trade[]): Record<TradingSession, BucketStat> {
  const map: Record<string, BucketStat> = {};
  for (const t of trades) {
    const s = getSessionForTrade(t);
    if (s) addToBucket(map, s, t);
  }
  return {
    asia: map.asia ?? { pnl: 0, count: 0, wins: 0, breakEven: 0 },
    london: map.london ?? { pnl: 0, count: 0, wins: 0, breakEven: 0 },
    newyork: map.newyork ?? { pnl: 0, count: 0, wins: 0, breakEven: 0 },
  };
}

export function statsByHour(trades: Trade[]): Record<number, BucketStat> {
  const map: Record<string, BucketStat> = {};
  for (const t of trades) {
    if (hasUnverifiedEtTime(t)) continue;
    const minute = entryMinute(t.entryTime);
    if (minute === null) continue;
    addToBucket(map, String(Math.floor(minute / 60)), t);
  }
  const out: Record<number, BucketStat> = {};
  for (const [k, v] of Object.entries(map)) out[Number(k)] = v;
  return out;
}

/** day-of-week (0–6) × hour matrix for the Analytics heatmap */
export function dayHourMatrix(trades: Trade[]): Record<string, BucketStat> {
  const map: Record<string, BucketStat> = {};
  for (const t of trades) {
    if (hasUnverifiedEtTime(t)) continue;
    const minute = entryMinute(t.entryTime);
    if (minute === null || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) continue;
    const dow = new Date(t.date + "T12:00:00Z").getUTCDay();
    if (!Number.isFinite(dow)) continue;
    addToBucket(map, `${dow}-${Math.floor(minute / 60)}`, t);
  }
  return map;
}

/**
 * Échantillon minimum avant d'exposer un TAUX par bucket.
 *
 * Un total (P&L) reste vrai à n'importe quelle taille d'échantillon : la somme
 * de deux trades est exactement la somme de deux trades. Un TAUX, lui, ne veut
 * rien dire sur trois trades — et il invite pourtant à une conclusion
 * généralisante : « ma meilleure heure est 14 h » tiré d'un unique gagnant.
 *
 * Le graphique horaire traçait un taux pour chaque heure sans plancher, et
 * `behaviorSignals` transmettait ces mêmes taux à Jarvis comme preuve. Le
 * garde vit donc ICI, dans l'unique définition du taux par bucket, plutôt que
 * dans chaque consommateur — ils sont tous protégés du même coup.
 */
export const MIN_BUCKET_SAMPLE = 5;

export function winRateOf(b: BucketStat): number | null {
  const decided = b.count - b.breakEven;
  if (decided < MIN_BUCKET_SAMPLE) return null;
  return b.wins / decided;
}
