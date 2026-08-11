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

/**
 * `select("*")` et NON une liste explicite de colonnes.
 *
 * RÉGRESSION CORRIGÉE : lister nommément les colonnes de calibration faisait
 * échouer la requête entière (`column accounts.calibration_scale does not
 * exist`) tant que la migration n'était pas appliquée. `loadAccounts` levait,
 * la liste des comptes restait vide, et les sous-comptes DISPARAISSAIENT de
 * l'interface — la fonctionnalité cassait ce qu'elle venait enrichir.
 *
 * Le code est déployé AVANT que la migration ne tourne : il doit donc tolérer
 * l'ancien schéma. `*` rend ce qui existe, et `rowToAccount` retombe sur les
 * valeurs neutres pour ce qui manque.
 */
export async function loadAccounts(userId: string): Promise<Account[]> {
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
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
    // Même raison que dans `loadAccounts` : ne jamais nommer une colonne qui
    // peut ne pas encore exister en base.
    .select("*")
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
 * Recalibre un compte : convertit les trades DÉJÀ ENCODÉS, une seule fois.
 *
 * UN SEUL APPEL, UNE SEULE TRANSACTION. La conversion des trades et la mise à
 * jour du compte se font désormais dans la même fonction SQL. La version
 * précédente les séparait en deux écritures indépendantes, et cette séparation
 * a réellement produit l'incident qu'elle rendait possible : des comptes
 * marqués « recalibré ×2 » dont aucun trade n'avait été converti, affichant
 * des risques de 174 $ sur un capital de 500 000 $.
 *
 * L'état était même définitif : au second essai, le facteur se calcule depuis
 * le solde courant — déjà passé à la nouvelle valeur — donc 1, et la fonction
 * sortait sans rien faire. Aucune manipulation dans l'interface ne pouvait
 * rattraper ça.
 *
 * `p_cutoff` est l'instant de la demande : seuls les trades encodés AVANT sont
 * convertis. Ceux saisis après ont été tradés sur le nouveau capital.
 *
 * La fonction s'exécute en `security invoker` : les politiques RLS de `trades`
 * et `accounts` s'appliquent à l'appelant, et le `user_id = auth.uid()`
 * explicite double la garde.
 */
export async function recalibrateAccount(
  _userId: string,
  id: string,
  input: { originalBalance: number; targetBalance: number; factor: number; cumulative: number },
): Promise<number> {
  const cutoff = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("recalibrate_account", {
    p_account_id: id,
    p_factor: input.factor,
    p_cutoff: cutoff,
    p_target_balance: input.targetBalance,
    p_original_balance: input.originalBalance,
    p_cumulative: input.cumulative,
  });
  if (error) throw error;

  return Number(data) || 0;
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
