import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * LE MOYEU LIVE — un compte, un canal, tous les appareils au même état.
 *
 * Le trader ouvre TradeVault sur son téléphone et sur son ordinateur : ce qui
 * change sur l'un doit apparaître sur l'autre sans rafraîchir. Avant ce
 * module, chaque écran ouvrait son propre canal Realtime (trades, setups
 * manqués, profil), et tout le reste n'était relu qu'au rechargement.
 *
 * Ici, UN canal par compte écoute toutes les tables du compte et redistribue
 * chaque changement aux écrans abonnés à cette table (`onTable`). Le registre
 * des abonnés vit au niveau du module, indépendamment du canal : un écran peut
 * s'abonner avant la connexion, et reste servi après une reconnexion ou un
 * changement de compte.
 *
 * RELIRE PLUTÔT QUE REJOUER. Un appareil en veille, un tunnel de métro, un
 * onglet laissé en arrière-plan : des événements sont perdus, et Realtime ne
 * les rejoue pas. Plutôt que de tenir un journal d'horodatages, le moyeu
 * invite les écrans à relire leur source (`onResync`) au retour du canal ou
 * de l'onglet. C'est plus simple, et toujours juste.
 *
 * Sécurité : le canal `db:{uid}` ne transporte que des `postgres_changes`,
 * auxquels Realtime applique la RLS des tables — chacun ne reçoit que ses
 * lignes. Le canal privé des frappes en direct arrivera séparément.
 */

/** Les tables du compte diffusées par Realtime
 *  (`20261019120000_live_sync_all_tables.sql`). */
export const LIVE_TABLES = [
  "trades",
  "missed_opportunities",
  "profiles",
  "accounts",
  "goal_plans",
  "notifications",
  "user_preferences",
  "agent_proposals",
  "ai_memory",
  "broker_connections",
  "broker_accounts",
  "monthly_reports",
  "trade_intent",
  "trade_reflection",
  "subscriptions",
] as const;

export type LiveTable = (typeof LIVE_TABLES)[number];

export interface LiveChange {
  table: LiveTable;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
}

export type LiveStatus = "online" | "connecting" | "offline";

/** Au-delà de cette durée en arrière-plan, l'onglet relit tout à son retour. */
export const RESYNC_AFTER_HIDDEN_MS = 30_000;

/** Identifie CET onglet : sert à reconnaître l'écho de ses propres envois. */
export const DEVICE_ID: string =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `d-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

type ChangeHandler = (c: LiveChange) => void;

const tableHandlers = new Map<LiveTable, Set<ChangeHandler>>();
const resyncHandlers = new Set<() => void>();
const statusHandlers = new Set<(s: LiveStatus) => void>();

let channel: RealtimeChannel | null = null;
let currentUserId: string | null = null;
let status: LiveStatus = "offline";
/** Vrai dès qu'un abonnement a abouti : distingue la connexion initiale d'une reconnexion. */
let everSubscribed = false;
/** Vrai après une coupure : le prochain SUBSCRIBED déclenche un rattrapage. */
let lost = false;
let hiddenAt: number | null = null;
let detachListeners: (() => void) | null = null;

function safeCall<A>(fn: (a: A) => void, arg: A): void {
  try {
    fn(arg);
  } catch (e) {
    console.error("[liveSync] handler failed", e);
  }
}

function setStatus(next: LiveStatus): void {
  if (next === status) return;
  status = next;
  for (const h of [...statusHandlers]) safeCall(h, next);
}

function fireResync(): void {
  lost = false;
  for (const h of [...resyncHandlers]) safeCall(h, undefined);
}

function dispatch(table: LiveTable, payload: Record<string, unknown>): void {
  const set = tableHandlers.get(table);
  if (!set || set.size === 0) return;
  const change: LiveChange = {
    table,
    eventType: payload.eventType as LiveChange["eventType"],
    new: (payload.new as Record<string, unknown> | null) ?? null,
    old: (payload.old as Record<string, unknown> | null) ?? null,
  };
  for (const h of [...set]) safeCall(h, change);
}

function onChannelStatus(s: string): void {
  if (s === "SUBSCRIBED") {
    setStatus("online");
    if (everSubscribed && lost) fireResync();
    everSubscribed = true;
    lost = false;
    return;
  }
  if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
    if (everSubscribed) lost = true;
    setStatus("offline");
  }
}

function attachListeners(): () => void {
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      return;
    }
    const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
    hiddenAt = null;
    if (away > RESYNC_AFTER_HIDDEN_MS) fireResync();
  };
  const onOffline = () => {
    if (everSubscribed) lost = true;
    setStatus("offline");
  };
  const onOnline = () => {
    // Le réseau revient sans que le canal soit tombé (coupure brève) : aucun
    // SUBSCRIBED ne viendra, on rattrape tout de suite.
    const joined = (channel as unknown as { state?: string } | null)?.state === "joined";
    setStatus(joined ? "online" : "connecting");
    if (joined && lost) fireResync();
  };
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("offline", onOffline);
  window.addEventListener("online", onOnline);
  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("offline", onOffline);
    window.removeEventListener("online", onOnline);
  };
}

/** Ouvre le canal du compte. Sans effet côté serveur ou s'il est déjà ouvert. */
export function startLiveSync(userId: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (channel && currentUserId === userId) return;
  stopLiveSync();

  currentUserId = userId;
  everSubscribed = false;
  lost = false;
  hiddenAt = null;
  setStatus("connecting");

  const ch = supabase.channel(`db:${userId}`);
  for (const table of LIVE_TABLES) {
    ch.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        filter: table === "profiles" ? `id=eq.${userId}` : `user_id=eq.${userId}`,
      },
      (payload) => {
        // Un événement tardif d'un canal fermé (changement de compte) ne doit
        // atteindre personne.
        if (channel !== ch) return;
        dispatch(table, payload as unknown as Record<string, unknown>);
      },
    );
  }
  channel = ch;
  ch.subscribe((s) => {
    if (channel !== ch) return;
    onChannelStatus(String(s));
  });
  detachListeners = attachListeners();
}

/** Ferme le canal (déconnexion, changement de compte). Les abonnés restent inscrits. */
export function stopLiveSync(): void {
  detachListeners?.();
  detachListeners = null;
  const ch = channel;
  channel = null;
  currentUserId = null;
  if (ch) void supabase.removeChannel(ch);
  setStatus("offline");
}

/** S'abonne aux changements d'une table du compte. Rend la fonction de désabonnement. */
export function onTable(table: LiveTable, handler: ChangeHandler): () => void {
  let set = tableHandlers.get(table);
  if (!set) {
    set = new Set();
    tableHandlers.set(table, set);
  }
  set.add(handler);
  return () => {
    tableHandlers.get(table)?.delete(handler);
  };
}

/** Appelé quand des événements ont pu être manqués : relire sa source. */
export function onResync(handler: () => void): () => void {
  resyncHandlers.add(handler);
  return () => {
    resyncHandlers.delete(handler);
  };
}

export function getLiveStatus(): LiveStatus {
  return status;
}

export function subscribeLiveStatus(handler: (s: LiveStatus) => void): () => void {
  statusHandlers.add(handler);
  return () => {
    statusHandlers.delete(handler);
  };
}
