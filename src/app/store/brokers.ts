import { supabase } from "@/integrations/supabase/client";

/**
 * Connexions broker — lecture et réglages, côté client.
 *
 * Le navigateur ne lit QUE les colonnes publiques d'une connexion : jamais
 * `secret_ciphertext` ni `token_ciphertext` (chiffrés de toute façon, et sans
 * aucune utilité ici). Tout ce qui touche au broker lui-même — authentifier,
 * synchroniser — passe par les server functions de
 * `backend/brokers.functions.ts`.
 *
 * Les tables arrivent par la migration `broker_sync` : tant qu'elle n'a pas
 * tourné, les lectures échouent proprement et l'écran l'affiche comme « aucune
 * connexion », sans jamais casser le reste de l'app.
 */

export type BrokerConnectionStatus = "pending" | "active" | "error" | "disabled";

export interface BrokerConnection {
  id: string;
  broker: "tradovate";
  authMode: "oauth" | "credentials";
  environment: "live" | "demo";
  label: string;
  status: BrokerConnectionStatus;
  defaultRisk: number | null;
  defaultAccountId: string | null;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface BrokerAccount {
  id: string;
  connectionId: string;
  externalAccountId: string;
  name: string;
  accountId: string | null;
  enabled: boolean;
}

const CONNECTION_PUBLIC_COLUMNS =
  "id, broker, auth_mode, environment, label, status, default_risk, default_account_id, last_sync_at, last_success_at, last_error, created_at";

// Les tables ne sont pas (encore) dans les types générés.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface ConnectionRow {
  id: string;
  broker: "tradovate";
  auth_mode: "oauth" | "credentials";
  environment: "live" | "demo";
  label: string;
  status: BrokerConnectionStatus;
  default_risk: number | null;
  default_account_id: string | null;
  last_sync_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  created_at: string;
}

export async function loadBrokerConnections(userId: string): Promise<BrokerConnection[]> {
  const { data, error } = await db
    .from("broker_connections")
    .select(CONNECTION_PUBLIC_COLUMNS)
    .eq("user_id", userId)
    .neq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as ConnectionRow[]).map((r) => ({
    id: r.id,
    broker: r.broker,
    authMode: r.auth_mode,
    environment: r.environment,
    label: r.label,
    status: r.status,
    defaultRisk: r.default_risk != null ? Number(r.default_risk) : null,
    defaultAccountId: r.default_account_id,
    lastSyncAt: r.last_sync_at,
    lastSuccessAt: r.last_success_at,
    lastError: r.last_error,
    createdAt: r.created_at,
  }));
}

export async function loadBrokerAccounts(userId: string): Promise<BrokerAccount[]> {
  const { data, error } = await db
    .from("broker_accounts")
    .select("id, connection_id, external_account_id, name, account_id, enabled")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) throw error;
  return (
    (data ?? []) as {
      id: string;
      connection_id: string;
      external_account_id: string;
      name: string;
      account_id: string | null;
      enabled: boolean;
    }[]
  ).map((r) => ({
    id: r.id,
    connectionId: r.connection_id,
    externalAccountId: r.external_account_id,
    name: r.name,
    accountId: r.account_id,
    enabled: r.enabled,
  }));
}

/** Choisit le compte TradeVault d'un compte broker, ou le met en pause. */
export async function updateBrokerAccount(
  userId: string,
  id: string,
  patch: Partial<{ accountId: string | null; enabled: boolean }>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.accountId !== undefined) row.account_id = patch.accountId;
  if (patch.enabled !== undefined) row.enabled = patch.enabled;
  const { error } = await db.from("broker_accounts").update(row).eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function updateBrokerConnection(
  userId: string,
  id: string,
  patch: Partial<{ defaultRisk: number | null; status: "active" | "disabled" }>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.defaultRisk !== undefined) row.default_risk = patch.defaultRisk;
  if (patch.status !== undefined) row.status = patch.status;
  const { error } = await db
    .from("broker_connections")
    .update(row)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

/** Déconnecte : la connexion, ses jetons chiffrés et ses comptes rattachés
 *  disparaissent (cascade). Les trades DÉJÀ importés restent au journal. */
export async function deleteBrokerConnection(userId: string, id: string): Promise<void> {
  const { error } = await db.from("broker_connections").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

/** Y a-t-il au moins une connexion active ? Lecture minimale, faite au
 *  démarrage pour décider s'il faut synchroniser du tout. */
export async function hasActiveBrokerConnection(userId: string): Promise<boolean> {
  const { count, error } = await db
    .from("broker_connections")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) return false;
  return (count ?? 0) > 0;
}
