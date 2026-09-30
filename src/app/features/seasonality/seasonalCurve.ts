import type { SeasonalAsset } from "./assetSeasonality";
import type { Trade } from "@/app/types";

/**
 * LA COURBE SAISONNIÈRE — la même donnée que les barres, lue autrement.
 *
 * Les barres disent « mars rapporte +1,1 % en moyenne ». Elles ne disent pas
 * où l'année moyenne culmine, combien elle rend entre deux points, ni ce qu'il
 * reste à courir d'ici décembre. La courbe les compose : on part de 0 % au
 * 1er janvier et chaque mois applique son rendement moyen au capital déjà
 * accumulé (composition, pas somme). C'est la « saison moyenne » de l'actif.
 */
export interface SeasonalPoint {
  /** 0 = départ (1er janvier), 1..12 = fin du mois m-1. */
  step: number;
  /** Rendement cumulé en %. */
  cum: number;
}

export function seasonalPath(monthlyAvg: number[]): SeasonalPoint[] {
  const out: SeasonalPoint[] = [{ step: 0, cum: 0 }];
  let capital = 1;
  monthlyAvg.forEach((avg, i) => {
    capital *= 1 + avg / 100;
    out.push({ step: i + 1, cum: round2((capital - 1) * 100) });
  });
  return out;
}

export interface SeasonalReading {
  /** Rendement de l'année moyenne complète (composé). */
  year: number;
  /** Du 1er janvier au début du mois courant. */
  toDate: number;
  /** Du début du mois courant au 31 décembre. */
  remaining: number;
  /** Mois (0–11) à la fin duquel la courbe culmine, et sa valeur. */
  peak: { month: number; cum: number };
  /** Mois à la fin duquel elle touche son point bas. */
  trough: { month: number; cum: number };
  /** Plus forte baisse de la saison moyenne, de sommet à creux, en %. */
  maxDrawdown: number;
}

export function readSeasonalPath(path: SeasonalPoint[], currentMonth: number): SeasonalReading {
  const factor = (p: SeasonalPoint) => 1 + p.cum / 100;
  const end = path[path.length - 1];
  const start = path[currentMonth];
  let peak = path[1];
  let trough = path[1];
  let top = factor(path[0]);
  let mdd = 0;
  for (const p of path.slice(1)) {
    if (p.cum > peak.cum) peak = p;
    if (p.cum < trough.cum) trough = p;
    top = Math.max(top, factor(p));
    mdd = Math.max(mdd, 1 - factor(p) / top);
  }
  return {
    year: end.cum,
    toDate: start.cum,
    remaining: round2((factor(end) / factor(start) - 1) * 100),
    peak: { month: peak.step - 1, cum: peak.cum },
    trough: { month: trough.step - 1, cum: trough.cum },
    maxDrawdown: round2(mdd * 100),
  };
}

/**
 * LES TRADES DU JOURNAL QUI PORTENT SUR CET ACTIF.
 *
 * Un même marché s'écrit de dix façons selon le courtier : le S&P 500 est
 * « US500 », « SPX500 », « ES », « US500.cash »… On compare des symboles
 * normalisés (majuscules, alphanumérique seul, suffixes de courtier retirés)
 * à une liste d'alias explicite — pas de correspondance floue qui rangerait
 * « ETHUSD » sous « ETH » ET « USD ».
 */
const ALIASES: Record<string, string[]> = {
  SPX: ["SPX", "SPX500", "US500", "SP500", "ES", "MES", "SPY", "USA500"],
  NDX: ["NDX", "NAS100", "NASDAQ", "NASDAQ100", "US100", "USTEC", "NQ", "MNQ", "QQQ", "USTECH"],
  DAX: ["DAX", "DAX40", "GER40", "GER30", "DE40", "DE30", "FDAX", "DEU40"],
  EURUSD: ["EURUSD", "6E", "M6E"],
  GBPUSD: ["GBPUSD", "6B", "M6B"],
  USDJPY: ["USDJPY", "6J"],
  XAUUSD: ["XAUUSD", "GOLD", "GC", "MGC", "XAU"],
  WTI: ["WTI", "USOIL", "CL", "MCL", "XTIUSD", "OIL", "CRUDE", "USOUSD", "WTIUSD"],
  XAGUSD: ["XAGUSD", "SILVER", "SI", "SIL", "XAG"],
  NATGAS: ["NATGAS", "NG", "XNGUSD", "NGAS", "NATURALGAS"],
  BTC: ["BTC", "BTCUSD", "BTCUSDT", "XBTUSD", "BTCEUR", "BTCUSDC", "MBT", "BITCOIN"],
  ETH: ["ETH", "ETHUSD", "ETHUSDT", "ETHEUR", "ETHUSDC", "MET", "ETHEREUM"],
  AAPL: ["AAPL", "APPLE"],
  TSLA: ["TSLA", "TESLA"],
  NVDA: ["NVDA", "NVIDIA"],
};

/** Suffixes de courtier (« cash », « pro »…) et échéances de futures (« Z4 »,
 *  « H25 »). Retirés en SECOND essai seulement : « DAX40 » finit par « X40 »,
 *  qui ressemble à une échéance, et doit d'abord être comparé tel quel. */
const SUFFIX = /(CASH|SPOT|PRO|ECN|RAW|MICRO|MINI|M|[FGHJKMNQUVXZ]\d{1,2})$/;

/** « BINANCE:BTCUSDT » → « BTCUSDT », « US500.cash » → « US500 », « EUR/USD » → « EURUSD ». */
export function normalizeSymbol(raw: string): string {
  let s = raw.trim().toUpperCase();
  if (s.includes(":")) s = s.slice(s.lastIndexOf(":") + 1);
  if (s.includes(".")) s = s.slice(0, s.indexOf("."));
  return s.replace(/[^A-Z0-9]/g, "");
}

export function tradeMatchesAsset(symbol: string, asset: Pick<SeasonalAsset, "symbol">): boolean {
  const aliases = ALIASES[asset.symbol] ?? [asset.symbol];
  const s = normalizeSymbol(symbol);
  if (!s) return false;
  if (aliases.includes(s)) return true;
  const stripped = s.replace(SUFFIX, "");
  return stripped.length >= 2 && stripped !== s && aliases.includes(stripped);
}

export interface TradeEquityPoint {
  i: number;
  date: string;
  pnl: number;
  cum: number;
}

/** L'equity réelle du trader sur cet actif : ses trades, dans l'ordre. */
export function assetEquity(trades: Trade[], asset: Pick<SeasonalAsset, "symbol">) {
  const mine = trades
    .filter((t) => tradeMatchesAsset(t.symbol, asset))
    .sort((a, b) =>
      a.date === b.date
        ? (a.entryTime || "").localeCompare(b.entryTime || "")
        : a.date.localeCompare(b.date),
    );
  let cum = 0;
  const points: TradeEquityPoint[] = mine.map((t, i) => {
    cum += t.pnl;
    return { i: i + 1, date: t.date, pnl: t.pnl, cum: round2(cum) };
  });
  // P&L par mois CIVIL, toutes années confondues : se lit contre le biais.
  const byMonth = Array.from({ length: 12 }, () => ({ pnl: 0, trades: 0 }));
  for (const t of mine) {
    const m = Number(t.date.slice(5, 7)) - 1;
    if (m >= 0 && m < 12) {
      byMonth[m].pnl += t.pnl;
      byMonth[m].trades += 1;
    }
  }
  const symbols = [...new Set(mine.map((t) => t.symbol))];
  return { points, byMonth, symbols, total: round2(cum) };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
