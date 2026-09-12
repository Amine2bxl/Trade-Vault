/**
 * Replay — la couche de persistance côté client.
 *
 * La table `replay_sessions` et la colonne `trades.replay_session_id` n'existent
 * pas encore dans le schéma généré (`integrations/supabase/types.ts` — TypeScript
 * regénère après migration). Les accès passent donc par un client encasté
 * `any` LIMITÉ à ce fichier : le reste du produit garde son typage.
 *
 * Les trades d'une journée rejouée sont écrasés dans `trades` avec le
 * `account_id` du compte de rejeu et le lien `replay_session_id` : le Journal,
 * le Calendrier, les Analyses et les Rapports les lisent sans rien savoir du
 * terminal.
 */

import { supabase } from "@/integrations/supabase/client";
import type { ReplaySessionState, ReplayTrade } from "@/modules/replay";
import { deserializeState, serializeState } from "@/modules/replay";
import { nyDateOf, nyTimeOf } from "@/modules/replay";
import type { Trade } from "../types";
import { planLimitFromDbError } from "../utils/planLimits";

// Le schéma de production (regénéré après migration) rendra ces casts inutiles.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type ReplayStatus = "setup" | "active" | "finished" | "abandoned";

export interface ReplaySessionDto {
  id: string;
  accountId: string;
  symbol: string;
  startDate: string;
  startTime: string;
  timeframe: string;
  status: ReplayStatus;
  state: ReplaySessionState | null;
  createdAt: string;
  updatedAt: string;
}

interface SessionRow {
  id: string;
  account_id: string;
  symbol?: string | null;
  start_date: string;
  start_time?: string | null;
  timeframe?: string | null;
  status: string;
  state: string;
  created_at: string;
  updated_at: string;
}

function fromRow(r: SessionRow): ReplaySessionDto {
  return {
    id: r.id,
    accountId: r.account_id,
    symbol: r.symbol ?? "NQ",
    startDate: r.start_date,
    startTime: r.start_time ?? "09:30",
    timeframe: r.timeframe ?? "5m",
    status: (r.status as ReplayStatus) ?? "active",
    state: r.state ? deserializeState(r.state) : null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Crée une session de rejeu pour un compte de rejeu. */
export async function createReplaySession(
  userId: string,
  input: {
    accountId: string;
    symbol: string;
    startDate: string;
    startTime: string;
    timeframe: string;
    state: ReplaySessionState;
  },
): Promise<string> {
  const { data, error } = await sb
    .from("replay_sessions")
    .insert({
      user_id: userId,
      account_id: input.accountId,
      symbol: input.symbol,
      start_date: input.startDate,
      start_time: input.startTime,
      timeframe: input.timeframe,
      status: "active",
      state: serializeState(input.state),
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Les sessions d'un compte de rejeu, les plus récentes d'abord. */
export async function loadReplaySessions(
  userId: string,
  accountId: string,
): Promise<ReplaySessionDto[]> {
  const { data, error } = await sb
    .from("replay_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return ((data ?? []) as unknown as SessionRow[]).map(fromRow);
}

/** Une session précise (reprise). */
export async function loadReplaySession(
  userId: string,
  id: string,
): Promise<ReplaySessionDto | null> {
  const { data, error } = await sb
    .from("replay_sessions")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as unknown as SessionRow) : null;
}

/** Sauvegarde l'état + le statut d'une session. */
export async function updateReplaySession(
  userId: string,
  id: string,
  patch: {
    state: ReplaySessionState;
    status?: ReplayStatus;
    timeframe?: string;
  },
): Promise<void> {
  const row: Record<string, unknown> = {
    state: serializeState(patch.state),
    updated_at: new Date().toISOString(),
  };
  if (patch.status) row.status = patch.status;
  if (patch.timeframe) row.timeframe = patch.timeframe;
  const { error } = await sb.from("replay_sessions").update(row).eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

/** Abandonne une session (aucun trade n'est poussé au journal). */
export async function abandonReplaySession(userId: string, id: string): Promise<void> {
  const { error } = await sb
    .from("replay_sessions")
    .update({ status: "abandoned", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

// ── Pousse des trades au journal TradeVault ────────────────────────────────

const toMoney = (n: number) => Math.round(n * 100) / 100;

export interface JournalPushResult {
  saved: number;
  failed: number;
  planLimitReached: boolean;
}

/**
 * Convertit les trades clos d'une session en lignes `trades` du compte de
 * rejeu, reliées par `replay_session_id`. Batch upsert direct — le quota
 * mensuel ne concerne jamais les sessions (Premium).
 */
export async function pushReplayTradesToJournal(
  userId: string,
  sessionId: string,
  accountId: string,
  closed: ReplayTrade[],
): Promise<JournalPushResult> {
  const rows = closed.map((t) => {
    const tr = tradeOf(t);
    return {
      id: tr.id,
      user_id: userId,
      account_id: accountId,
      trade_date: tr.date,
      symbol: tr.symbol,
      direction: tr.direction,
      pnl: toMoney(tr.pnl),
      risk_amount: toMoney(tr.riskAmount),
      r_multiple: tr.rMultiple,
      strategy: "Replay",
      mistakes: [],
      setup_quality: 0,
      notes: tr.notes,
      screenshots: [],
      entry_time: tr.entryTime,
      exit_time: tr.exitTime,
      confluences: ["Replay terminal"],
      confidence: 0,
      replay_session_id: sessionId,
    };
  });

  let saved = 0;
  let failed = 0;
  let planLimitReached = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await sb.from("trades").upsert(rows as any);
  if (!error) {
    saved = rows.length;
  } else {
    const limit = planLimitFromDbError(error);
    if (limit) {
      planLimitReached = true;
      failed = rows.length;
    }
    // Repli ligne à ligne : une seule ligne fautive ne doit pas effacer le lot.
    for (const row of rows) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const one = await sb.from("trades").upsert(row as any);
      if (one.error) {
        if (planLimitFromDbError(one.error)) planLimitReached = true;
        failed += 1;
      } else {
        saved += 1;
      }
    }
  }
  return { saved, failed, planLimitReached };
}

/** Mapping d'un trade du terminal vers le type `Trade` du journal. */
export function tradeOf(t: ReplayTrade): Trade {
  return {
    id: t.id,
    date: nyDateOf(t.exitTime),
    symbol: t.symbol,
    direction: t.side,
    pnl: toMoney(t.realizedPnl),
    riskAmount: toMoney(t.riskAmount),
    rMultiple: t.rMultiple,
    strategy: "Replay",
    mistakes: [],
    setupQuality: 0,
    notes: "Replay",
    screenshots: [],
    entryTime: nyTimeOf(t.entryTime),
    exitTime: nyTimeOf(t.exitTime),
    confluences: ["Replay terminal"],
    confidence: 0,
  };
}
