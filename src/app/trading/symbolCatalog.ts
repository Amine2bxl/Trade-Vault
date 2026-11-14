/**
 * QUEL LOGO POUR QUEL SYMBOLE — module PUR (aucune image importée ici).
 *
 * Le journal écrivait « NQ », « EURUSD », « BTC » en lettres nues : vingt
 * lignes identiques à l'œil, alors qu'un trader reconnaît son instrument à sa
 * marque avant de lire son nom. Ce module répond à une seule question — quel
 * logo désigne ce symbole — et sert aussi le CATALOGUE proposé à la saisie
 * d'un trade. Une seule table : ce que la liste propose a forcément un logo.
 *
 * Règle d'honnêteté : un symbole inconnu ne reçoit AUCUN logo (le composant
 * retombe sur ses initiales). On ne devine pas une marque.
 */
import { futuresSpecFor, FUTURES_SPECS } from "@/domain/futuresContracts";
import { normalizeSymbol } from "@/domain/instrumentCurrency";

export type LogoKey =
  | "nasdaq"
  | "sp500"
  | "dow"
  | "russell"
  | "btc"
  | "eth"
  | "sol"
  | "xrp"
  | "ltc"
  | "gold"
  | "silver"
  | "copper"
  | "oil"
  | "gas"
  | `flag-${FlagCode}`;

export type FlagCode =
  | "us"
  | "eu"
  | "gb"
  | "jp"
  | "ch"
  | "ca"
  | "au"
  | "nz"
  | "cn"
  | "de"
  | "fr"
  | "hk";

/** Un logo seul, ou deux drapeaux qui se chevauchent pour une paire. */
export type SymbolLogo =
  | { kind: "single"; key: LogoKey }
  | { kind: "pair"; keys: [LogoKey, LogoKey] };

const FLAG_OF_CCY: Record<string, FlagCode> = {
  USD: "us",
  EUR: "eu",
  GBP: "gb",
  JPY: "jp",
  CHF: "ch",
  CAD: "ca",
  AUD: "au",
  NZD: "nz",
  CNY: "cn",
  CNH: "cn",
  HKD: "hk",
};

const single = (key: LogoKey): SymbolLogo => ({ kind: "single", key });
const fx = (a: string, b: string): SymbolLogo => ({
  kind: "pair",
  keys: [`flag-${FLAG_OF_CCY[a]}`, `flag-${FLAG_OF_CCY[b]}`],
});

/** Racines (futures, CFD, ETF) → logo. Les paires de devises sont déduites. */
const ROOTS: Record<string, SymbolLogo> = {
  // Nasdaq-100
  NQ: single("nasdaq"),
  MNQ: single("nasdaq"),
  NAS100: single("nasdaq"),
  US100: single("nasdaq"),
  USTEC: single("nasdaq"),
  NDX: single("nasdaq"),
  QQQ: single("nasdaq"),
  // S&P 500
  ES: single("sp500"),
  MES: single("sp500"),
  SPX: single("sp500"),
  SPX500: single("sp500"),
  US500: single("sp500"),
  SPY: single("sp500"),
  // Dow Jones
  YM: single("dow"),
  MYM: single("dow"),
  US30: single("dow"),
  DJI: single("dow"),
  // Russell 2000
  RTY: single("russell"),
  M2K: single("russell"),
  US2000: single("russell"),
  // Taux US, dollar index
  ZB: single("flag-us"),
  ZN: single("flag-us"),
  ZF: single("flag-us"),
  ZT: single("flag-us"),
  DXY: single("flag-us"),
  // Métaux, énergie
  GC: single("gold"),
  MGC: single("gold"),
  GOLD: single("gold"),
  XAU: single("gold"),
  SI: single("silver"),
  SIL: single("silver"),
  SILVER: single("silver"),
  XAG: single("silver"),
  HG: single("copper"),
  CL: single("oil"),
  MCL: single("oil"),
  WTI: single("oil"),
  USOIL: single("oil"),
  UKOIL: single("oil"),
  BRENT: single("oil"),
  NG: single("gas"),
  // Indices hors US : le drapeau de leur place
  FDAX: single("flag-de"),
  DAX: single("flag-de"),
  GER40: single("flag-de"),
  DE40: single("flag-de"),
  FESX: single("flag-eu"),
  EU50: single("flag-eu"),
  STOXX50: single("flag-eu"),
  CAC40: single("flag-fr"),
  FRA40: single("flag-fr"),
  UK100: single("flag-gb"),
  FTSE: single("flag-gb"),
  JP225: single("flag-jp"),
  NKD: single("flag-jp"),
  NIKKEI: single("flag-jp"),
  HK50: single("flag-hk"),
  // Futures de devises CME
  "6E": fx("EUR", "USD"),
  M6E: fx("EUR", "USD"),
  "6B": fx("GBP", "USD"),
  M6B: fx("GBP", "USD"),
  "6J": fx("JPY", "USD"),
  "6A": fx("AUD", "USD"),
  M6A: fx("AUD", "USD"),
  "6C": fx("CAD", "USD"),
  "6S": fx("CHF", "USD"),
  "6N": fx("NZD", "USD"),
  // Crypto (et leurs micros CME)
  BTC: single("btc"),
  MBT: single("btc"),
  XBT: single("btc"),
  ETH: single("eth"),
  MET: single("eth"),
  SOL: single("sol"),
  XRP: single("xrp"),
  LTC: single("ltc"),
};

/** Suffixe de contrat : continu (« 1 »), daté (« Z5 », « H26 »), mois écrit (« DEC25 »). */
const CONTRACT_REST = /^([12]|[FGHJKMNQUVXZ]\d{1,2}|[A-Z]{3}\d{2,4})$/;
const ROOT_KEYS = Object.keys(ROOTS).sort((a, b) => b.length - a.length);

/** « NQ », « MNQZ5 », « CME_MINI:NQ1! », « EUR/USD », « btcusdt » → son logo, ou `null`. */
export function symbolLogoFor(raw: string): SymbolLogo | null {
  const s = normalizeSymbol(raw);
  if (!s) return null;
  if (ROOTS[s]) return ROOTS[s];

  // Fiche futures connue (« MNQ DEC25 ») : la racine décide.
  const spec = futuresSpecFor(raw);
  if (spec && ROOTS[spec.symbol]) return ROOTS[spec.symbol];

  // Paire : six lettres, deux devises connues ; l'or et l'argent au comptant.
  if (/^[A-Z]{6}$/.test(s)) {
    const a = s.slice(0, 3);
    const b = s.slice(3);
    if (FLAG_OF_CCY[a] && FLAG_OF_CCY[b]) return fx(a, b);
    if (a === "XAU" && FLAG_OF_CCY[b]) return single("gold");
    if (a === "XAG" && FLAG_OF_CCY[b]) return single("silver");
  }
  // Crypto cotée contre une devise : BTCUSD, ETHUSDT…
  const crypto = /^(BTC|XBT|ETH|SOL|XRP|LTC)(USDT?|USDC|EUR|PERP)$/.exec(s);
  if (crypto) return ROOTS[crypto[1]];

  // Racine + échéance : « 6EZ5 », « GCG26 », « BTCH6 ».
  for (const root of ROOT_KEYS) {
    if (s.startsWith(root) && CONTRACT_REST.test(s.slice(root.length))) return ROOTS[root];
  }
  return null;
}

/* ── Le catalogue proposé à la saisie ─────────────────────────────────── */

export type SymbolGroup = "futures" | "forex" | "crypto" | "cfd";

export interface CatalogSymbol {
  symbol: string;
  /** Nom d'usage de l'instrument (nom propre : non traduit). */
  name: string;
  group: SymbolGroup;
}

const futures = (symbol: string, name: string): CatalogSymbol => ({
  symbol,
  name,
  group: "futures",
});

/** L'ordre est celui de la liste : les contrats les plus tradés d'abord. */
export const SYMBOL_CATALOG: readonly CatalogSymbol[] = [
  ...Object.values(FUTURES_SPECS).map((s) => futures(s.symbol, s.name)),
  futures("SI", "Silver"),
  futures("HG", "Copper"),
  futures("NG", "Natural Gas"),
  futures("ZN", "10-Year T-Note"),
  futures("ZB", "30-Year T-Bond"),
  futures("6E", "Euro FX"),
  futures("6B", "British Pound"),
  futures("6J", "Japanese Yen"),
  futures("6A", "Australian Dollar"),
  futures("FDAX", "DAX"),
  futures("FESX", "Euro Stoxx 50"),
  futures("NKD", "Nikkei 225"),
  futures("MBT", "Micro Bitcoin"),
  futures("MET", "Micro Ether"),
  ...(
    [
      ["EURUSD", "Euro / US Dollar"],
      ["GBPUSD", "British Pound / US Dollar"],
      ["USDJPY", "US Dollar / Japanese Yen"],
      ["USDCHF", "US Dollar / Swiss Franc"],
      ["AUDUSD", "Australian Dollar / US Dollar"],
      ["USDCAD", "US Dollar / Canadian Dollar"],
      ["NZDUSD", "New Zealand Dollar / US Dollar"],
      ["EURGBP", "Euro / British Pound"],
      ["EURJPY", "Euro / Japanese Yen"],
      ["GBPJPY", "British Pound / Japanese Yen"],
      ["AUDJPY", "Australian Dollar / Japanese Yen"],
      ["EURCHF", "Euro / Swiss Franc"],
      ["XAUUSD", "Gold spot"],
      ["XAGUSD", "Silver spot"],
    ] as const
  ).map(([symbol, name]): CatalogSymbol => ({ symbol, name, group: "forex" })),
  ...(
    [
      ["BTCUSD", "Bitcoin"],
      ["ETHUSD", "Ethereum"],
      ["SOLUSD", "Solana"],
      ["XRPUSD", "XRP"],
      ["LTCUSD", "Litecoin"],
    ] as const
  ).map(([symbol, name]): CatalogSymbol => ({ symbol, name, group: "crypto" })),
  ...(
    [
      ["NAS100", "Nasdaq-100"],
      ["US500", "S&P 500"],
      ["US30", "Dow Jones 30"],
      ["US2000", "Russell 2000"],
      ["GER40", "DAX 40"],
      ["UK100", "FTSE 100"],
      ["FRA40", "CAC 40"],
      ["EU50", "Euro Stoxx 50"],
      ["JP225", "Nikkei 225"],
      ["USOIL", "WTI Crude Oil"],
      ["UKOIL", "Brent Crude Oil"],
    ] as const
  ).map(([symbol, name]): CatalogSymbol => ({ symbol, name, group: "cfd" })),
];

/**
 * La liste du sélecteur : d'abord les symboles que le trader utilise DÉJÀ
 * (du plus fréquent au plus rare), puis le catalogue, sans doublon. Le
 * symbole en cours de saisie reste dans la liste même s'il est hors catalogue.
 */
export function symbolChoices(usedSymbols: readonly string[], current = ""): CatalogSymbol[] {
  const byName = new Map(SYMBOL_CATALOG.map((c) => [c.symbol, c]));
  const counts = new Map<string, number>();
  for (const raw of usedSymbols) {
    const s = raw.trim().toUpperCase();
    if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const mine = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  const cur = current.trim().toUpperCase();
  const head = cur && !counts.has(cur) && !byName.has(cur) ? [cur, ...mine] : mine;
  const seen = new Set(head);
  return [
    ...head.map((s) => byName.get(s) ?? { symbol: s, name: "", group: "futures" as const }),
    ...SYMBOL_CATALOG.filter((c) => !seen.has(c.symbol)),
  ];
}
