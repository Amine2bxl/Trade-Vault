import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { onResync, onTable } from "../store/liveSync";
import { rowToTrade } from "../store";
import type { Trade } from "../types";
import { tradesQueryKey, clearTradesCache } from "./useTrades";

/**
 * Synchronisation LIVE des trades entre tous les appareils d'une même session.
 *
 * Un trade encodé sur le téléphone apparaît sur le portable ouvert à côté sans
 * rafraîchir, une modification se propage, une suppression disparaît partout.
 * Le cache React Query est corrigé sur place (pas de rechargement complet) :
 * l'écran ne clignote pas et l'écriture optimiste locale n'est jamais annulée
 * — l'écho de sa propre écriture réinjecte exactement la même ligne.
 *
 * Le miroir sessionStorage est purgé à chaque événement, sinon un F5 juste
 * après repeindrait la version d'avant.
 *
 * Passe par le moyeu unique (`store/liveSync.ts`). Après une coupure ou un
 * long passage en arrière-plan, la liste est relue : c'est ce qui rattrape un
 * trade encodé ailleurs pendant que cet appareil dormait.
 *
 * Sans Realtime activé sur la table, rien n'arrive : rien ne casse.
 */
export function useRealtimeTrades(userId: string | undefined, accountId: string | null): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const apply = (updater: (prev: Trade[]) => Trade[]) => {
      queryClient.setQueryData<Trade[]>(tradesQueryKey(userId, accountId), (prev) =>
        updater(prev ?? []),
      );
      clearTradesCache(userId);
    };

    const offTable = onTable("trades", (c) => {
      if (c.eventType === "DELETE") {
        const gone = (c.old as { id?: string } | null)?.id;
        if (gone) apply((prev) => prev.filter((t) => t.id !== gone));
        return;
      }
      const row = c.new;
      if (!row || typeof row.id !== "string") return;
      // Un trade d'un AUTRE compte ne doit pas polluer la vue courante.
      const rowAccount = (row.account_id as string | null) ?? null;
      if (accountId && rowAccount && rowAccount !== accountId) {
        apply((prev) => prev.filter((t) => t.id !== row.id));
        return;
      }
      const trade = rowToTrade(row as unknown as Parameters<typeof rowToTrade>[0]);
      apply((prev) => {
        const next = prev.some((t) => t.id === trade.id)
          ? prev.map((t) => (t.id === trade.id ? trade : t))
          : [...prev, trade];
        // Même ordre que `loadUserTrades` (date décroissante).
        return next.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      });
    });
    // Des événements ont pu être perdus : on relit la liste depuis la base.
    const offResync = onResync(() => {
      clearTradesCache(userId);
      void queryClient.invalidateQueries({ queryKey: tradesQueryKey(userId, accountId) });
    });

    return () => {
      offTable();
      offResync();
    };
  }, [userId, accountId, queryClient]);
}
