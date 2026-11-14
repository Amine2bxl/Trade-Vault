/**
 * LES PROCHAINS TRADES, TIRÉS DE TON JOURNAL — module PUR.
 *
 * La page Analyses montre ce que le laboratoire Monte Carlo montre, sans
 * réglage : « où finissent tes 100 prochains trades » et « à quelle
 * fréquence un drawdown est dépassé », tirés de TES résultats (rééchantillon-
 * nage du moteur `projectStrategy`, graine fixe : mêmes trades, mêmes
 * chiffres). Aucune hypothèse inventée : le risque par trade est la médiane
 * des risques saisis, à défaut la perte médiane — l'unité même du modèle
 * historique.
 *
 * Sous `OUTLOOK_MIN_TRADES` trades réels, aucun chiffre : rééchantillonner
 * une poignée d'issues ne ferait que les rejouer.
 */
import { historicalModel, projectStrategy, type StrategyProjection } from "./strategy";

export const OUTLOOK_MIN_TRADES = 20;
export const OUTLOOK_TRADES = 100;
export const OUTLOOK_RUNS = 2_000;
const OUTLOOK_SEED = 204810;

export interface OutlookTrade {
  pnl: number;
  riskAmount?: number | null;
  rMultiple?: number;
  isExample?: boolean;
  broker?: string | null;
  reviewPending?: boolean;
  date?: string;
  entryAt?: string | null;
}

export interface JournalOutlook {
  projection: StrategyProjection;
  /** Montant d'un R dans la projection (médiane des risques, sinon perte médiane). */
  riskPerTrade: number;
  /** Seuil de lecture du drawdown : 10 % du capital. */
  drawdownLimit: number;
  /** Trades réels qui nourrissent le tirage. */
  sample: number;
}

const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function journalOutlook(
  trades: readonly OutlookTrade[],
  balance: number,
): JournalOutlook | null {
  const real = trades.filter((t) => !t.isExample && Number.isFinite(t.pnl));
  if (real.length < OUTLOOK_MIN_TRADES || !(balance > 0)) return null;
  const model = historicalModel(real);
  if (model.values.length < OUTLOOK_MIN_TRADES) return null;

  const risks = real.map((t) => t.riskAmount ?? 0).filter((r) => r > 0 && Number.isFinite(r));
  const losses = real.filter((t) => t.pnl < 0).map((t) => -t.pnl);
  const riskPerTrade = Math.max(1, Math.round(risks.length ? median(risks) : median(losses)));
  const days = new Set(real.map((t) => t.date).filter(Boolean)).size;
  const drawdownLimit = Math.max(1, Math.round(balance * 0.1));

  const projection = projectStrategy(
    model,
    {
      balance,
      risk: Math.min(balance, riskPerTrade),
      trades: OUTLOOK_TRADES,
      perDay: days ? Math.min(10, Math.max(1, Math.round(real.length / days))) : 2,
      extraCost: 0,
      target: Math.max(1, Math.round(balance * 0.1)),
      lossLimit: drawdownLimit,
      dailyLimit: 0,
      drawdownType: "static",
      seed: OUTLOOK_SEED,
    },
    OUTLOOK_RUNS,
  );
  return { projection, riskPerTrade, drawdownLimit, sample: model.values.length };
}
