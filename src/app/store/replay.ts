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
import {
  ReplayEngine,
  createInitialState,
  processBars,
  flattenPositions,
  placeOrder,
} from "@/modules/replay";
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

/** Construit les lignes `trades` d'une liste de trades du terminal. */
function tradeRows(
  userId: string,
  accountId: string,
  sessionId: string | null,
  closed: ReplayTrade[],
): Record<string, unknown>[] {
  return closed.map((t) => {
    const tr = tradeOf(t);
    const row: Record<string, unknown> = {
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
      confluences: tr.confluences,
      confidence: 0,
    };
    if (sessionId) row.replay_session_id = sessionId;
    return row;
  });
}

/** Insertion en batch, avec repli ligne à ligne sur échec. */
async function insertTrades(rows: Record<string, unknown>[]): Promise<JournalPushResult> {
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

/**
 * Convertit les trades clos d'une session en lignes `trades` du compte de
 * rejeu, reliées par `replay_session_id`. Le quota mensuel ne concerne jamais
 * les sessions (Premium).
 */
export async function pushReplayTradesToJournal(
  userId: string,
  sessionId: string | null,
  accountId: string,
  closed: ReplayTrade[],
): Promise<JournalPushResult> {
  return insertTrades(tradeRows(userId, accountId, sessionId, closed));
}

/** Nombre de trades déjà présents sur un compte (pour le seeding d'exemple). */
export async function countAccountTrades(userId: string, accountId: string): Promise<number> {
  const { count, error } = await sb
    .from("trades")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("account_id", accountId);
  if (error) return 0;
  return count ?? 0;
}

/**
 * Semaine d'exemple NQ — réellement SIMULÉE : chaque jour ouvré des 7 derniers
 * est rejoué par le moteur (ordres au marché + bracket, exécutions
 * déterministes) et les trades clos rejoignent le compte de rejeu. Le Journal,
 * le Dashboard et les Analyses ont ainsi une semaine de substance à afficher —
 * exactement la donnée que le trader veut voir interagir pendant qu'on bâtit
 * l'environnement.
 */
export async function seedReplayWeek(userId: string, accountId: string): Promise<number> {
  const dates = lastTradingDays(7);
  const closed: ReplayTrade[] = [];

  for (const date of dates) {
    try {
      const engine = new ReplayEngine({ symbol: "NQ", date, startTime: "09:31", timeframe: "1m" });
      await engine.start();
      const state = createInitialState({
        symbol: "NQ",
        startingBalance: 100_000,
        now: engine.now,
        commissionPerContract: 2.5,
        slippageTicks: 1,
      });
      // Direction du jour, déterministe depuis la date.
      const baseSide: "long" | "short" =
        date.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 2 === 0 ? "long" : "short";
      let step = 0;
      let placed = 0;
      while (!engine.atEnd && step < 900) {
        engine.stepForward("1m");
        state.now = engine.now;
        processBars(state, engine.data);
        if (step === 6 && placed === 0) {
          const m = engine.markPrice();
          const s = baseSide;
          placeOrder({
            state,
            input: {
              side: s,
              type: "market",
              qty: 1,
              bracketSl: s === "long" ? m - 35 : m + 35,
              bracketTp: s === "long" ? m + 70 : m - 70,
            },
            bars: engine.data,
          });
          placed += 1;
        } else if (step === 220 && placed === 1) {
          const m = engine.markPrice();
          const s: "long" | "short" = baseSide === "long" ? "short" : "long";
          placeOrder({
            state,
            input: {
              side: s,
              type: "market",
              qty: 1,
              bracketSl: s === "long" ? m - 30 : m + 30,
              bracketTp: s === "long" ? m + 60 : m - 60,
            },
            bars: engine.data,
          });
          placed += 1;
        }
        step += 1;
      }
      flattenPositions(state, engine.data);
      closed.push(...state.closedTrades);
    } catch (e) {
      console.warn("[replay] seed day failed", date, e);
    }
  }

  if (closed.length === 0) return 0;
  const res = await insertTrades(tradeRows(userId, accountId, null, closed));
  return res.saved;
}

/** Les derniers jours ouvrés NY (7), du plus ancien au plus récent. */
function lastTradingDays(n: number): string[] {
  const out: string[] = [];
  let cursor = Date.now() - 24 * 3600_000;
  while (out.length < n) {
    cursor -= 24 * 3600_000;
    const stamp = cursor + 12 * 3600_000;
    const dow = new Date(stamp).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    out.unshift(new Date(stamp).toISOString().slice(0, 10));
  }
  return out;
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
