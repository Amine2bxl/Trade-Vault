/**
 * QUELLES DEVISES UN TRADE EXPOSE — module PUR.
 *
 * Le calendrier économique publie par DEVISE (USD, EUR…), le journal par
 * SYMBOLE (NQ, EURUSD, GC…). Rien ne reliait les deux : une alerte « CPI USD »
 * partait pour un trader qui ne trade que l'EUR/GBP, et aucun trade ne savait
 * quelles annonces avaient eu lieu le jour où il a été pris. Ce module fait le
 * pont, en restant volontairement simple : la devise dans laquelle l'actif est
 * coté et celle(s) dont les annonces le font bouger.
 *
 *   • paire de devises (EURUSD, EUR/USD, 6E…) → les deux devises ;
 *   • indices US, matières premières cotées en dollars, crypto → USD ;
 *   • indices européens / britanniques / japonais → leur devise ;
 *   • symbole inconnu → aucune devise (on ne devine pas).
 */
import { todayLocalDate } from "@/shared/calendar-date";

/** Les devises que publie le calendrier (Forex Factory). */
export const CALENDAR_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CHF",
  "CAD",
  "AUD",
  "NZD",
  "CNY",
] as const;
export type CalendarCurrency = (typeof CALENDAR_CURRENCIES)[number];

const IS_CCY = new Set<string>(CALENDAR_CURRENCIES);

/** Racines de futures et noms de CFD → devises qui les font bouger. */
const ROOTS: Record<string, CalendarCurrency[]> = {
  // Indices US (et leurs micros / CFD)
  NQ: ["USD"],
  MNQ: ["USD"],
  ES: ["USD"],
  MES: ["USD"],
  YM: ["USD"],
  MYM: ["USD"],
  RTY: ["USD"],
  M2K: ["USD"],
  NAS100: ["USD"],
  US100: ["USD"],
  USTEC: ["USD"],
  NDX: ["USD"],
  SPX: ["USD"],
  SPX500: ["USD"],
  US500: ["USD"],
  US30: ["USD"],
  DJI: ["USD"],
  SPY: ["USD"],
  QQQ: ["USD"],
  // Taux US
  ZB: ["USD"],
  ZN: ["USD"],
  ZF: ["USD"],
  ZT: ["USD"],
  // Matières premières cotées en dollars
  GC: ["USD"],
  MGC: ["USD"],
  GOLD: ["USD"],
  XAU: ["USD"],
  SI: ["USD"],
  SIL: ["USD"],
  SILVER: ["USD"],
  XAG: ["USD"],
  CL: ["USD"],
  MCL: ["USD"],
  WTI: ["USD"],
  USOIL: ["USD"],
  UKOIL: ["USD"],
  BRENT: ["USD"],
  NG: ["USD"],
  HG: ["USD"],
  // Indices hors US
  FDAX: ["EUR"],
  DAX: ["EUR"],
  GER40: ["EUR"],
  DE40: ["EUR"],
  FESX: ["EUR"],
  EU50: ["EUR"],
  STOXX50: ["EUR"],
  CAC40: ["EUR"],
  FRA40: ["EUR"],
  UK100: ["GBP"],
  FTSE: ["GBP"],
  JP225: ["JPY"],
  NKD: ["JPY"],
  NIKKEI: ["JPY"],
  // Futures de devises CME
  "6E": ["EUR", "USD"],
  M6E: ["EUR", "USD"],
  "6B": ["GBP", "USD"],
  M6B: ["GBP", "USD"],
  "6J": ["JPY", "USD"],
  "6A": ["AUD", "USD"],
  M6A: ["AUD", "USD"],
  "6C": ["CAD", "USD"],
  "6S": ["CHF", "USD"],
  "6N": ["NZD", "USD"],
  // Crypto : ses mouvements de journée suivent les annonces US
  BTC: ["USD"],
  MBT: ["USD"],
  ETH: ["USD"],
  MET: ["USD"],
  SOL: ["USD"],
};

/** Mois de contrat (H, M, U, Z…) + année : « NQZ5 », « ESH26 ». */
const CONTRACT_SUFFIX = /^([A-Z0-9]{1,6}?)[FGHJKMNQUVXZ]\d{1,2}$/;

/** « CME_MINI:NQ1! », « eurusd.pro », « EUR/USD » → « NQ1 », « EURUSD », « EURUSD ». */
export function normalizeSymbol(raw: string): string {
  let s = (raw ?? "").toUpperCase().trim();
  if (s.includes(":")) s = s.slice(s.lastIndexOf(":") + 1);
  s = s.replace(/\.[A-Z0-9]+$/, "");
  return s.replace(/[^A-Z0-9]/g, "");
}

/**
 * Les devises dont les annonces font bouger ce symbole — vide si inconnu.
 * L'ordre suit le symbole (devise de base d'abord pour une paire).
 */
export function currenciesForSymbol(raw: string): CalendarCurrency[] {
  const s = normalizeSymbol(raw);
  if (!s) return [];

  // Paire de devises : six lettres, deux devises connues (XAUUSD inclus).
  if (/^[A-Z]{6}$/.test(s)) {
    const a = s.slice(0, 3);
    const b = s.slice(3);
    if (IS_CCY.has(a) && IS_CCY.has(b)) return [a, b] as CalendarCurrency[];
    if ((a === "XAU" || a === "XAG") && IS_CCY.has(b)) return [b as CalendarCurrency];
  }
  // Crypto cotée contre une devise : BTCUSD, ETHUSDT…
  const crypto = /^(BTC|ETH|SOL|XRP|LTC)(USDT?|USDC|EUR)?$/.exec(s);
  if (crypto) return crypto[2] === "EUR" ? ["EUR", "USD"] : ["USD"];

  const direct = ROOTS[s];
  if (direct) return direct;
  // Contrat continu (« NQ1 ») ou daté (« NQZ5 », « ESH26 »).
  const continuous = /^([A-Z0-9]+?)[12]$/.exec(s);
  if (continuous && ROOTS[continuous[1]]) return ROOTS[continuous[1]];
  const dated = CONTRACT_SUFFIX.exec(s);
  if (dated && ROOTS[dated[1]]) return ROOTS[dated[1]];
  return [];
}

/** Les marchés déclarés à l'onboarding, quand le journal est encore vide. */
const MARKET_FALLBACK: Record<string, CalendarCurrency[]> = {
  futures: ["USD"],
  stocks: ["USD"],
  options: ["USD"],
  crypto: ["USD"],
  forex: ["USD", "EUR", "GBP", "JPY"],
};

export interface CurrencyFocus {
  /** Les devises qui comptent pour ce trader, de la plus tradée à la moins. */
  currencies: CalendarCurrency[];
  /** Part des trades récents exposés à chaque devise (0–1). */
  share: Partial<Record<CalendarCurrency, number>>;
  /** Nombre de trades récents sur lesquels la sélection repose. */
  basedOn: number;
}

/**
 * LES DEVISES QUI COMPTENT POUR CE TRADER — d'après ce qu'il trade VRAIMENT.
 *
 * Les 60 derniers jours de son journal (ou tout le journal s'il en contient
 * moins de cinq trades récents) ; une devise compte si au moins 10 % de ces
 * trades y sont exposés — un essai isolé sur l'AUD ne doit pas faire sonner
 * le téléphone à chaque RBA. Sans journal exploitable, les marchés déclarés
 * à l'onboarding prennent le relais.
 */
export function currencyFocus(
  trades: { symbol: string; date: string }[],
  declaredMarkets: string[] = [],
  today: string = todayLocalDate(),
): CurrencyFocus {
  const since = shiftDate(today, -60);
  let pool = trades.filter((t) => t.date >= since);
  if (pool.length < 5) pool = trades;

  const counts = new Map<CalendarCurrency, number>();
  let exposed = 0;
  for (const t of pool) {
    const ccys = currenciesForSymbol(t.symbol);
    if (!ccys.length) continue;
    exposed++;
    for (const c of ccys) counts.set(c, (counts.get(c) ?? 0) + 1);
  }

  if (exposed > 0) {
    const share: Partial<Record<CalendarCurrency, number>> = {};
    const kept = [...counts.entries()]
      .map(([c, n]) => [c, n / exposed] as const)
      .filter(([, s]) => s >= 0.1)
      .sort((a, b) => b[1] - a[1]);
    for (const [c, s] of kept) share[c] = Math.round(s * 100) / 100;
    return { currencies: kept.map(([c]) => c), share, basedOn: exposed };
  }

  const fromMarkets = new Set<CalendarCurrency>();
  for (const m of declaredMarkets) for (const c of MARKET_FALLBACK[m] ?? []) fromMarkets.add(c);
  return { currencies: [...fromMarkets], share: {}, basedOn: 0 };
}

/** `YYYY-MM-DD` décalé de `days` jours — arithmétique de date pure, à midi
 *  UTC pour qu'aucun fuseau ne fasse changer de jour. */
function shiftDate(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
