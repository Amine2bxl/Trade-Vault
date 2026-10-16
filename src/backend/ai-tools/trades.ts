import type { SupabaseClient } from "@supabase/supabase-js";
import type { Trade } from "@/domain/trade";

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
 * ÉVÉNEMENT SQL unique (voir l'en-tête de `app/trading/accountCalibration.ts`) : les
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
 * Taille d'une page de lecture — la même que le journal client
 * (`app/store/trades.ts`).
 *
 * PostgREST plafonne TOUTE réponse à `db.max_rows` (1 000 chez Supabase) sans
 * le signaler. Une lecture sans `.range()` rendait donc les mille trades les
 * plus récents et calculait des statistiques « sur cinq ans » à partir d'eux :
 * Jarvis citait un win rate différent de celui du tableau de bord, qui pagine
 * (bug B7 de l'audit).
 */
export const TRADES_PAGE_SIZE = 1000;

/** Même garde-fou que le journal client : au-delà, on s'arrête et on le dit. */
export const TRADES_HARD_CAP = 50_000;

export interface LoadedTrades {
  trades: Trade[];
  /** `true` quand le garde-fou a coupé l'historique — à DIRE au modèle. */
  truncated: boolean;
}

/**
 * Les trades d'UN utilisateur, du plus récent au plus ancien, EN ENTIER.
 *
 * `eq("user_id", userId)` est non négociable : le client de service contourne
 * la RLS, donc le cloisonnement est porté par cette ligne. Elle est ici, dans
 * l'unique chemin de lecture des outils, et nulle part ailleurs.
 *
 * Tri stable `trade_date` puis `id` : sans départage, deux pages peuvent rendre
 * la même ligne et en sauter une autre.
 */
export async function loadTradesWithMeta(
  sb: AnyClient,
  userId: string,
  opts: LoadTradesOptions = {},
): Promise<LoadedTrades> {
  const trades: Trade[] = [];
  for (let from = 0; from < TRADES_HARD_CAP; from += TRADES_PAGE_SIZE) {
    let q = sb.from("trades").select(TRADE_COLS).eq("user_id", userId);
    if (opts.accountId) q = q.eq("account_id", opts.accountId);
    if (opts.since) q = q.gte("trade_date", opts.since);
    if (opts.until) q = q.lte("trade_date", opts.until);
    const { data, error } = await q
      .order("trade_date", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + TRADES_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as TradeRow[];
    for (const r of rows) trades.push(rowToTrade(r));
    if (rows.length < TRADES_PAGE_SIZE) return { trades, truncated: false };
  }
  console.warn(`[ai-tools] historique tronqué à ${TRADES_HARD_CAP} trades pour ${userId}`);
  return { trades, truncated: true };
}

/** Les trades seuls — pour les appelants qui n'ont pas à signaler la coupure. */
export async function loadTrades(
  sb: AnyClient,
  userId: string,
  opts: LoadTradesOptions = {},
): Promise<Trade[]> {
  return (await loadTradesWithMeta(sb, userId, opts)).trades;
}

/**
 * Les NOTES de quelques trades, lues à part.
 *
 * `TRADE_COLS` ne les sélectionne pas, et c'est voulu : aucun moteur ne les
 * consomme, et les lire pour cinq ans d'historique ferait transiter des
 * mégaoctets de texte pour en rendre une poignée. Mais `get_trades` et
 * `get_day` PROMETTENT les notes au modèle — et les rendaient toujours `null`
 * (bug B2) : Jarvis pouvait dire « tu n'as rien noté » à un trader qui avait
 * tout écrit. On lit donc les notes des seules lignes renvoyées, bornées.
 */
export async function loadTradeNotes(
  sb: AnyClient,
  userId: string,
  ids: readonly string[],
): Promise<Map<string, string>> {
  const notes = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return notes;
  const { data, error } = await sb
    .from("trades")
    .select("id, notes")
    .eq("user_id", userId)
    .in("id", unique);
  if (error) throw new Error(error.message);
  for (const r of (data ?? []) as { id: string; notes: string | null }[]) {
    if (typeof r.notes === "string" && r.notes.trim()) notes.set(r.id, r.notes);
  }
  return notes;
}
