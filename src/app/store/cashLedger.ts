import { supabase } from "@/integrations/supabase/client";
import type { BalanceSnapshot, CashMovement, EvidenceSource } from "@/domain/balanceAtEntry";

/**
 * TRÉSORERIE ET SOLDES OBSERVÉS — accès client (lot 1).
 *
 * Deux tables (`cash_ledger`, `account_snapshots`) : les mouvements hors
 * trades (dépôts, retraits, frais, payouts, ajustements) et les soldes relevés
 * à une date. Le trader n'écrit que SES déclarations (`source = 'user'`) ; une
 * ligne venue du broker ou d'un relevé est un fait observé qu'il lit sans
 * pouvoir la modifier (RLS).
 *
 * Tables absentes (application déployée avant sa migration) : la lecture rend
 * un registre vide marqué indisponible — les soldes historiques restent alors
 * UNKNOWN, ce qui est exact.
 */

/* Les types générés ne connaissent pas encore ces tables (migration lot 1). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type CashKind = "deposit" | "withdrawal" | "fee" | "payout" | "adjustment";

export const CASH_KINDS: readonly CashKind[] = [
  "deposit",
  "withdrawal",
  "fee",
  "payout",
  "adjustment",
];

export interface CashMovementRow extends CashMovement {
  id: string;
  kind: CashKind;
  currency: string;
  evidence: string | null;
}

export interface SnapshotRow extends BalanceSnapshot {
  id: string;
  currency: string;
  evidence: string | null;
}

export interface CashLedgerData {
  cash: CashMovementRow[];
  snapshots: SnapshotRow[];
  /** Faux quand la base n'a pas encore les tables. */
  available: boolean;
}

const SOURCES: readonly EvidenceSource[] = ["user", "broker", "statement"];
const sourceOf = (v: unknown): EvidenceSource =>
  SOURCES.includes(v as EvidenceSource) ? (v as EvidenceSource) : "user";

/** Table inconnue de PostgREST (`PGRST205`) ou de Postgres (`42P01`). */
function isMissingTable(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return (
    !!e && (e.code === "PGRST205" || e.code === "42P01" || /does not exist/i.test(e.message ?? ""))
  );
}

/**
 * Le signe suit la nature du mouvement — la base le vérifie aussi
 * (`cash_ledger_sign`) ; le formulaire saisit un montant positif.
 */
export function signedAmount(kind: CashKind, amount: number): number {
  const abs = Math.abs(amount);
  if (kind === "deposit") return abs;
  if (kind === "adjustment") return amount;
  return -abs;
}

export async function loadCashLedger(userId: string): Promise<CashLedgerData> {
  const [cashRes, snapRes] = await Promise.all([
    db
      .from("cash_ledger")
      .select("id, account_id, kind, amount, currency, occurred_at, source, evidence")
      .eq("user_id", userId)
      .order("occurred_at", { ascending: true }),
    db
      .from("account_snapshots")
      .select("id, account_id, balance, currency, observed_at, source, evidence")
      .eq("user_id", userId)
      .order("observed_at", { ascending: true }),
  ]);
  if (isMissingTable(cashRes.error) || isMissingTable(snapRes.error)) {
    return { cash: [], snapshots: [], available: false };
  }
  if (cashRes.error) throw cashRes.error;
  if (snapRes.error) throw snapRes.error;
  return {
    available: true,
    cash: ((cashRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      accountId: String(r.account_id),
      kind: r.kind as CashKind,
      amount: Number(r.amount),
      currency: String(r.currency ?? "USD"),
      occurredAt: String(r.occurred_at),
      source: sourceOf(r.source),
      evidence: (r.evidence as string | null) ?? null,
    })),
    snapshots: ((snapRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      accountId: String(r.account_id),
      balance: Number(r.balance),
      currency: String(r.currency ?? "USD"),
      observedAt: String(r.observed_at),
      source: sourceOf(r.source),
      evidence: (r.evidence as string | null) ?? null,
    })),
  };
}

export async function addCashMovement(
  userId: string,
  input: {
    accountId: string;
    kind: CashKind;
    amount: number;
    occurredAt: string;
    currency: string;
    evidence?: string | null;
  },
): Promise<void> {
  const { error } = await db.from("cash_ledger").insert({
    user_id: userId,
    account_id: input.accountId,
    kind: input.kind,
    amount: Math.round(signedAmount(input.kind, input.amount) * 100) / 100,
    currency: input.currency,
    occurred_at: input.occurredAt,
    source: "user",
    evidence: input.evidence?.trim() ? input.evidence.trim().slice(0, 500) : null,
  });
  if (error) throw error;
}

export async function addSnapshot(
  userId: string,
  input: {
    accountId: string;
    balance: number;
    observedAt: string;
    currency: string;
    evidence?: string | null;
  },
): Promise<void> {
  // Un relevé saisi par le trader est une DÉCLARATION (`source = 'user'`) :
  // il estime un solde historique (PARTIAL), il ne le prouve pas.
  const { error } = await db.from("account_snapshots").insert({
    user_id: userId,
    account_id: input.accountId,
    balance: Math.round(input.balance * 100) / 100,
    currency: input.currency,
    observed_at: input.observedAt,
    source: "user",
    evidence: input.evidence?.trim() ? input.evidence.trim().slice(0, 500) : null,
  });
  if (error) throw error;
}

export async function deleteCashMovement(userId: string, id: string): Promise<void> {
  const { error } = await db.from("cash_ledger").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function deleteSnapshot(userId: string, id: string): Promise<void> {
  const { error } = await db.from("account_snapshots").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}
