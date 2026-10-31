import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/contexts/AuthContext";
import { loadCashLedger, type CashLedgerData } from "@/app/store/cashLedger";
import {
  balanceBeforeEntry,
  verifiedBalances,
  type BalanceAtEntry,
  type BalanceLedger,
} from "@/domain/balanceAtEntry";
import type { Trade } from "@/app/types";

/**
 * Le registre de trésorerie du trader, et les SOLDES AVANT ENTRÉE qu'il permet
 * de reconstruire (`domain/balanceAtEntry`). Une seule lecture, partagée par
 * React Query entre la page Erreurs, Jarvis, l'Edge Score et les réglages.
 */

export const cashLedgerQueryKey = (userId: string | null | undefined) =>
  ["cash-ledger", userId ?? null] as const;

const EMPTY: CashLedgerData = { cash: [], snapshots: [], available: false };

export function useCashLedger(): {
  data: CashLedgerData;
  loading: boolean;
  invalidate: () => Promise<void>;
} {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: cashLedgerQueryKey(user?.id),
    queryFn: () => loadCashLedger(user!.id),
    enabled: !!user,
    staleTime: 60_000,
  });
  return {
    data: query.data ?? EMPTY,
    loading: query.isLoading,
    invalidate: () => queryClient.invalidateQueries({ queryKey: cashLedgerQueryKey(user?.id) }),
  };
}

/** Le solde avant l'entrée de chaque trade, avec son niveau de preuve. */
export function useBalancesAtEntry(trades: readonly Trade[]): Map<string, BalanceAtEntry> {
  const { data } = useCashLedger();
  return useMemo(() => {
    const ledger: BalanceLedger = { snapshots: data.snapshots, cash: data.cash, trades };
    const out = new Map<string, BalanceAtEntry>();
    // Sans aucun snapshot, tout est UNKNOWN : inutile de parcourir l'historique.
    if (data.snapshots.length === 0) return out;
    for (const t of trades) out.set(t.id, balanceBeforeEntry(t, ledger));
    return out;
  }, [data, trades]);
}

/** Seulement les soldes VERIFIED — l'entrée des verdicts de règles. */
export function useVerifiedBalances(trades: readonly Trade[]): Map<string, number> {
  const { data } = useCashLedger();
  return useMemo(
    () =>
      data.snapshots.length === 0
        ? new Map<string, number>()
        : verifiedBalances(trades, { snapshots: data.snapshots, cash: data.cash, trades }),
    [data, trades],
  );
}
