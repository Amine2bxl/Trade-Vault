import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { loadUserTrades, migrateLegacyTradeScreenshots } from "../store";
import type { Trade } from "../types";

// React Query data layer for the trade list. Replaces the ad-hoc
// useState + useEffect fetch that previously lived in App.tsx:
//   - the cache is keyed by (userId, accountId), so switching account is a
//     keyed refetch and revisiting an account is instant from cache;
//   - writes stay optimistic through `queryClient.setQueryData` (see the
//     `setTrades` shim in App.tsx), so no handler logic changes;
//   - the one-time legacy screenshot migration is encapsulated here.
//
// This is the read foundation the AI-coach features build on: any component
// can read the same cached trades without threading props or refetching.

const EMPTY: Trade[] = [];

/** Stable cache key for a user's trades scoped to the active account. */
export function tradesQueryKey(userId: string | null | undefined, accountId: string | null) {
  return ["trades", userId ?? null, accountId] as const;
}

export function useTrades(
  userId: string | undefined,
  accountId: string | null,
  enabled: boolean,
): { trades: Trade[]; tradesLoading: boolean } {
  const queryClient = useQueryClient();
  const isOn = !!userId && enabled;

  const query = useQuery({
    queryKey: tradesQueryKey(userId, accountId),
    // loadUserTrades scopes to the active account via module state; the
    // accountId in the key is what makes a switch refetch.
    queryFn: () => loadUserTrades(userId as string),
    enabled: isOn,
    staleTime: 30_000,
  });

  // One-time background migration: trades still carrying inline base64
  // screenshots get their images moved to Storage, then each migrated trade is
  // written back into the cache so the UI stays in sync. Guarded so it runs at
  // most once per loaded (user, account) dataset.
  const migratedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isOn || !userId || !query.data) return;
    const marker = `${userId}:${accountId ?? ""}`;
    if (migratedFor.current === marker) return;
    const hasLegacy = query.data.some((t) => t.screenshots.some((s) => s.startsWith("data:")));
    if (!hasLegacy) return;
    migratedFor.current = marker;
    const key = tradesQueryKey(userId, accountId);
    migrateLegacyTradeScreenshots(userId, query.data, (migrated) => {
      queryClient.setQueryData<Trade[]>(key, (prev) =>
        (prev ?? []).map((t) => (t.id === migrated.id ? migrated : t)),
      );
    })
      .then((n) => {
        if (n > 0) console.info(`[migrate] moved screenshots of ${n} trade(s) to Storage`);
      })
      .catch(() => {});
  }, [isOn, userId, accountId, query.data, queryClient]);

  return {
    trades: query.data ?? EMPTY,
    // Only a first load (no cached data yet) shows the skeleton, exactly like
    // the previous behaviour; a cached account switch is instant.
    tradesLoading: isOn && query.isPending,
  };
}
