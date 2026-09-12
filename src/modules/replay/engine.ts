/**
 * Moteur de rejeu — l'horloge canonique simulée.
 *
 * UNE horloge, UNE vérité. Le moteur ne sait pas ce qui va arriver : il tient
 * `now` (ms epoch) et n'expose jamais une bougie dont le début dépasse `now`.
 * Les timeframes sont une VUE — changer de timeframe re-agrège les mêmes 1m
 * jusqu'à `now`, sans réinitialiser l'horloge ni le compte.
 *
 * Le moteur est SANS ÉTAT d'ordres : il fournit les bougies et le prix marqué ;
 * la simulation d'exécution vit dans `orders.ts`. Cette séparation garde les
 * deux moitiés testables indépendamment.
 *
 * Fuite impossible par construction : `tfCandles(tf)` ne lit que les 1m dont
 * `time <= now`. Le prix marqué n'existe que pour l'instant courant.
 */

import { OhlcBar } from "./types";
import { instrumentOf, pnlOf } from "./instruments";
import { loadSessionBars } from "./market-data";
import { nyMidnightMs, nyDateOf, nyTimeOf, sessionsOf } from "./calendar";
import { candleStartOf, timeframeSeconds } from "./timeframes";

export interface SimulatedCandle extends OhlcBar {
  /** Vrai si la bougie est encore en formation (close = prix marqué). */
  forming?: boolean;
}

export interface ReplayEngineInit {
  symbol: string;
  date: string;
  startTime: string;
  timeframe: string;
}

export class ReplayEngine {
  readonly instrumentId: string;
  readonly symbol: string;
  readonly date: string;
  readonly startTime: string;
  readonly ethStart: number;
  readonly ethEnd: number;
  readonly rthStart: number;
  readonly rthEnd: number;

  private bar1m: OhlcBar[] = [];
  /** Horloge canonique, ms epoch simulé. */
  now: number;

  constructor(init: ReplayEngineInit) {
    this.instrumentId = init.symbol;
    this.symbol = init.symbol;
    this.date = init.date;
    this.startTime = init.startTime;
    const s = sessionsOf(init.date);
    this.ethStart = s.ethStart;
    this.ethEnd = s.ethEnd;
    this.rthStart = s.rthStart;
    this.rthEnd = s.rthEnd;
    this.now = this.clamp(s.ethStart);
  }

  private dayMidnight(ms: number): number {
    return nyMidnightMs(nyDateOf(ms));
  }

  /** Charge les 1m du jour puis fige l'horloge au point de départ choisi. */
  async start(): Promise<void> {
    const spec = instrumentOf(this.symbol);
    this.bar1m = await loadSessionBars(this.date, spec);
    const hhmm = /^\d{1,2}:\d{2}$/.test(this.startTime.trim()) ? this.startTime.trim() : "09:30";
    const [hh, mm] = hhmm.split(":").map(Number);
    const midnight = nyMidnightMs(this.date);
    this.now = this.clamp(midnight + hh * 3600_000 + mm * 60_000);
  }

  get ready(): boolean {
    return this.bar1m.length > 0;
  }
  /** Les 1m chargées (lecture seule — cohérence du rejeu). */
  get data(): OhlcBar[] {
    return this.bar1m;
  }
  get atStart(): boolean {
    return this.now <= this.ethStart;
  }
  get atEnd(): boolean {
    return this.now >= this.ethEnd;
  }

  progress(): number {
    if (this.ethEnd <= this.ethStart) return 1;
    return Math.min(1, Math.max(0, (this.now - this.ethStart) / (this.ethEnd - this.ethStart)));
  }

  /** Le prix « vivant » à l'instant courant, 1m interpolée. */
  markPrice(): number {
    return markPriceAt(this.bar1m, this.now);
  }

  /**
   * Bougies du timeframe choisi, strictement ≤ `now`.
   *
   * Les bougies closes sont les agrégats de leurs 1m ; la bougie de tête, si
   * `now` est dans son intervalle, est « en formation » : son close est le prix
   * marqué à l'instant, jamais une valeur future.
   */
  tfCandles(tfId: string): SimulatedCandle[] {
    if (this.bar1m.length === 0) return [];
    const tfSec = timeframeSeconds(tfId);
    const now = this.now;
    const out: SimulatedCandle[] = [];
    let prevBucket = -1;
    let cur: SimulatedCandle | null = null;

    for (const b of this.bar1m) {
      if (b.time > now) break;
      const bucket = candleStartOf(b.time, tfSec, this.dayMidnight(b.time));
      if (bucket !== prevBucket) {
        if (cur) out.push(cur);
        cur = {
          time: bucket,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
          volume: b.volume,
        };
        prevBucket = bucket;
      } else if (cur) {
        cur.high = Math.max(cur.high, b.high);
        cur.low = Math.min(cur.low, b.low);
        cur.close = b.close;
        cur.volume += b.volume;
      }
    }

    if (cur) {
      if (now > cur.time) {
        cur.close = this.markPrice();
        cur.forming = true;
      }
      out.push(cur);
    }
    return out;
  }

  /** Bougie suivante : le prochain bord de timeframe STRICTEMENT après now. */
  stepForward(tfId: string): void {
    const tfSec = timeframeSeconds(tfId);
    const cur = candleStartOf(this.now, tfSec, this.dayMidnight(this.now));
    const span = Math.max(60_000, tfSec * 1000);
    const next = cur + span > this.now ? cur + span : cur + span * 2;
    this.now = this.clamp(next);
  }

  /** Bougie précédente — la simulation repartira de zéro vers cette cible. */
  stepBack(tfId: string): void {
    const tfSec = timeframeSeconds(tfId);
    const cur = candleStartOf(this.now, tfSec, this.dayMidnight(this.now));
    const span = Math.max(60_000, tfSec * 1000);
    const prev = cur < this.now ? cur : cur - span;
    this.now = this.clamp(Math.max(this.ethStart, prev));
  }

  /** Avance continue (lecture) d'une durée simulée, bornée à la fin. */
  advance(durationMs: number): void {
    this.now = this.clamp(this.now + Math.max(0, durationMs));
  }

  /** Re-partir d'un timestamp arbitraire (rejeu arrière). */
  jumpTo(ms: number): void {
    this.now = this.clamp(ms);
  }

  private clamp(ms: number): number {
    return Math.min(this.ethEnd, Math.max(this.ethStart, ms));
  }

  clockLabel(): string {
    return `${nyDateOf(this.now)} · ${nyTimeOf(this.now)}`;
  }

  /** Les bornes de la fenêtre en ms, pour le cadrage du graphe. */
  sessionBounds(): { ethStart: number; ethEnd: number; rthStart: number; rthEnd: number } {
    return {
      ethStart: this.ethStart,
      ethEnd: this.ethEnd,
      rthStart: this.rthStart,
      rthEnd: this.rthEnd,
    };
  }
}

/** Le prix vivant à `now` : la 1m en cours est interpolée entre ses bornes. */
export function markPriceAt(bars: OhlcBar[], now: number): number {
  if (bars.length === 0) return 0;
  let last: OhlcBar | null = null;
  for (const b of bars) {
    if (b.time <= now) last = b;
    else break;
  }
  if (!last) return bars[0].open;
  const end = last.time + 60_000;
  if (now >= end) return last.close;
  const f = Math.max(0, Math.min(1, (now - last.time) / 60_000));
  return last.open + (last.close - last.open) * f;
}

/** Open P&L du compte, en $, à un prix marqué donné. */
export function openPnlOf(
  positions: { side: "long" | "short"; qty: number; avgEntry: number }[],
  mark: number,
  symbol: string,
): number {
  const spec = instrumentOf(symbol);
  let total = 0;
  for (const p of positions) total += pnlOf(p.side, p.qty, p.avgEntry, mark, spec);
  return total;
}
