import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SITE_URL } from "@/shared/site";
import type { Trade } from "@/domain/trade";
import { brokerCryptoConfigured, encryptSecret, sha256Hex } from "./broker-crypto.server";
import {
  CONNECTION_COLUMNS,
  syncConnection,
  type ConnectionRow,
  type SyncErrorCode,
} from "./broker-sync.server";
import { requireProPlan } from "./require-pro";
import {
  TRADOVATE_AUTHORIZE_URL,
  exchangeOAuthCode,
  tradovateOAuthConfigured,
} from "./tradovate.server";

/**
 * Les server functions de la synchronisation broker.
 *
 * ── AUCUN MOT DE PASSE ──
 * Il n'existe qu'un parcours de connexion : le trader est REDIRIGÉ vers la
 * page de connexion de Tradovate, s'y identifie chez eux, et revient avec un
 * code à usage unique que le serveur échange contre un jeton d'accès. Aucune
 * de ces fonctions ne reçoit, ne lit ni ne stocke un identifiant, un mot de
 * passe ou un e-mail Tradovate.
 *
 * ── PRO ──
 * Connecter, reconnecter et synchroniser exigent le palier Pro
 * (`requireProPlan`, échoue fermé). Lire ses connexions et les SUPPRIMER
 * restent ouverts à tous (RLS, côté client) : un abonnement échu ne retient
 * jamais un accès broker en otage.
 *
 * Toutes agissent avec le client Supabase de l'APPELANT : la RLS reste la
 * dernière ligne de défense — un utilisateur ne lit ni ne synchronise jamais
 * la connexion d'un autre. Le jeton est chiffré avant écriture et ne revient
 * jamais au navigateur.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

/** URL de retour OAuth : la page Brokers de l'app, qui termine la connexion. */
function redirectUri(): string {
  return process.env.TRADOVATE_REDIRECT_URI || `${process.env.PUBLIC_SITE_URL || SITE_URL}/brokers`;
}

/** Un retour OAuth plus vieux que ça n'est plus honoré. */
const OAUTH_TTL_MS = 30 * 60_000;

const timezone = z
  .string()
  .max(64)
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  });

/** Ce que l'interface doit savoir pour proposer les bons parcours. */
export const brokerCapabilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    // Sans clé de chiffrement, aucun jeton ne peut être stocké : on ne
    // propose aucune connexion plutôt que d'en écrire un en clair.
    encryption: brokerCryptoConfigured(),
    oauth: tradovateOAuthConfigured(),
  }));

export interface ConnectResult {
  ok: boolean;
  connectionId: string | null;
  /** Code stable traduit par l'interface — jamais une trace technique. */
  error:
    | null
    | "crypto_unavailable"
    | "oauth_unavailable"
    | "denied"
    | "broker_unreachable"
    | "invalid_state";
  /** Comptes trouvés chez Tradovate pour ce login. */
  accounts: number;
  /** Comptes trouvés mais pas encore rattachés à un compte TradeVault. */
  unmappedAccounts: number;
  inserted: Trade[];
  /** La connexion est faite mais la première synchro n'a pas abouti : dit
   *  tel quel au trader, plutôt qu'un « tout est synchronisé » faux. */
  syncError: SyncErrorCode | null;
}

/** Début (ou reprise) du parcours : l'URL de la page de connexion Tradovate. */
export const startTradovateOAuth = createServerFn({ method: "POST" })
  .middleware([requireProPlan])
  .inputValidator((input: unknown) =>
    z
      .object({
        environment: z.enum(["live", "demo"]).default("live"),
        defaultRisk: z.number().min(0).max(1_000_000).nullable().default(null),
        defaultAccountId: z.string().uuid().nullable().default(null),
        timezone,
        // Présent : on RECONNECTE une connexion existante (jeton expiré). Ses
        // comptes rattachés et son curseur sont conservés.
        connectionId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(
    async ({ data, context }): Promise<{ url: string | null; error: ConnectResult["error"] }> => {
      const sb = context.supabase as Sb;
      if (!brokerCryptoConfigured()) return { url: null, error: "crypto_unavailable" };
      if (!tradovateOAuthConfigured()) return { url: null, error: "oauth_unavailable" };
      // Le `state` protège le retour contre une connexion forgée (CSRF) : seule
      // son EMPREINTE est stockée, la valeur ne transite que par le navigateur.
      const state = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
      const stateHash = await sha256Hex(state);
      // Une tentative abandonnée (onglet fermé chez Tradovate) laissait une
      // ligne `pending` pour toujours : on repart d'une seule tentative en cours.
      await sb.from("broker_connections").delete().eq("status", "pending");
      if (data.connectionId) {
        const { data: row, error } = await sb
          .from("broker_connections")
          .update({ oauth_state: stateHash })
          .eq("id", data.connectionId)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!row) return { url: null, error: "invalid_state" };
      } else {
        const { error } = await sb.from("broker_connections").insert({
          user_id: context.userId,
          broker: "tradovate",
          environment: data.environment,
          status: "pending",
          oauth_state: stateHash,
          default_risk: data.defaultRisk,
          default_account_id: data.defaultAccountId,
          timezone: data.timezone,
        });
        if (error) throw error;
      }
      const url =
        `${TRADOVATE_AUTHORIZE_URL}?response_type=code` +
        `&client_id=${encodeURIComponent(process.env.TRADOVATE_CLIENT_ID ?? "")}` +
        `&redirect_uri=${encodeURIComponent(redirectUri())}` +
        `&state=${encodeURIComponent(state)}`;
      return { url, error: null };
    },
  );

/** Retour de chez Tradovate : la page Brokers transmet `code` et `state`. */
export const completeTradovateOAuth = createServerFn({ method: "POST" })
  .middleware([requireProPlan])
  .inputValidator((input: unknown) =>
    z
      .object({ code: z.string().min(1).max(2048), state: z.string().min(16).max(256) })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ConnectResult> => {
    const sb = context.supabase as Sb;
    const fail = (error: ConnectResult["error"]): ConnectResult => ({
      ok: false,
      connectionId: null,
      error,
      accounts: 0,
      unmappedAccounts: 0,
      inserted: [],
      syncError: null,
    });
    // La RLS borne la recherche aux connexions de l'appelant : un `state`
    // volé ne permet pas de terminer la connexion de quelqu'un d'autre.
    const { data: row } = await sb
      .from("broker_connections")
      .select("id, status, updated_at")
      .eq("oauth_state", await sha256Hex(data.state))
      .maybeSingle();
    if (!row || Date.now() - Date.parse(row.updated_at) > OAUTH_TTL_MS) {
      return fail("invalid_state");
    }
    const isNew = row.status === "pending";
    const auth = await exchangeOAuthCode(data.code, redirectUri()).catch(() => null);
    if (!auth || !auth.ok) {
      // Nouvelle connexion : on efface la tentative. Reconnexion : on garde la
      // connexion (et ses comptes rattachés), seul le `state` est consommé.
      if (isNew) await sb.from("broker_connections").delete().eq("id", row.id);
      else await sb.from("broker_connections").update({ oauth_state: null }).eq("id", row.id);
      return fail(auth ? "denied" : "broker_unreachable");
    }
    await sb
      .from("broker_connections")
      .update({
        status: "active",
        oauth_state: null,
        last_error: null,
        token_ciphertext: await encryptSecret(auth.accessToken),
        token_expires_at: auth.expiresAt,
      })
      .eq("id", row.id);

    // Première synchro tout de suite : le trader revient sur une page qui
    // montre ce qui a été trouvé, pas sur une promesse.
    const { data: conn } = await sb
      .from("broker_connections")
      .select(CONNECTION_COLUMNS)
      .eq("id", row.id)
      .maybeSingle();
    const res = conn ? await syncConnection(sb, conn as ConnectionRow).catch(() => null) : null;
    const { data: accounts } = await sb
      .from("broker_accounts")
      .select("id")
      .eq("connection_id", row.id);
    return {
      ok: true,
      connectionId: row.id,
      error: null,
      accounts: (accounts ?? []).length,
      unmappedAccounts: res?.unmappedAccounts ?? 0,
      inserted: res?.inserted ?? [],
      syncError: res ? res.error : "broker_unreachable",
    };
  });

export interface SyncResult {
  inserted: Trade[];
  errors: { connectionId: string; error: SyncErrorCode }[];
  unmappedAccounts: number;
}

/** Délai minimal entre deux synchronisations d'une même connexion : l'app
 *  appelle toutes les minutes ; deux onglets ouverts ne doublent pas le
 *  trafic chez Tradovate. */
const MIN_INTERVAL_MS = 30_000;

/**
 * Synchronise les connexions actives de l'appelant. Appelée par l'app
 * pendant qu'elle est ouverte, et par le bouton « Synchroniser ».
 */
export const syncBrokers = createServerFn({ method: "POST" })
  .middleware([requireProPlan])
  .inputValidator((input: unknown) =>
    z
      .object({ connectionId: z.string().uuid().optional(), force: z.boolean().default(false) })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<SyncResult> => {
    const sb = context.supabase as Sb;
    let q = sb.from("broker_connections").select(CONNECTION_COLUMNS).eq("status", "active");
    if (data.connectionId) q = q.eq("id", data.connectionId);
    const { data: rows, error } = await q;
    if (error) throw error;
    const result: SyncResult = { inserted: [], errors: [], unmappedAccounts: 0 };
    for (const conn of (rows ?? []) as ConnectionRow[]) {
      const last = conn.last_sync_at ? Date.parse(conn.last_sync_at) : 0;
      if (!data.force && Date.now() - last < MIN_INTERVAL_MS) continue;
      const res = await syncConnection(sb, conn);
      result.inserted.push(...res.inserted);
      result.unmappedAccounts += res.unmappedAccounts;
      if (res.error) result.errors.push({ connectionId: conn.id, error: res.error });
    }
    return result;
  });

/** Relit la liste des comptes d'un login (après l'achat d'un nouveau compte
 *  prop firm, par exemple) sans attendre la prochaine synchro. */
export const refreshBrokerAccountList = createServerFn({ method: "POST" })
  .middleware([requireProPlan])
  .inputValidator((input: unknown) => z.object({ connectionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const sb = context.supabase as Sb;
    const { data: conn } = await sb
      .from("broker_connections")
      .select(CONNECTION_COLUMNS)
      .eq("id", data.connectionId)
      .maybeSingle();
    if (!conn) return { ok: false };
    // La synchro complète relit les comptes en premier : un seul chemin.
    const res = await syncConnection(sb, conn as ConnectionRow).catch(() => null);
    return { ok: !!res && !res.error };
  });
