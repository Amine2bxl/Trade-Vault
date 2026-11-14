/**
 * LES ACTIFS SUIVIS PAR LA SAISONNALITÉ DE MARCHÉ — une seule table.
 *
 * Chaque actif porte son code chez chacun des trois fournisseurs, dans
 * l'ordre où ils sont essayés : Yahoo Finance (historique mensuel le plus
 * long), Stooq (CSV mensuel), FRED (séries quotidiennes de la Fed de
 * Saint-Louis, ramenées en fin de mois). Un code absent : ce fournisseur ne
 * couvre pas l'actif, la chaîne passe au suivant.
 */
import type { AssetCategory } from "./types";

export interface TrackedAsset {
  symbol: string;
  name: string;
  category: AssetCategory;
  yahoo?: string;
  stooq?: string;
  fred?: string;
}

export const TRACKED_ASSETS: readonly TrackedAsset[] = [
  {
    symbol: "SPX",
    name: "S&P 500",
    category: "indices",
    yahoo: "^GSPC",
    stooq: "^spx",
    fred: "SP500",
  },
  {
    symbol: "NDX",
    name: "Nasdaq 100",
    category: "indices",
    yahoo: "^NDX",
    stooq: "^ndx",
    fred: "NASDAQ100",
  },
  {
    symbol: "DJI",
    name: "Dow Jones 30",
    category: "indices",
    yahoo: "^DJI",
    stooq: "^dji",
    fred: "DJIA",
  },
  { symbol: "RUT", name: "Russell 2000", category: "indices", yahoo: "^RUT", stooq: "^rut" },
  { symbol: "DAX", name: "DAX 40", category: "indices", yahoo: "^GDAXI", stooq: "^dax" },
  { symbol: "FTSE", name: "FTSE 100", category: "indices", yahoo: "^FTSE", stooq: "^ukx" },
  {
    symbol: "NKY",
    name: "Nikkei 225",
    category: "indices",
    yahoo: "^N225",
    stooq: "^nkx",
    fred: "NIKKEI225",
  },
  {
    symbol: "EURUSD",
    name: "EUR/USD",
    category: "forex",
    yahoo: "EURUSD=X",
    stooq: "eurusd",
    fred: "DEXUSEU",
  },
  {
    symbol: "GBPUSD",
    name: "GBP/USD",
    category: "forex",
    yahoo: "GBPUSD=X",
    stooq: "gbpusd",
    fred: "DEXUSUK",
  },
  {
    symbol: "USDJPY",
    name: "USD/JPY",
    category: "forex",
    yahoo: "JPY=X",
    stooq: "usdjpy",
    fred: "DEXJPUS",
  },
  {
    symbol: "AUDUSD",
    name: "AUD/USD",
    category: "forex",
    yahoo: "AUDUSD=X",
    stooq: "audusd",
    fred: "DEXUSAL",
  },
  { symbol: "XAUUSD", name: "Gold", category: "commodities", yahoo: "GC=F", stooq: "xauusd" },
  { symbol: "XAGUSD", name: "Silver", category: "commodities", yahoo: "SI=F", stooq: "xagusd" },
  {
    symbol: "WTI",
    name: "WTI Crude Oil",
    category: "commodities",
    yahoo: "CL=F",
    stooq: "cl.f",
    fred: "DCOILWTICO",
  },
  {
    symbol: "NG",
    name: "Natural Gas",
    category: "commodities",
    yahoo: "NG=F",
    stooq: "ng.f",
    fred: "DHHNGSP",
  },
  {
    symbol: "BTCUSD",
    name: "Bitcoin",
    category: "crypto",
    yahoo: "BTC-USD",
    stooq: "btcusd",
    fred: "CBBTCUSD",
  },
  {
    symbol: "ETHUSD",
    name: "Ethereum",
    category: "crypto",
    yahoo: "ETH-USD",
    stooq: "ethusd",
    fred: "CBETHUSD",
  },
];
