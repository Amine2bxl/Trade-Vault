import { supabase } from "@/integrations/supabase/client";
import { Trade } from "../types";
import { getActiveAccountId } from "./accounts";
import { storagePathsOf, removeScreenshotFiles, uploadScreenshot } from "./storage";
import { planLimitFromDbError } from "../utils/planLimits";

interface TradeRow {
  id: string;
  user_id?: string;
  account_id?: string | null;
  trade_date: string;
  symbol: string;
  direction: string;
  pnl: number;
  risk_amount: number;
  r_multiple: number;
  strategy: string;
  mistakes: string[];
  setup_quality: number;
  notes: string;
  screenshots: string[];
  entry_time: string;
  exit_time: string;
  confluences: string[];
  confidence: number;
  mae?: number | null;
  mfe?: number | null;
  slippage?: number | null;
  is_example?: boolean;
}

/** Ligne SQL → `Trade`. Exporté pour le temps réel : un événement Supabase
 *  livre exactement cette forme de ligne. */
export function rowToTrade(r: TradeRow): Trade {
  const dir = r.direction === "short" ? "short" : r.direction === "be" ? "be" : "long";
  return {
    id: r.id,
    date: r.trade_date,
    symbol: r.symbol,
    direction: dir,
    pnl: Number(r.pnl),
    riskAmount: Number(r.risk_amount),
    rMultiple: Number(r.r_multiple),
    strategy: r.strategy,
    mistakes: r.mistakes ?? [],
    setupQuality: r.setup_quality,
    notes: r.notes ?? "",
    screenshots: r.screenshots ?? [],
    entryTime: r.entry_time ?? "",
    exitTime: r.exit_time ?? "",
    confluences: r.confluences ?? [],
    confidence: r.confidence,
    mae: r.mae ?? null,
    mfe: r.mfe ?? null,
    slippage: r.slippage ?? null,
    isExample: !!r.is_example,
    // Le compte d'origine voyage AVEC le trade : c'est ce qui permet à une
    // modification de ne pas le déplacer vers le compte actif du moment.
    accountId: r.account_id ?? null,
  };
}

// Money values are rounded to cents at the storage boundary so float noise
// from client-side math (risk * R) never lands in the DB numeric columns.
const toCents = (n: number) => Math.round(n * 100) / 100;

function tradeToRow(t: Trade, userId: string): TradeRow {
  return {
    id: t.id,
    user_id: userId,
    // Le compte du TRADE d'abord, le compte actif seulement à défaut.
    //
    // Écrire `getActiveAccountId()` sans condition était un bug de données :
    // à chaque MODIFICATION, le trade était réaffecté au compte sélectionné à
    // cet instant. Modifier une note sur un trade du compte « Prop » depuis le
    // compte « Perso » le faisait disparaître du premier — et la migration des
    // captures d'écran, qui réécrit chaque trade concerné, pouvait déplacer un
    // lot entier d'un coup.
    account_id: t.accountId ?? getActiveAccountId() ?? null,
    trade_date: t.date,
    symbol: t.symbol,
    direction: t.direction,
    pnl: toCents(t.pnl),
    risk_amount: toCents(t.riskAmount),
    r_multiple: t.rMultiple,
    strategy: t.strategy,
    mistakes: t.mistakes,
    setup_quality: t.setupQuality,
    notes: t.notes,
    screenshots: t.screenshots,
    entry_time: t.entryTime,
    exit_time: t.exitTime,
    confluences: t.confluences,
    confidence: t.confidence,
    mae: t.mae != null ? toCents(t.mae) : null,
    mfe: t.mfe != null ? toCents(t.mfe) : null,
    slippage: t.slippage != null ? toCents(t.slippage) : null,
    is_example: !!t.isExample,
  };
}

// ── Trades ──

const TRADE_COLS =
  "id,user_id,account_id,trade_date,symbol,direction,pnl,risk_amount,r_multiple,strategy,mistakes,setup_quality,notes,screenshots,entry_time,exit_time,confluences,confidence,mae,mfe,slippage,is_example,created_at,updated_at";

/**
 * Taille d'une page de lecture.
 *
 * PostgREST plafonne toute réponse à `db.max_rows` — 1 000 chez Supabase. On
 * demande donc explicitement des pages de 1 000 et on les enchaîne, au lieu de
 * demander « tout » et de recevoir silencieusement les mille premiers.
 */
const READ_PAGE_SIZE = 1000;

/**
 * Garde-fou d'un historique anormalement grand.
 *
 * Cinquante mille trades, c'est déjà bien au-delà de ce qu'un particulier
 * accumule ; au-delà, on s'arrête et on le DIT dans la console plutôt que de
 * faire fondre l'onglet en silence.
 */
const READ_HARD_CAP = 50_000;

/**
 * L'historique du compte, EN ENTIER.
 *
 * ── LE BUG QUE CETTE PAGINATION CORRIGE ─────────────────────────────────────
 * La requête n'avait aucune borne, et `limit`/`offset` n'étaient passés par
 * aucun appelant. Or une requête PostgREST sans borne n'est pas « sans
 * limite » : elle est tronquée à `db.max_rows` (1 000). Un trader avec plus de
 * mille trades voyait donc, SANS AUCUN SIGNAL, un historique amputé — et tout
 * ce que le produit calcule dessus (win rate, expectancy, drawdown, edge par
 * session, Monte-Carlo) était faux, silencieusement, pour ses meilleurs
 * clients. Les pages s'enchaînent maintenant jusqu'à épuisement.
 *
 * Le produit a BESOIN de l'historique complet : chaque moteur statistique
 * raisonne sur l'ensemble. Paginer vers l'interface changerait les chiffres,
 * ce n'est donc pas ce qui est fait ici — on garantit seulement que « tout »
 * veut bien dire tout.
 *
 * `accountId` est passé EXPLICITEMENT et non lu depuis l'état de module : voir
 * `useTrades`, où la clé de cache et la requête doivent désigner le même compte.
 */
export async function loadUserTrades(
  userId: string,
  opts?: { accountId?: string | null },
): Promise<Trade[]> {
  const activeId = opts?.accountId !== undefined ? opts.accountId : getActiveAccountId();
  const out: Trade[] = [];

  for (let from = 0; from < READ_HARD_CAP; from += READ_PAGE_SIZE) {
    let q = supabase.from("trades").select(TRADE_COLS).eq("user_id", userId);
    if (activeId) q = q.eq("account_id", activeId);
    const { data, error } = await q
      // Tri STABLE : `trade_date` seul laisse l'ordre des trades du même jour à
      // la discrétion de Postgres, ce qui ferait qu'une page peut renvoyer deux
      // fois la même ligne et jamais une autre. `id` départage.
      .order("trade_date", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + READ_PAGE_SIZE - 1);
    if (error) throw error;

    const rows = (data ?? []) as TradeRow[];
    for (const row of rows) out.push(rowToTrade(row));
    if (rows.length < READ_PAGE_SIZE) return out;
  }

  console.warn(`[trades] historique tronqué à ${READ_HARD_CAP} lignes pour ${userId}`);
  return out;
}

export async function upsertTrade(userId: string, trade: Trade): Promise<void> {
  // RLS ensures auth.uid() = user_id on both INSERT and UPDATE.
  // The row's user_id is always set from the authenticated userId param.
  const { error } = await supabase.from("trades").upsert(tradeToRow(trade, userId));
  if (error) {
    // La limite mensuelle est aussi appliquée par un déclencheur Postgres : son
    // refus doit arriver à l'interface comme un moment de vente, pas comme une
    // erreur de contrainte SQL.
    const limit = planLimitFromDbError(error);
    if (limit) throw limit;
    throw error;
  }
}

/** Taille d'un lot d'import. Assez gros pour être rapide, assez petit pour
 *  qu'un échec réseau ne fasse pas perdre tout le fichier. */
export const IMPORT_BATCH_SIZE = 100;

/**
 * Écrit un import en LOTS SÉQUENTIELS.
 *
 * POURQUOI. L'import lançait auparavant une requête par trade, toutes en
 * parallèle : un fichier de 2 000 trades ouvrait 2 000 requêtes simultanées,
 * que le navigateur et Supabase finissaient par refuser. L'utilisateur voyait
 * « import réussi » avec la moitié de son historique manquante.
 *
 * Les lots avancent l'un après l'autre et rapportent leur progression, ce qui
 * donne enfin une barre de progression honnête. Un lot qui échoue est
 * retenté trade par trade : une seule ligne fautive ne doit pas emporter
 * les 99 autres.
 */
export async function importTrades(
  userId: string,
  trades: readonly Trade[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ saved: Trade[]; failed: number; planLimitReached: boolean }> {
  const saved: Trade[] = [];
  let failed = 0;
  // Vrai dès qu'une ligne a été refusée par la limite mensuelle de l'offre.
  // À distinguer d'un échec technique : ce n'est pas une panne, c'est le
  // produit qui dit non — et l'interface doit proposer l'offre supérieure au
  // lieu d'afficher « 490 trades ont échoué ».
  let planLimitReached = false;

  for (let i = 0; i < trades.length; i += IMPORT_BATCH_SIZE) {
    const batch = trades.slice(i, i + IMPORT_BATCH_SIZE);
    const { error } = await supabase.from("trades").upsert(batch.map((t) => tradeToRow(t, userId)));
    if (!error) {
      saved.push(...batch);
    } else {
      // Repli ligne à ligne pour isoler la ou les lignes réellement fautives.
      console.error("Batch import failed, retrying row by row", error);
      const results = await Promise.allSettled(
        batch.map((t) => supabase.from("trades").upsert(tradeToRow(t, userId))),
      );
      results.forEach((r, k) => {
        if (r.status === "fulfilled" && !r.value.error) {
          saved.push(batch[k]);
          return;
        }
        failed++;
        const rowError = r.status === "fulfilled" ? r.value.error : r.reason;
        if (planLimitFromDbError(rowError)) planLimitReached = true;
      });
      // Une fois la limite atteinte, les lots suivants échoueront tous : on
      // arrête plutôt que de lancer des centaines de requêtes vouées au refus.
      if (planLimitReached) {
        failed += trades.length - (i + batch.length);
        onProgress?.(trades.length, trades.length);
        break;
      }
    }
    onProgress?.(Math.min(i + batch.length, trades.length), trades.length);
  }
  return { saved, failed, planLimitReached };
}

export async function deleteTrade(userId: string, id: string): Promise<void> {
  const { data } = await supabase
    .from("trades")
    .select("screenshots")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.screenshots?.length) {
    await removeScreenshotFiles(storagePathsOf(data.screenshots));
  }
  const { error } = await supabase.from("trades").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

// Scoped to the active account: "delete all" only clears the current account.
export async function deleteAllTrades(userId: string): Promise<void> {
  const activeId = getActiveAccountId();
  let selectQ = supabase.from("trades").select("screenshots").eq("user_id", userId);
  if (activeId) selectQ = selectQ.eq("account_id", activeId);
  const { data } = await selectQ;
  const allPaths = (data ?? []).flatMap((r: { screenshots: string[] }) =>
    storagePathsOf(r.screenshots),
  );
  if (allPaths.length) {
    await removeScreenshotFiles(allPaths);
  }
  let delQ = supabase.from("trades").delete().eq("user_id", userId);
  if (activeId) delQ = delQ.eq("account_id", activeId);
  const { error } = await delQ;
  if (error) throw error;
}

// ── Legacy base64 → Storage migration ──
// Trades created before the Storage migration hold data: URLs inline in
// trades.screenshots (~650 KB per image, re-downloaded on every load).
// This runs once in the background after login: uploads each inline image
// to the bucket and rewrites the row to reference the storage path.
export async function migrateLegacyTradeScreenshots(
  userId: string,
  trades: Trade[],
  onTradeMigrated?: (trade: Trade) => void,
): Promise<number> {
  const legacy = trades.filter((t) => t.screenshots.some((s) => s.startsWith("data:")));
  let migrated = 0;
  for (const trade of legacy) {
    try {
      const newShots: string[] = [];
      for (const shot of trade.screenshots) {
        if (!shot.startsWith("data:")) {
          newShots.push(shot);
          continue;
        }
        const blob = await (await fetch(shot)).blob();
        const ext = blob.type === "image/png" ? "png" : "jpg";
        const file = new File([blob], `legacy-${Date.now()}.${ext}`, {
          type: blob.type || "image/jpeg",
        });
        newShots.push(await uploadScreenshot(userId, file));
      }
      const updated = { ...trade, screenshots: newShots };
      await upsertTrade(userId, updated);
      onTradeMigrated?.(updated);
      migrated++;
    } catch (e) {
      // Non-fatal: the data: URL still displays; retry happens on next load.
      console.warn("[migrate] screenshot migration failed for trade", trade.id, e);
    }
  }
  return migrated;
}
