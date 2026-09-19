import type { SupabaseClient } from "@supabase/supabase-js";
import type { Trade } from "@/app/types";

/**
 * L'accès aux trades DU CÔTÉ SERVEUR, pour les outils de Jarvis.
 *
 * Pourquoi ce module existe alors que `app/store/trades.ts` fait déjà la même
 * lecture : ce dernier importe le client Supabase du NAVIGATEUR et lit
 * `getActiveAccountId()` dans un état de module. Il ne peut donc ni s'exécuter
 * ici, ni recevoir une identité qui n'est pas celle de l'onglet courant. Un
 * outil, lui, s'exécute pour l'utilisateur que le contexte lui donne — jamais
 * pour « celui qui est connecté », notion qui n'existe pas côté serveur.
 *
 * RIEN N'EST RECALIBRÉ À LA LECTURE. Le recalibrage d'échelle de compte est un
 * ÉVÉNEMENT SQL unique (voir l'en-tête de `utils/accountCalibration.ts`) : les
 * montants stockés sont déjà à l'échelle courante. Les convertir ici les
 * multiplierait une seconde fois.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export type AnyClient = SupabaseClient<any, any, any>;

/** Les colonnes que les moteurs déterministes consomment, et rien de plus :
 *  ni notes ni captures d'écran, qui n'entrent dans aucun calcul et gonfleraient
 *  la réponse rendue au modèle. */
export const TRADE_COLS =
  "id, trade_date, symbol, direction, pnl, risk_amount, r_multiple, strategy, mistakes, setup_quality, entry_time, exit_time, confluences, confidence, mae, mfe";

interface TradeRow {
  id: string;
  trade_date: string;
  symbol: string | null;
  direction: string | null;
  pnl: number | null;
  risk_amount: number | null;
  r_multiple: number | null;
  strategy: string | null;
  mistakes: string[] | null;
  setup_quality: number | null;
  entry_time: string | null;
  exit_time: string | null;
  confluences: string[] | null;
  confidence: number | null;
  mae: number | null;
  mfe: number | null;
}

function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function rowToTrade(r: TradeRow): Trade {
  const dir = r.direction === "short" ? "short" : r.direction === "be" ? "be" : "long";
  return {
    id: r.id,
    date: r.trade_date,
    symbol: r.symbol ?? "",
    direction: dir,
    pnl: num(r.pnl),
    riskAmount: num(r.risk_amount),
    rMultiple: num(r.r_multiple),
    strategy: r.strategy ?? "",
    mistakes: r.mistakes ?? [],
    setupQuality: num(r.setup_quality),
    // Les moteurs n'en ont pas besoin, mais le type les exige.
    notes: "",
    screenshots: [],
    entryTime: r.entry_time ?? "",
    exitTime: r.exit_time ?? "",
    confluences: r.confluences ?? [],
    confidence: num(r.confidence),
    mae: r.mae,
    mfe: r.mfe,
  };
}

export interface LoadTradesOptions {
  /** Le compte actif du trader. `null`/absent = tous ses comptes — c'est
   *  exactement la règle de `app/store/trades.ts`, pour que Jarvis voie le même
   *  journal que la page qui l'a ouvert. */
  accountId?: string | null;
  /** Bornes de dates de marché incluses, format `YYYY-MM-DD`. */
  since?: string;
  until?: string;
}

/**
 * Les trades d'UN utilisateur, du plus récent au plus ancien.
 *
 * `eq("user_id", userId)` est non négociable : le client de service contourne
 * la RLS, donc le cloisonnement est porté par cette ligne. Elle est ici, dans
 * l'unique chemin de lecture des outils, et nulle part ailleurs.
 */
export async function loadTrades(
  sb: AnyClient,
  userId: string,
  opts: LoadTradesOptions = {},
): Promise<Trade[]> {
  let q = sb
    .from("trades")
    .select(TRADE_COLS)
    .eq("user_id", userId)
    .order("trade_date", { ascending: false });
  if (opts.accountId) q = q.eq("account_id", opts.accountId);
  if (opts.since) q = q.gte("trade_date", opts.since);
  if (opts.until) q = q.lte("trade_date", opts.until);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as TradeRow[]).map(rowToTrade);
}
