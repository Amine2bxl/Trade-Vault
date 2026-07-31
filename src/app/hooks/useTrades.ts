import { useEffect, useMemo, useRef } from "react";
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

/** sessionStorage persistence: on F5 the in-memory React Query cache is gone
 * and the dashboard waits ~3s for a cold Supabase round-trip. Persisting the
 * last successful fetch and feeding it back as `initialData` makes the page
 * paint instantly with the previous data while a background refetch silently
 * updates it. */
function tradesStorageKey(userId: string, accountId: string | null) {
  return `tv:trades:${userId}:${accountId ?? ""}`;
}
function readCachedTrades(key: string): Trade[] | undefined {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Trade[]) : undefined;
  } catch {
    return undefined;
  }
}

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

  // On F5 the active account is null until AccountContext resolves. Reading a
  // userId-level cache during that window avoids flashing the empty state: the
  // last active account's trades (mirrored below) paint immediately, then the
  // account-scoped cache/refetch takes over once `accountId` resolves.
  const sKey = userId ? tradesStorageKey(userId, accountId) : "";
  const userLevelKey = userId ? `tv:trades:${userId}:` : "";
  const initialData = useMemo(() => {
    if (!sKey) return undefined;
    return (
      readCachedTrades(sKey) ?? (accountId === null ? readCachedTrades(userLevelKey) : undefined)
    );
  }, [sKey, userLevelKey, accountId]);

  const query = useQuery({
    queryKey: tradesQueryKey(userId, accountId),
    // loadUserTrades scopes to the active account via module state; the
    // accountId in the key is what makes a switch refetch.
    queryFn: () => loadUserTrades(userId as string),
    enabled: isOn,
    staleTime: 30_000,
    initialData,
  });

  // Persist to sessionStorage on every successful fetch so the next F5
  // restores the data instantly — once scoped to the active account, and once
  // as a userId-level mirror for the pre-account window.
  useEffect(() => {
    if (!userId || !query.data) return;
    try {
      sessionStorage.setItem(sKey, JSON.stringify(query.data));
      sessionStorage.setItem(userLevelKey, JSON.stringify(query.data));
    } catch {
      /* quota exceeded — non-critical */
    }
  }, [query.data, sKey, userLevelKey, userId]);

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
