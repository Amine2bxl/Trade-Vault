import { supabase } from "@/integrations/supabase/client";

// ── Sub-accounts ──
export type AccountType = "personal" | "prop" | "demo" | "live";
export interface Account {
  id: string;
  name: string;
  type: AccountType;
  startingBalance: number;
  currency: string;
  color: string;
  isDefault: boolean;
}

// The active account is ambient module state so every trade/missed/balance
// query scopes to it without threading an id through every call site. The
// AccountContext keeps it in sync and triggers re-fetches on switch.
let _activeAccountId: string | null = null;
export function setActiveAccountId(id: string | null): void {
  _activeAccountId = id;
}
export function getActiveAccountId(): string | null {
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
  };
}

export async function loadAccounts(userId: string): Promise<Account[]> {
  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, type, starting_balance, currency, color, is_default")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => rowToAccount(r as AccountRow));
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
    .select("id, name, type, starting_balance, currency, color, is_default")
    .single();
  if (error) throw error;
  return rowToAccount(data as AccountRow);
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
