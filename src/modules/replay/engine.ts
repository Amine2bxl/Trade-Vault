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
import {
  nyMidnightMs,
  nyDateOf,
  nyTimeOf,
  sessionsOf,
  tradingDatesFrom,
  NySessions,
} from "./calendar";
import { candleStartOf, timeframeSeconds } from "./timeframes";
import { intrabarAt, barFraction, visibleBar } from "./intrabar";

export interface SimulatedCandle extends OhlcBar {
  /** Vrai si la bougie est encore en formation (close = prix marqué). */
  forming?: boolean;
}

export interface ReplayEngineInit {
  symbol: string;
  date: string;
  startTime: string;
  timeframe: string;
  /**
   * Nombre de SÉANCES rejouées d'affilée (1 par défaut).
   *
   * On compte en jours de cotation, pas en jours civils : cinq jours depuis un
   * jeudi couvrent jeudi → mercredi, sans compter le week-end.
   */
  days?: number;
}

/** Une fenêtre de séance officielle, pour l'ombrage du graphe. */
export interface RthWindow {
  start: number;
  end: number;
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

  /** Les séances rejouées, dans l'ordre. */
  readonly dates: string[];
  private sessions: NySessions[];

  private bar1m: OhlcBar[] = [];
  /** Horloge canonique, ms epoch simulé. */
  now: number;

  constructor(init: ReplayEngineInit) {
    this.instrumentId = init.symbol;
    this.symbol = init.symbol;
    this.date = init.date;
    this.startTime = init.startTime;
    this.dates = tradingDatesFrom(init.date, init.days ?? 1);
    this.sessions = this.dates.map(sessionsOf);
    const first = this.sessions[0];
    const last = this.sessions[this.sessions.length - 1];
    // L'enveloppe court du premier ETH au dernier : l'horloge ne connaît qu'une
    // ligne de temps, les séances n'en sont que le découpage.
    this.ethStart = first.ethStart;
    this.ethEnd = last.ethEnd;
    this.rthStart = first.rthStart;
    this.rthEnd = first.rthEnd;
    this.now = this.clamp(first.ethStart);
  }

  /** Les fenêtres RTH de chaque séance rejouée. */
  rthWindows(): RthWindow[] {
    return this.sessions.map((s) => ({ start: s.rthStart, end: s.rthEnd }));
  }

  private dayMidnight(ms: number): number {
    return nyMidnightMs(nyDateOf(ms));
  }

  /** Charge les 1m de toutes les séances, puis fige l'horloge au départ choisi. */
  async start(): Promise<void> {
    const spec = instrumentOf(this.symbol);
    const perDay = await Promise.all(this.dates.map((d) => loadSessionBars(d, spec)));
    // Les fenêtres ETH de deux séances consécutives se chevauchent sur la soirée
    // (18 h → minuit appartient au jour de cotation SUIVANT) : dédoublonner par
    // horodatage est ce qui garde une minute unique et une seule vérité.
    const seen = new Set<number>();
    this.bar1m = perDay
      .flat()
      .sort((a, b) => a.time - b.time)
      .filter((b) => (seen.has(b.time) ? false : (seen.add(b.time), true)));
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

  /**
   * L'avancement dans le TEMPS COTÉ, pas dans le temps civil.
   *
   * Sur plusieurs séances, l'enveloppe contient des trous — l'heure morte de
   * chaque soir, et jusqu'à deux jours pour un week-end. Les compter ferait
   * bondir la barre de progression pendant que rien ne se passe.
   */
  progress(): number {
    const total = this.sessions.reduce((a, x) => a + (x.ethEnd - x.ethStart), 0);
    if (total <= 0) return 1;
    let done = 0;
    for (const x of this.sessions) {
      if (this.now >= x.ethEnd) done += x.ethEnd - x.ethStart;
      else if (this.now > x.ethStart) done += this.now - x.ethStart;
    }
    return Math.min(1, Math.max(0, done / total));
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

    for (const raw of this.bar1m) {
      if (raw.time > now) break;
      // La minute en cours n'est connue qu'à hauteur du temps écoulé : on
      // agrège sa VUE PARTIELLE, jamais son OHLC complet. Sans quoi la tête de
      // série livrerait le high et le low d'une minute qui n'a pas eu lieu.
      const b = visibleBar(raw, now);
      const bucket = candleStartOf(raw.time, tfSec, this.dayMidnight(raw.time));
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
      // En formation tant que le bord droit du seau dépasse l'horloge.
      const span = Math.max(60_000, tfSec * 1000);
      if (now < cur.time + span) cur.forming = true;
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
    this.now = this.skipGap(this.clamp(next), 1);
  }

  /** Bougie précédente — la simulation repartira de zéro vers cette cible. */
  stepBack(tfId: string): void {
    const tfSec = timeframeSeconds(tfId);
    const cur = candleStartOf(this.now, tfSec, this.dayMidnight(this.now));
    const span = Math.max(60_000, tfSec * 1000);
    const prev = cur < this.now ? cur : cur - span;
    this.now = this.skipGap(this.clamp(Math.max(this.ethStart, prev)), -1);
  }

  /** Avance continue (lecture) d'une durée simulée, bornée à la fin. */
  advance(durationMs: number): void {
    this.now = this.skipGap(this.clamp(this.now + Math.max(0, durationMs)), 1);
  }

  /** Re-partir d'un timestamp arbitraire (rejeu arrière). */
  jumpTo(ms: number): void {
    this.now = this.skipGap(this.clamp(ms), 1);
  }

  private clamp(ms: number): number {
    return Math.min(this.ethEnd, Math.max(this.ethStart, ms));
  }

  /**
   * Fait franchir à l'horloge l'heure morte qui sépare deux séances.
   *
   * Entre 17 h et 18 h le marché est fermé : aucune bougie, aucun prix. Y
   * laisser l'horloge donnerait une minute figée que le trader regarderait
   * s'écouler pour rien. `dir` dit vers quel bord la pousser.
   */
  private skipGap(ms: number, dir: 1 | -1): number {
    for (let i = 0; i < this.sessions.length - 1; i++) {
      const gapStart = this.sessions[i].ethEnd;
      const gapEnd = this.sessions[i + 1].ethStart;
      if (ms > gapStart && ms < gapEnd) return dir === 1 ? gapEnd : gapStart;
    }
    return ms;
  }

  clockLabel(): string {
    return `${nyDateOf(this.now)} · ${nyTimeOf(this.now)}`;
  }

  /** Les bornes de la fenêtre en ms, pour le cadrage du graphe. */
  sessionBounds(): {
    ethStart: number;
    ethEnd: number;
    rthStart: number;
    rthEnd: number;
    rthWindows: RthWindow[];
  } {
    return {
      ethStart: this.ethStart,
      ethEnd: this.ethEnd,
      rthStart: this.rthStart,
      rthEnd: this.rthEnd,
      rthWindows: this.rthWindows(),
    };
  }
}

/**
 * Le prix vivant à `now`, sur le chemin intra-bougie de la 1m en cours.
 *
 * L'interpolation droite open→close d'autrefois ne pouvait JAMAIS toucher le
 * high ni le low de la minute : un stop posé sur la mèche n'était atteignable
 * qu'à la clôture de la bougie. Le chemin visite les deux extrêmes, donc le
 * prix marqué passe réellement là où le marché est passé.
 */
export function markPriceAt(bars: OhlcBar[], now: number): number {
  if (bars.length === 0) return 0;
  let last: OhlcBar | null = null;
  for (const b of bars) {
    if (b.time <= now) last = b;
    else break;
  }
  if (!last) return bars[0].open;
  if (now >= last.time + 60_000) return last.close;
  return intrabarAt(last, barFraction(last, now)).price;
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
