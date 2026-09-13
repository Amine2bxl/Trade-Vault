/**
 * indicators — les études du graphe, calculées comme la plateforme de
 * référence les calcule.
 *
 * Module PUR : aucune dépendance à React, au DOM ni à la librairie de graphe.
 * Il reçoit des bougies et rend des séries de points. C'est ce qui permet de
 * les tester sans écran, et c'est aussi ce qui garantit qu'un nombre affiché
 * dans la légende est CELUI qui est tracé : les deux lisent la même sortie.
 *
 * LES FORMULES SONT CELLES DE TRADINGVIEW, pas des approximations :
 *
 *  • une EMA démarre sur une SMA de `length` valeurs, puis lisse — commencer
 *    sur la première clôture ferait dériver toute la courbe pendant des
 *    dizaines de barres ;
 *  • le RSI utilise le lissage de Wilder (RMA), qui n'est pas une EMA de même
 *    période — confondre les deux décale le 30/70 d'un point entier ;
 *  • le VWAP est ANCRÉ À LA SÉANCE et repart à chaque ouverture, sinon il
 *    n'aurait aucun sens pour un intraday ;
 *  • les bandes de Bollinger sont posées sur l'écart-type de POPULATION, comme
 *    la plateforme, et non sur celui d'échantillon.
 *
 * Chaque série rend `null` là où l'indicateur n'a pas encore assez d'histoire.
 * On ne comble pas : une valeur inventée sur les premières barres se lit comme
 * un signal, et c'est la seule erreur qu'un indicateur ne doit jamais faire.
 */

import type { OhlcBar } from "./types";

/** La source d'un calcul — le vocabulaire de la plateforme de référence. */
export type PriceSource = "close" | "open" | "high" | "low" | "hl2" | "hlc3" | "ohlc4";

export const PRICE_SOURCES: readonly PriceSource[] = [
  "close",
  "open",
  "high",
  "low",
  "hl2",
  "hlc3",
  "ohlc4",
] as const;

/** Un point d'une courbe d'indicateur. `null` = pas encore défini. */
export interface IndicatorPoint {
  time: number;
  value: number | null;
}

/** Extrait la source demandée d'une bougie. */
export function sourceOf(bar: OhlcBar, source: PriceSource): number {
  switch (source) {
    case "open":
      return bar.open;
    case "high":
      return bar.high;
    case "low":
      return bar.low;
    case "hl2":
      return (bar.high + bar.low) / 2;
    case "hlc3":
      return (bar.high + bar.low + bar.close) / 3;
    case "ohlc4":
      return (bar.open + bar.high + bar.low + bar.close) / 4;
    case "close":
    default:
      return bar.close;
  }
}

// ── Moyennes ───────────────────────────────────────────────────────────────

/** Moyenne mobile simple. `null` avant la `length`-ième valeur. */
export function sma(values: number[], length: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (length <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= length) sum -= values[i - length];
    if (i >= length - 1) out[i] = sum / length;
  }
  return out;
}

/**
 * Moyenne mobile exponentielle — AMORCÉE SUR UNE SMA.
 *
 * C'est le détail qui sépare une EMA juste d'une EMA « à peu près » : partir
 * de la première clôture donne une courbe qui met `3 × length` barres à
 * rejoindre la vraie, et pendant tout ce temps elle ment.
 */
export function ema(values: number[], length: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (length <= 0 || values.length < length) return out;
  const k = 2 / (length + 1);
  let seed = 0;
  for (let i = 0; i < length; i++) seed += values[i];
  let prev = seed / length;
  out[length - 1] = prev;
  for (let i = length; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Moyenne mobile pondérée linéairement (poids 1…length). */
export function wma(values: number[], length: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (length <= 0) return out;
  const denom = (length * (length + 1)) / 2;
  for (let i = length - 1; i < values.length; i++) {
    let acc = 0;
    for (let j = 0; j < length; j++) acc += values[i - j] * (length - j);
    out[i] = acc / denom;
  }
  return out;
}

/**
 * Lissage de Wilder (RMA) — celui du RSI, de l'ATR et de l'ADX.
 *
 * `RMA(n)` répond comme une `EMA(2n−1)` : substituer l'une à l'autre déplace
 * visiblement les seuils, d'où sa présence ici en propre.
 */
export function rma(values: number[], length: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (length <= 0 || values.length < length) return out;
  let seed = 0;
  for (let i = 0; i < length; i++) seed += values[i];
  let prev = seed / length;
  out[length - 1] = prev;
  for (let i = length; i < values.length; i++) {
    prev = (prev * (length - 1) + values[i]) / length;
    out[i] = prev;
  }
  return out;
}

/** L'une des quatre moyennes, choisie par son nom. */
export type MaType = "sma" | "ema" | "wma" | "rma";

export function movingAverage(values: number[], length: number, type: MaType): (number | null)[] {
  switch (type) {
    case "ema":
      return ema(values, length);
    case "wma":
      return wma(values, length);
    case "rma":
      return rma(values, length);
    case "sma":
    default:
      return sma(values, length);
  }
}

/** Écart-type de POPULATION sur une fenêtre glissante — celui de Bollinger. */
export function stdev(values: number[], length: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (length <= 0) return out;
  const means = sma(values, length);
  for (let i = length - 1; i < values.length; i++) {
    const mean = means[i];
    if (mean == null) continue;
    let acc = 0;
    for (let j = 0; j < length; j++) {
      const d = values[i - j] - mean;
      acc += d * d;
    }
    out[i] = Math.sqrt(acc / length);
  }
  return out;
}

// ── Études ────────────────────────────────────────────────────────────────

/**
 * VWAP ANCRÉ À LA SÉANCE.
 *
 * L'ancre est fournie par l'appelant (`isSessionStart`) plutôt que devinée
 * ici : c'est le calendrier du marché qui sait où commence une séance, pas
 * l'indicateur. Un VWAP qui ne repart pas à l'ouverture accumule la veille et
 * ne dit plus rien de la journée qu'on rejoue.
 */
export function vwap(bars: OhlcBar[], isSessionStart: (bar: OhlcBar, prev: OhlcBar) => boolean) {
  const out: (number | null)[] = new Array(bars.length).fill(null);
  let pv = 0;
  let vol = 0;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    if (i === 0 || isSessionStart(b, bars[i - 1])) {
      pv = 0;
      vol = 0;
    }
    const typical = (b.high + b.low + b.close) / 3;
    // Un volume nul (bougie creuse, données partielles) ne doit pas faire
    // disparaître la courbe : on garde la dernière valeur accumulée.
    pv += typical * b.volume;
    vol += b.volume;
    out[i] = vol > 0 ? pv / vol : typical;
  }
  return out;
}

export interface BollingerOut {
  basis: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
}

export function bollinger(values: number[], length: number, mult: number): BollingerOut {
  const basis = sma(values, length);
  const dev = stdev(values, length);
  const upper: (number | null)[] = new Array(values.length).fill(null);
  const lower: (number | null)[] = new Array(values.length).fill(null);
  for (let i = 0; i < values.length; i++) {
    const b = basis[i];
    const d = dev[i];
    if (b == null || d == null) continue;
    upper[i] = b + mult * d;
    lower[i] = b - mult * d;
  }
  return { basis, upper, lower };
}

/** RSI de Wilder, borné 0–100. */
export function rsi(values: number[], length: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < 2) return out;
  const gains: number[] = [0];
  const losses: number[] = [0];
  for (let i = 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gains.push(d > 0 ? d : 0);
    losses.push(d < 0 ? -d : 0);
  }
  // Wilder démarre son lissage sur la PREMIÈRE variation, pas sur la première
  // clôture : on décale donc les tableaux d'un cran avant de lisser.
  const avgGain = rma(gains.slice(1), length);
  const avgLoss = rma(losses.slice(1), length);
  for (let i = 0; i < avgGain.length; i++) {
    const g = avgGain[i];
    const l = avgLoss[i];
    if (g == null || l == null) continue;
    // Perte moyenne nulle = que des hausses : le RSI vaut 100, et la division
    // n'a pas lieu.
    out[i + 1] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  return out;
}

export interface MacdOut {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

export function macd(values: number[], fast: number, slow: number, signalLen: number): MacdOut {
  const fastLine = ema(values, fast);
  const slowLine = ema(values, slow);
  const line: (number | null)[] = new Array(values.length).fill(null);
  for (let i = 0; i < values.length; i++) {
    const f = fastLine[i];
    const s = slowLine[i];
    if (f == null || s == null) continue;
    line[i] = f - s;
  }
  // La ligne de signal est une EMA de la MACD, donc calculée seulement sur la
  // partie DÉFINIE : lisser des `null` convertis en zéros écraserait la courbe
  // vers le bas pendant `slow` barres.
  const firstDefined = line.findIndex((v) => v != null);
  const signal: (number | null)[] = new Array(values.length).fill(null);
  const histogram: (number | null)[] = new Array(values.length).fill(null);
  if (firstDefined >= 0) {
    const dense = line.slice(firstDefined).map((v) => v ?? 0);
    const sig = ema(dense, signalLen);
    for (let i = 0; i < sig.length; i++) {
      const s = sig[i];
      if (s == null) continue;
      const idx = firstDefined + i;
      signal[idx] = s;
      const m = line[idx];
      if (m != null) histogram[idx] = m - s;
    }
  }
  return { macd: line, signal, histogram };
}

/** True Range barre à barre — la base de l'ATR. */
export function trueRange(bars: OhlcBar[]): number[] {
  const out: number[] = new Array(bars.length).fill(0);
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    if (i === 0) {
      out[i] = b.high - b.low;
      continue;
    }
    const prevClose = bars[i - 1].close;
    out[i] = Math.max(b.high - b.low, Math.abs(b.high - prevClose), Math.abs(b.low - prevClose));
  }
  return out;
}

export function atr(bars: OhlcBar[], length: number): (number | null)[] {
  return rma(trueRange(bars), length);
}

export interface StochasticOut {
  k: (number | null)[];
  d: (number | null)[];
}

export function stochastic(
  bars: OhlcBar[],
  kLength: number,
  kSmooth: number,
  dSmooth: number,
): StochasticOut {
  const raw: (number | null)[] = new Array(bars.length).fill(null);
  for (let i = kLength - 1; i < bars.length; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = 0; j < kLength; j++) {
      hh = Math.max(hh, bars[i - j].high);
      ll = Math.min(ll, bars[i - j].low);
    }
    // Une fenêtre entièrement plate (haut = bas) n'a pas de position relative :
    // la plateforme rend 50, le milieu, plutôt qu'une division par zéro.
    raw[i] = hh === ll ? 50 : ((bars[i].close - ll) / (hh - ll)) * 100;
  }
  const first = raw.findIndex((v) => v != null);
  const k: (number | null)[] = new Array(bars.length).fill(null);
  const d: (number | null)[] = new Array(bars.length).fill(null);
  if (first < 0) return { k, d };
  const dense = raw.slice(first).map((v) => v ?? 0);
  const kk = sma(dense, kSmooth);
  for (let i = 0; i < kk.length; i++) k[first + i] = kk[i];
  const kFirst = k.findIndex((v) => v != null);
  if (kFirst >= 0) {
    const dd = sma(
      k.slice(kFirst).map((v) => v ?? 0),
      dSmooth,
    );
    for (let i = 0; i < dd.length; i++) d[kFirst + i] = dd[i];
  }
  return { k, d };
}

// ── Le catalogue ──────────────────────────────────────────────────────────

/** Les études proposées, par identifiant stable. */
export type IndicatorKind =
  | "ma"
  | "ema"
  | "vwap"
  | "bb"
  | "rsi"
  | "macd"
  | "atr"
  | "stoch"
  | "volumeMa";

/** Une étude POSÉE sur le graphe : son type, ses réglages, son identité. */
export interface IndicatorConfig {
  id: string;
  kind: IndicatorKind;
  /** Réglages numériques — les noms sont ceux du catalogue ci-dessous. */
  params: Record<string, number>;
  /** Source du calcul, pour les études qui en prennent une. */
  source: PriceSource;
  /** Couleurs des tracés, dans l'ordre des lignes rendues. */
  colors: string[];
  /** Œil ouvert / fermé, sans perdre les réglages. */
  visible: boolean;
}

/** Le descriptif d'une étude : ce qu'elle affiche, et ce qui se règle. */
export interface IndicatorSpec {
  kind: IndicatorKind;
  /** Clé i18n du nom affiché. */
  labelKey: string;
  /** Tracée SUR le prix (`overlay`) ou dans son propre volet (`pane`). */
  placement: "overlay" | "pane";
  /** Réglages exposés — nom, libellé, bornes. */
  params: { key: string; labelKey: string; min: number; max: number; step: number }[];
  /** L'étude lit-elle une source de prix ? */
  hasSource: boolean;
  /** Les lignes rendues, dans l'ordre — sert aux couleurs et à la légende. */
  lines: string[];
  /** Réglages par défaut — ceux de la plateforme de référence. */
  defaults: Record<string, number>;
  /** Couleurs par défaut — des JETONS de thème, jamais des hex de marque. */
  defaultColors: string[];
  /** Bornes fixes du volet (RSI 0–100, stochastique 0–100). */
  paneRange?: { min: number; max: number; guides: number[] };
}

export const INDICATOR_SPECS: Record<IndicatorKind, IndicatorSpec> = {
  ma: {
    kind: "ma",
    labelKey: "rt.ind.ma",
    placement: "overlay",
    params: [{ key: "length", labelKey: "rt.ind.length", min: 1, max: 500, step: 1 }],
    hasSource: true,
    lines: ["MA"],
    defaults: { length: 50 },
    defaultColors: ["var(--tv-accent)"],
  },
  ema: {
    kind: "ema",
    labelKey: "rt.ind.ema",
    placement: "overlay",
    params: [{ key: "length", labelKey: "rt.ind.length", min: 1, max: 500, step: 1 }],
    hasSource: true,
    lines: ["EMA"],
    defaults: { length: 21 },
    defaultColors: ["var(--tv-warning)"],
  },
  vwap: {
    kind: "vwap",
    labelKey: "rt.ind.vwap",
    placement: "overlay",
    params: [],
    hasSource: false,
    lines: ["VWAP"],
    defaults: {},
    defaultColors: ["var(--tv-highlight)"],
  },
  bb: {
    kind: "bb",
    labelKey: "rt.ind.bb",
    placement: "overlay",
    params: [
      { key: "length", labelKey: "rt.ind.length", min: 2, max: 500, step: 1 },
      { key: "mult", labelKey: "rt.ind.mult", min: 0.1, max: 10, step: 0.1 },
    ],
    hasSource: true,
    lines: ["Upper", "Basis", "Lower"],
    defaults: { length: 20, mult: 2 },
    defaultColors: ["var(--tv-text-muted)", "var(--tv-accent)", "var(--tv-text-muted)"],
  },
  rsi: {
    kind: "rsi",
    labelKey: "rt.ind.rsi",
    placement: "pane",
    params: [{ key: "length", labelKey: "rt.ind.length", min: 2, max: 200, step: 1 }],
    hasSource: true,
    lines: ["RSI"],
    defaults: { length: 14 },
    defaultColors: ["var(--tv-accent)"],
    paneRange: { min: 0, max: 100, guides: [30, 70] },
  },
  macd: {
    kind: "macd",
    labelKey: "rt.ind.macd",
    placement: "pane",
    params: [
      { key: "fast", labelKey: "rt.ind.fast", min: 1, max: 200, step: 1 },
      { key: "slow", labelKey: "rt.ind.slow", min: 2, max: 400, step: 1 },
      { key: "signal", labelKey: "rt.ind.signal", min: 1, max: 200, step: 1 },
    ],
    hasSource: true,
    lines: ["MACD", "Signal", "Hist"],
    defaults: { fast: 12, slow: 26, signal: 9 },
    defaultColors: ["var(--tv-accent)", "var(--tv-warning)", "var(--tv-text-muted)"],
  },
  atr: {
    kind: "atr",
    labelKey: "rt.ind.atr",
    placement: "pane",
    params: [{ key: "length", labelKey: "rt.ind.length", min: 1, max: 200, step: 1 }],
    hasSource: false,
    lines: ["ATR"],
    defaults: { length: 14 },
    defaultColors: ["var(--tv-warning)"],
  },
  stoch: {
    kind: "stoch",
    labelKey: "rt.ind.stoch",
    placement: "pane",
    params: [
      { key: "k", labelKey: "rt.ind.kLength", min: 1, max: 200, step: 1 },
      { key: "kSmooth", labelKey: "rt.ind.smooth", min: 1, max: 50, step: 1 },
      { key: "d", labelKey: "rt.ind.dLength", min: 1, max: 50, step: 1 },
    ],
    hasSource: false,
    lines: ["%K", "%D"],
    defaults: { k: 14, kSmooth: 1, d: 3 },
    defaultColors: ["var(--tv-accent)", "var(--tv-warning)"],
    paneRange: { min: 0, max: 100, guides: [20, 80] },
  },
  volumeMa: {
    kind: "volumeMa",
    labelKey: "rt.ind.volumeMa",
    placement: "overlay",
    params: [{ key: "length", labelKey: "rt.ind.length", min: 1, max: 200, step: 1 }],
    hasSource: false,
    lines: ["Vol MA"],
    defaults: { length: 20 },
    defaultColors: ["var(--tv-text-muted)"],
  },
};

/** Une étude neuve, aux réglages du catalogue. */
export function defaultIndicator(kind: IndicatorKind, id: string): IndicatorConfig {
  const spec = INDICATOR_SPECS[kind];
  return {
    id,
    kind,
    params: { ...spec.defaults },
    source: "close",
    colors: [...spec.defaultColors],
    visible: true,
  };
}

/** Le titre d'une étude tel que la légende l'affiche — « EMA 21 », « BB 20 2 ». */
export function indicatorTitle(cfg: IndicatorConfig, name: string): string {
  const spec = INDICATOR_SPECS[cfg.kind];
  const args = spec.params.map((p) => cfg.params[p.key] ?? spec.defaults[p.key]);
  return args.length ? `${name} ${args.join(" ")}` : name;
}

/** Le résultat d'une étude : une ligne par tracé, dans l'ordre du catalogue. */
export interface IndicatorSeries {
  /** Nom court de la ligne (« MACD », « Signal »…). */
  name: string;
  points: IndicatorPoint[];
  color: string;
  /** L'histogramme du MACD se dessine en barres, pas en ligne. */
  style: "line" | "histogram";
}

/**
 * Calcule une étude sur les bougies données.
 *
 * L'indicateur est calculé sur TOUTES les bougies révélées, pas seulement les
 * visibles : une EMA 200 recalculée sur la fenêtre affichée changerait de
 * valeur à chaque déplacement du graphe, ce qui est le contraire d'un repère.
 */
export function computeIndicator(
  cfg: IndicatorConfig,
  bars: OhlcBar[],
  isSessionStart: (bar: OhlcBar, prev: OhlcBar) => boolean,
): IndicatorSeries[] {
  const spec = INDICATOR_SPECS[cfg.kind];
  const p = (key: string) => cfg.params[key] ?? spec.defaults[key] ?? 0;
  const color = (i: number) => cfg.colors[i] ?? spec.defaultColors[i] ?? "var(--tv-text-muted)";
  const src = bars.map((b) => sourceOf(b, cfg.source));
  const times = bars.map((b) => b.time);
  const zip = (values: (number | null)[]): IndicatorPoint[] =>
    times.map((time, i) => ({ time, value: values[i] ?? null }));
  const line = (name: string, values: (number | null)[], i: number): IndicatorSeries => ({
    name,
    points: zip(values),
    color: color(i),
    style: "line",
  });

  switch (cfg.kind) {
    case "ma":
      return [line("MA", sma(src, p("length")), 0)];
    case "ema":
      return [line("EMA", ema(src, p("length")), 0)];
    case "vwap":
      return [line("VWAP", vwap(bars, isSessionStart), 0)];
    case "bb": {
      const b = bollinger(src, p("length"), p("mult"));
      return [line("Upper", b.upper, 0), line("Basis", b.basis, 1), line("Lower", b.lower, 2)];
    }
    case "rsi":
      return [line("RSI", rsi(src, p("length")), 0)];
    case "macd": {
      const m = macd(src, p("fast"), p("slow"), p("signal"));
      return [
        line("MACD", m.macd, 0),
        line("Signal", m.signal, 1),
        { name: "Hist", points: zip(m.histogram), color: color(2), style: "histogram" },
      ];
    }
    case "atr":
      return [line("ATR", atr(bars, p("length")), 0)];
    case "stoch": {
      const s = stochastic(bars, p("k"), p("kSmooth"), p("d"));
      return [line("%K", s.k, 0), line("%D", s.d, 1)];
    }
    case "volumeMa":
      return [
        line(
          "Vol MA",
          sma(
            bars.map((b) => b.volume),
            p("length"),
          ),
          0,
        ),
      ];
    default:
      return [];
  }
}

/**
 * Bougies Heikin-Ashi, dérivées des bougies réelles.
 *
 * C'est un TYPE DE GRAPHE, pas un indicateur : il remplace les bougies au lieu
 * de s'ajouter à elles. Le calcul vit ici parce qu'il est pur, et parce que la
 * première bougie sert d'amorce — sans quoi la série entière serait décalée.
 */
export function heikinAshi(bars: OhlcBar[]): OhlcBar[] {
  const out: OhlcBar[] = [];
  let prevOpen = 0;
  let prevClose = 0;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const close = (b.open + b.high + b.low + b.close) / 4;
    const open = i === 0 ? (b.open + b.close) / 2 : (prevOpen + prevClose) / 2;
    out.push({
      time: b.time,
      open,
      high: Math.max(b.high, open, close),
      low: Math.min(b.low, open, close),
      close,
      volume: b.volume,
    });
    prevOpen = open;
    prevClose = close;
  }
  return out;
}
