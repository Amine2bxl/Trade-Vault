import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SITE_URL } from "@/shared/site";
import type { Trade } from "@/domain/trade";
import {
  brokerCryptoConfigured,
  encryptJson,
  encryptSecret,
  sha256Hex,
} from "./broker-crypto.server";
import {
  CONNECTION_COLUMNS,
  syncConnection,
  type ConnectionRow,
  type SyncErrorCode,
} from "./broker-sync.server";
import {
  TRADOVATE_AUTHORIZE_URL,
  exchangeOAuthCode,
  requestAccessToken,
  tradovateOAuthConfigured,
} from "./tradovate.server";

/**
 * Les server functions de la synchronisation broker.
 *
 * Toutes authentifiées (`requireSupabaseAuth`) : elles agissent avec le client
 * Supabase de l'APPELANT, la RLS reste la dernière ligne de défense — un
 * utilisateur ne lit ni ne synchronise jamais la connexion d'un autre. Les
 * secrets broker ne quittent jamais le serveur : chiffrés avant écriture,
 * déchiffrés seulement ici, jamais renvoyés au navigateur.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

/** URL de retour OAuth : la page Brokers de l'app, qui termine la connexion. */
function redirectUri(): string {
  return process.env.TRADOVATE_REDIRECT_URI || `${process.env.PUBLIC_SITE_URL || SITE_URL}/brokers`;
}

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

const common = {
  environment: z.enum(["live", "demo"]),
  defaultRisk: z.number().min(0).max(1_000_000).nullable(),
  defaultAccountId: z.string().uuid().nullable(),
  timezone,
};

/** Ce que l'interface doit savoir pour proposer les bons parcours. */
export const brokerCapabilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    // Sans clé de chiffrement, aucun secret ne peut être stocké : on ne
    // propose aucune connexion plutôt que d'en écrire en clair.
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
    | "invalid_credentials"
    | "rate_limited"
    | "captcha_required"
    | "broker_unreachable"
    | "invalid_state";
  message?: string;
  inserted: Trade[];
}

async function firstSync(sb: Sb, connectionId: string): Promise<Trade[]> {
  const { data } = await sb
    .from("broker_connections")
    .select(CONNECTION_COLUMNS)
    .eq("id", connectionId)
    .maybeSingle();
  if (!data) return [];
  const res = await syncConnection(sb, data as ConnectionRow).catch(() => null);
  return res?.inserted ?? [];
}

/** Connexion par clé API Tradovate (login + mot de passe + cid/sec). */
export const connectTradovateCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ...common,
        username: z.string().trim().min(1).max(120),
        password: z.string().min(1).max(200),
        cid: z.string().trim().min(1).max(40),
        sec: z.string().trim().min(1).max(200),
        label: z.string().trim().max(60).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ConnectResult> => {
    const sb = context.supabase as Sb;
    const userId = context.userId as string;
    if (!brokerCryptoConfigured()) {
      return { ok: false, connectionId: null, error: "crypto_unavailable", inserted: [] };
    }
    const creds = {
      username: data.username,
      password: data.password,
      cid: data.cid,
      sec: data.sec,
      // Identifiant d'appareil STABLE pour cette connexion : Tradovate
      // l'utilise pour reconnaître un client déjà vu.
      deviceId: crypto.randomUUID(),
    };
    const auth = await requestAccessToken(data.environment, creds).catch(() => null);
    if (!auth) return { ok: false, connectionId: null, error: "broker_unreachable", inserted: [] };
    if (!auth.ok) {
      return {
        ok: false,
        connectionId: null,
        error:
          auth.reason === "penalty"
            ? "rate_limited"
            : auth.reason === "captcha"
              ? "captcha_required"
              : "invalid_credentials",
        message: auth.reason === "invalid" ? auth.message : undefined,
        inserted: [],
      };
    }
    const { data: row, error } = await sb
      .from("broker_connections")
      .insert({
        user_id: userId,
        broker: "tradovate",
        auth_mode: "credentials",
        environment: data.environment,
        label: data.label || data.username,
        status: "active",
        secret_ciphertext: await encryptJson(creds),
        token_ciphertext: await encryptSecret(auth.accessToken),
        token_expires_at: auth.expiresAt,
        external_user_id: auth.userId,
        default_risk: data.defaultRisk,
        default_account_id: data.defaultAccountId,
        timezone: data.timezone,
      })
      .select("id")
      .single();
    if (error || !row) throw error ?? new Error("connection insert failed");
    const inserted = await firstSync(sb, row.id);
    return { ok: true, connectionId: row.id, error: null, inserted };
  });

/** Début du parcours OAuth : une connexion `pending` et l'URL Tradovate. */
export const startTradovateOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object(common).parse(input))
  .handler(
    async ({ data, context }): Promise<{ url: string | null; error: ConnectResult["error"] }> => {
      const sb = context.supabase as Sb;
      if (!brokerCryptoConfigured()) return { url: null, error: "crypto_unavailable" };
      if (!tradovateOAuthConfigured()) return { url: null, error: "oauth_unavailable" };
      // Le `state` protège le retour contre une connexion forgée (CSRF) : seule
      // son EMPREINTE est stockée, la valeur ne transite que par le navigateur.
      const state = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
      // Une tentative abandonnée (onglet fermé chez Tradovate) laissait une
      // ligne `pending` pour toujours : on repart d'une seule tentative en cours.
      await sb.from("broker_connections").delete().eq("status", "pending");
      const { error } = await sb.from("broker_connections").insert({
        user_id: context.userId,
        broker: "tradovate",
        auth_mode: "oauth",
        environment: data.environment,
        status: "pending",
        oauth_state: await sha256Hex(state),
        default_risk: data.defaultRisk,
        default_account_id: data.defaultAccountId,
        timezone: data.timezone,
      });
      if (error) throw error;
      const url =
        `${TRADOVATE_AUTHORIZE_URL}?response_type=code` +
        `&client_id=${encodeURIComponent(process.env.TRADOVATE_CLIENT_ID ?? "")}` +
        `&redirect_uri=${encodeURIComponent(redirectUri())}` +
        `&state=${encodeURIComponent(state)}`;
      return { url, error: null };
    },
  );

/** Retour OAuth : la page Brokers transmet `code` et `state`. */
export const completeTradovateOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ code: z.string().min(1).max(2048), state: z.string().min(16).max(256) })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ConnectResult> => {
    const sb = context.supabase as Sb;
    // La RLS borne la recherche aux connexions de l'appelant : un `state`
    // volé ne permet pas de terminer la connexion de quelqu'un d'autre.
    const { data: pending } = await sb
      .from("broker_connections")
      .select("id, created_at")
      .eq("oauth_state", await sha256Hex(data.state))
      .eq("status", "pending")
      .maybeSingle();
    // Un retour de plus de 30 minutes n'est plus honoré.
    if (!pending || Date.now() - Date.parse(pending.created_at) > 30 * 60_000) {
      return { ok: false, connectionId: null, error: "invalid_state", inserted: [] };
    }
    const auth = await exchangeOAuthCode(data.code, redirectUri()).catch(() => null);
    if (!auth || !auth.ok) {
      await sb.from("broker_connections").delete().eq("id", pending.id);
      return {
        ok: false,
        connectionId: null,
        error: auth ? "invalid_credentials" : "broker_unreachable",
        message: auth && !auth.ok ? auth.message : undefined,
        inserted: [],
      };
    }
    await sb
      .from("broker_connections")
      .update({
        status: "active",
        oauth_state: null,
        token_ciphertext: await encryptSecret(auth.accessToken),
        token_expires_at: auth.expiresAt,
        label: "Tradovate",
      })
      .eq("id", pending.id);
    const inserted = await firstSync(sb, pending.id);
    return { ok: true, connectionId: pending.id, error: null, inserted };
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
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
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
