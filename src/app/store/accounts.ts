import { supabase } from "@/integrations/supabase/client";

// ── Sub-accounts ──
export type AccountType = "personal" | "prop" | "demo" | "live";
export interface Account {
  id: string;
  name: string;
  type: AccountType;
  icon?: string;
  startingBalance: number;
  currency: string;
  color: string;
  isDefault: boolean;
  /** Facteur appliqué aux montants historiques à la lecture (1 = aucun
   *  recalibrage). Voir `utils/accountCalibration.ts`. */
  calibrationScale: number;
  /** Capital sur lequel les trades ont RÉELLEMENT été pris — source canonique
   *  du facteur. Égal au solde courant tant qu'aucun recalibrage n'a eu lieu. */
  originalBalance: number;
  /** Date du dernier recalibrage, `null` s'il n'y en a jamais eu. */
  calibratedAt: string | null;
}

// The active account is ambient module state so every trade/missed/balance
// query scopes to it without threading an id through every call site. The
// AccountContext keeps it in sync and triggers re-fetches on switch.
let _activeAccountId: string | null = null;
export function setActiveAccountId(id: string | null): void {
  if (typeof window === "undefined") return;
  _activeAccountId = id;
}
export function getActiveAccountId(): string | null {
  if (typeof window === "undefined") return null;
  return _activeAccountId;
}

interface AccountRow {
  id: string;
  name: string;
  type: string;
  starting_balance: number;
  currency: string;
  color: string;
  is_default: boolean;
  calibration_scale?: number | null;
  original_balance?: number | null;
  calibrated_at?: string | null;
}
function rowToAccount(r: AccountRow): Account {
  return {
    id: r.id,
    name: r.name,
    type: (r.type as AccountType) ?? "personal",
    startingBalance: Number(r.starting_balance),
    currency: r.currency ?? "USD",
    color: r.color ?? "#22d3ee",
    isDefault: !!r.is_default,
    // Colonnes ajoutées après coup : un compte créé avant la migration les
    // lit à NULL et doit se comporter comme « jamais recalibré ».
    calibrationScale: Number(r.calibration_scale) || 1,
    originalBalance: Number(r.original_balance) || Number(r.starting_balance),
    calibratedAt: r.calibrated_at ?? null,
  };
}

export async function loadAccounts(userId: string): Promise<Account[]> {
  const { data, error } = await supabase
    .from("accounts")
    .select(
      "id, name, type, starting_balance, currency, color, is_default, calibration_scale, original_balance, calibrated_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  // Cast explicite : les colonnes de calibration ont été ajoutées après la
  // génération des types Supabase, qui ne les connaît donc pas encore.
  return ((data ?? []) as unknown as AccountRow[]).map(rowToAccount);
}

export async function createAccount(
  userId: string,
  input: {
    name: string;
    type: AccountType;
    startingBalance: number;
    currency?: string;
    color?: string;
  },
): Promise<Account> {
  const { data, error } = await supabase
    .from("accounts")
    .insert({
      user_id: userId,
      name: input.name,
      type: input.type,
      starting_balance: input.startingBalance,
      currency: input.currency ?? "USD",
      color: input.color ?? "#22d3ee",
      is_default: false,
    })
    .select(
      "id, name, type, starting_balance, currency, color, is_default, calibration_scale, original_balance, calibrated_at",
    )
    .single();
  if (error) throw error;
  return rowToAccount(data as unknown as AccountRow);
}

export async function updateAccount(
  userId: string,
  id: string,
  patch: Partial<{
    name: string;
    type: AccountType;
    startingBalance: number;
    currency: string;
    color: string;
  }>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.type !== undefined) row.type = patch.type;
  if (patch.startingBalance !== undefined) row.starting_balance = patch.startingBalance;
  if (patch.currency !== undefined) row.currency = patch.currency;
  if (patch.color !== undefined) row.color = patch.color;
  const { error } = await supabase
    .from("accounts")
    .update(row as never)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

/**
 * Recalibre l'échelle d'un compte — écrit UNIQUEMENT la métadonnée.
 *
 * Aucune ligne `trades` n'est touchée : la conversion se fait à la lecture.
 * `original_balance` est figé au premier recalibrage sur le capital réellement
 * tradé, puis ne bouge plus — c'est de lui, et de lui seul, que tout facteur
 * ultérieur est recalculé (25k → 50k → 100k donne 4×, jamais 2× puis 2×).
 *
 * Le `.eq("user_id", userId)` double la protection RLS : même avec un id de
 * compte deviné, l'écriture ne peut pas sortir des comptes de l'appelant.
 */
export async function recalibrateAccount(
  userId: string,
  id: string,
  input: { originalBalance: number; targetBalance: number; scale: number },
): Promise<void> {
  const { error } = await supabase
    .from("accounts")
    .update({
      starting_balance: input.targetBalance,
      calibration_scale: input.scale,
      original_balance: input.originalBalance,
      calibrated_at: new Date().toISOString(),
    } as never)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

// Deletes an account and (via FK cascade) all its trades/missed opportunities.
export async function deleteAccount(userId: string, id: string): Promise<void> {
  const { error } = await supabase.from("accounts").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function loadActiveAccountId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("active_account_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.active_account_id as string | null) ?? null;
}

export async function saveActiveAccountId(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ active_account_id: id })
    .eq("id", userId);
  if (error) throw error;
}
