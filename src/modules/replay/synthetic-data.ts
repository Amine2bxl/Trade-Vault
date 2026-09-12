/**
 * Données NQ synthétiques — bouchon DÉTERMINISTE pour le terminal.
 *
 * Le produit n'embarque pas de flux de données : le moteur de rejeu a besoin
 * d'OHLC 1m pour fonctionner. Ce générateur produit une journée de cotation
 * plausible, reproductible à l'identique d'une machine à l'autre (même graine,
 * même date → mêmes bougies). Ce n'est PAS du candlestick aléatoire : la
 * structure intraday (volume par heure, volatilité aux carrefours, marche à
 * pas de tick) est calée sur le profil du NQ.
 *
 * Un vrai fournisseur prendra la place du générateur via `MarketDataProvider` :
 * brancher Databento/Polygon revient à implémenter une interface, pas à
 * toucher au moteur.
 */

import { OhlcBar } from "./types";
import { NQ, InstrumentSpec, roundToTick } from "./instruments";
import { nyDow, previousTradingDate, sessionsOf } from "./calendar";

/** PRNG déterministe (mulberry32) — la même graine donne la même suite. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Graine stable d'une date et d'un instrument. */
export function hashSeed(symbol: string, date: string): number {
  let h = 2166136261 >>> 0;
  const s = `${symbol}:${date}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Sans état — peu coûteux à appeler par minute. */
const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour12: false,
  hour: "2-digit",
  minute: "2-digit",
});
function nyHm(ms: number): { hh: number; mm: number } {
  const parts = fmt.formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  let hh = Number(get("hour"));
  if (hh === 24) hh = 0;
  return { hh, mm: Number(get("minute")) };
}

/** Profil de volatilité intraday : grossissement à l'ouverture du RTH, creux à
 *  midi. Retourne un facteur multiplicatif de l'amplitude d'une 1m. */
function volFactor(hh: number, mm: number): number {
  const t = hh + mm / 60;
  if (t >= 9.5 && t <= 10.5) return 2.6 * Math.sin(((t - 9.5) / 1) * Math.PI) + 0.7;
  if (t >= 13.5 && t <= 16) return 1.6 * Math.sin(((t - 13.5) / 2.5) * Math.PI) + 0.7;
  if (t < 9.5 || t >= 16) return 0.55;
  return 0.9;
}

/**
 * Génère les 1m OHLC de la fenêtre ETH du jour de cotation `date`.
 *
 * Chaque minute démarre au close précédent et son high/low encadre open/close,
 * donc toutes les agrégations de timeframes supérieurs restent cohérentes. Une
 * dérive lente (somme de sinusoïdes à phases pseudo-aléatoires) donne au jour
 * une direction au lieu du bruit blanc.
 */
export function generateSyntheticSession(date: string, spec: InstrumentSpec = NQ): OhlcBar[] {
  const rnd = mulberry32(hashSeed(spec.id, date));
  const base = spec.typicalRange.min + rnd() * (spec.typicalRange.max - spec.typicalRange.min);
  const sessions = sessionsOf(date);
  const tick = spec.tickSize;
  const ethSpan = sessions.ethEnd - sessions.ethStart;

  // Le jour a un caractère : amplitude bornée (0.4 à 1 % de l'échelle), une
  // direction, repassé par l'ouverture en fin de fenêtre — l'arc sinus donne
  // une respiration propre au lieu de la marche aléatoire sans garde-fou.
  const amp = base * (0.004 + rnd() * 0.006);
  const dir = rnd() > 0.5 ? 1 : -1;
  const phase = rnd() * Math.PI * 2;

  const bars: OhlcBar[] = [];
  let prev = base;
  let ms = sessions.ethStart;
  while (ms < sessions.ethEnd) {
    const f = (ms - sessions.ethStart) / ethSpan;
    const hump = dir * amp * Math.sin(Math.PI * f + phase * 0.2);
    const { hh, mm } = nyHm(ms);
    const size = tick * (3 + rnd() * 8) * volFactor(hh, mm);
    const micro = (rnd() - 0.5) * size * 1.6;
    const open = prev;
    const close = base + hump + micro;
    const high = Math.max(open, close) + Math.max(tick, rnd() * size * 0.6);
    const low = Math.min(open, close) - Math.max(tick, rnd() * size * 0.6);
    const volume = Math.max(1, Math.round(40 + rnd() * 240 * volFactor(hh, mm)));
    const bar: OhlcBar = {
      time: ms,
      open: roundToTick(open, spec),
      high: roundToTick(high, spec),
      low: roundToTick(low, spec),
      close: roundToTick(close, spec),
      volume,
    };
    prev = bar.close;
    bars.push(bar);
    ms += 60_000;
  }
  return bars;
}

/** La date de cotation d'un choix calendaire : le weekend rejoue le vendredi. */
export function sessionDateKey(selected: string): string {
  const dow = nyDow(selected);
  if (dow === 0 || dow === 6) return previousTradingDate(selected);
  return selected;
}

export { nyDateOf } from "./calendar";
