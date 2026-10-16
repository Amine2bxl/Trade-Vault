import { supabase } from "@/integrations/supabase/client";
import { generateId } from "@/domain";
import type { Trade } from "../types";
import { loadUserTrades, importTrades } from "./trades";
import { SCREENSHOTS_BUCKET } from "./storage";
import {
  alreadyCopiedIds,
  copiedScreenshotPath,
  planTransfer,
  type TransferOptions,
} from "../trading/tradeTransfer";

/**
 * Le transfert de trades entre comptes, côté données.
 *
 * Le calcul (période, échelle, copie ou déplacement) est PUR et testé dans
 * `trading/tradeTransfer.ts`. Ce fichier ne fait que les entrées-sorties, dans
 * un ordre qui ne laisse jamais une donnée orpheline :
 *
 *   1. lire les trades source (et, en copie, ceux du compte cible pour ne
 *      pas recopier deux fois) ;
 *   2. dupliquer les CAPTURES dans le bucket — une copie ne partage jamais le
 *      fichier de son original, sinon supprimer l'un effacerait l'image de
 *      l'autre ;
 *   3. écrire les trades par lots (`importTrades` : limites de l'offre,
 *      reprise ligne à ligne) ;
 *   4. recopier l'intention et la réflexion des trades réellement écrits —
 *      APRÈS eux, puisque leur clé étrangère exige que le trade existe.
 *
 * Tout passe par le client de l'utilisateur : la RLS reste la dernière ligne
 * de défense, un compte d'un autre utilisateur est inatteignable.
 */

export interface TransferRequest extends TransferOptions {
  sourceAccountId: string;
}

export interface TransferResult {
  transferred: number;
  skipped: number;
  failed: number;
  screenshotsCopied: number;
  screenshotsFailed: number;
  planLimitReached: boolean;
}

/** Morceaux de lecture/écriture : bornés pour rester sous la taille d'URL
 *  d'un filtre `in.(…)` et sous le plafond de lignes de PostgREST. */
const CHUNK = 100;

function chunks<T>(list: readonly T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Duplique les captures d'un trade copié. Une capture qui ne se copie pas
 *  est RETIRÉE de la copie (jamais partagée) et comptée. */
async function copyScreenshots(
  userId: string,
  trade: Trade,
): Promise<{ paths: string[]; copied: number; failed: number }> {
  const paths: string[] = [];
  let copied = 0;
  let failed = 0;
  for (const shot of trade.screenshots) {
    // Ancienne capture en ligne (`data:`) : la chaîne EST l'image, la copier
    // suffit.
    if (shot.startsWith("data:")) {
      paths.push(shot);
      continue;
    }
    const target = copiedScreenshotPath(userId, shot, `${Date.now()}-${generateId().slice(0, 8)}`);
    const { error } = await supabase.storage.from(SCREENSHOTS_BUCKET).copy(shot, target);
    if (error) {
      failed++;
      continue;
    }
    paths.push(target);
    copied++;
  }
  return { paths, copied, failed };
}

interface IntelRow {
  trade_id: string;
  [column: string]: unknown;
}

/** Recopie les lignes d'intention / de réflexion vers les trades copiés. */
async function copyIntel(
  table: "trade_intent" | "trade_reflection",
  userId: string,
  idMap: ReadonlyMap<string, string>,
  written: ReadonlySet<string>,
): Promise<void> {
  const sources = [...idMap.keys()].filter((id) => written.has(idMap.get(id)!));
  for (const part of chunks(sources)) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("user_id", userId)
      .in("trade_id", part);
    if (error || !data?.length) continue;
    const rows = (data as unknown as IntelRow[]).map((row) => {
      // L'identifiant et l'horodatage appartiennent à la ligne d'origine : la
      // copie en reçoit des neufs.
      const { id: _id, created_at: _created, ...rest } = row;
      void _id;
      void _created;
      return { ...rest, user_id: userId, trade_id: idMap.get(row.trade_id)! };
    });
    // Au mieux : un trade sans son intention reste un trade parfaitement
    // valide, l'échec ne remonte pas en erreur de transfert.
    await supabase.from(table).insert(rows as never);
  }
}

export async function transferTrades(
  userId: string,
  req: TransferRequest,
  onProgress?: (done: number, total: number) => void,
): Promise<TransferResult> {
  if (req.sourceAccountId === req.targetAccountId) {
    throw new Error("source and target accounts must differ");
  }

  const source = await loadUserTrades(userId, { accountId: req.sourceAccountId });
  const target =
    req.mode === "copy" && req.skipAlreadyCopied
      ? await loadUserTrades(userId, { accountId: req.targetAccountId })
      : [];

  const plan = planTransfer(source, req, alreadyCopiedIds(target), generateId);

  let screenshotsCopied = 0;
  let screenshotsFailed = 0;
  let toWrite = plan.trades;
  if (req.mode === "copy") {
    toWrite = [];
    for (const t of plan.trades) {
      if (t.screenshots.length === 0) {
        toWrite.push(t);
        continue;
      }
      const res = await copyScreenshots(userId, t);
      screenshotsCopied += res.copied;
      screenshotsFailed += res.failed;
      toWrite.push({ ...t, screenshots: res.paths });
    }
  }

  const { saved, failed, planLimitReached } = await importTrades(userId, toWrite, onProgress);

  if (req.mode === "copy" && saved.length > 0) {
    const written = new Set(saved.map((t) => t.id));
    await copyIntel("trade_intent", userId, plan.idMap, written);
    await copyIntel("trade_reflection", userId, plan.idMap, written);
  }

  return {
    transferred: saved.length,
    skipped: plan.skipped,
    failed,
    screenshotsCopied,
    screenshotsFailed,
    planLimitReached,
  };
}

/**
 * Désigne le COMPTE PRINCIPAL — le compte de référence, en tête de liste.
 *
 * Deux écritures, dans cet ordre : d'abord on promeut la cible, ensuite on
 * rétrograde les autres. Si la seconde échoue, il reste deux comptes marqués
 * principaux — un état lisible (le plus ancien gagne à l'affichage) et
 * réparable en recommençant ; l'ordre inverse pouvait laisser AUCUN compte
 * principal.
 */
export async function setMainAccount(userId: string, accountId: string): Promise<void> {
  const { error } = await supabase
    .from("accounts")
    .update({ is_default: true })
    .eq("id", accountId)
    .eq("user_id", userId);
  if (error) throw error;
  const { error: e2 } = await supabase
    .from("accounts")
    .update({ is_default: false })
    .eq("user_id", userId)
    .neq("id", accountId);
  if (e2) throw e2;
}
