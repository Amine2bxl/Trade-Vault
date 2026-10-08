import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { syncBrokers } from "@/backend/brokers.functions";
import { hasActiveBrokerConnection } from "@/app/store/brokers";
import type { Trade } from "@/app/types";
import { clearTradesCache, tradesQueryKey } from "@/app/trading/useTrades";

/**
 * LE JOURNAL QUI SE REMPLIT TOUT SEUL.
 *
 * Tant que l'app est ouverte et qu'une connexion broker est active, ce hook
 * demande une synchronisation au serveur environ toutes les minutes — et
 * immédiatement quand l'onglet redevient visible. Chaque trade clôturé chez
 * Tradovate arrive dans le journal (cache React Query corrigé sur place, sans
 * rechargement) et OUVRE son formulaire : tout le structurel est déjà rempli,
 * le trader complète le jugement.
 *
 * Coût maîtrisé :
 *   • aucun appel hors palier Pro ;
 *   • aucun appel tant qu'aucune connexion n'existe (une seule lecture
 *     `count` au démarrage, relue quand la page Brokers annonce un
 *     changement) ;
 *   • rien quand l'onglet est caché — le cron quotidien rattrape ;
 *   • le serveur ignore une connexion synchronisée il y a moins de 30 s,
 *     donc deux onglets ne doublent pas le trafic chez Tradovate.
 */

const POLL_MS = 60_000;
const IMPORTED_EVENT = "tv:broker-imported";
const CHANGED_EVENT = "tv:brokers-changed";

interface ImportDetail {
  trades: Trade[];
  /** Ouvrir le formulaire de relecture ? (non pour un premier import
   *  historique : vingt formulaires d'affilée ne sont pas une revue.) */
  autoOpen: boolean;
}

/** Annonce des trades importés hors du hook (connexion, bouton « Synchroniser »). */
export function announceBrokerImport(trades: Trade[], opts: { autoOpen: boolean }): void {
  if (typeof window === "undefined" || trades.length === 0) return;
  window.dispatchEvent(
    new CustomEvent<ImportDetail>(IMPORTED_EVENT, { detail: { trades, autoOpen: opts.autoOpen } }),
  );
}

/** Une connexion a été ajoutée, mise en pause ou supprimée. */
export function announceBrokersChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

export function useBrokerSync(opts: {
  userId: string | undefined;
  activeAccountId: string | null;
  /** Session prête ET palier Pro : hors Pro, aucun appel (le serveur le
   *  refuserait de toute façon, `requireProPlan`). */
  ready: boolean;
  /** Trades fraîchement importés dans le compte AFFICHÉ, à relire. */
  onReview: (trades: Trade[]) => void;
  /** Trades importés dans un AUTRE compte que celui affiché. */
  onOtherAccount: (count: number) => void;
}): void {
  const { userId, activeAccountId, ready } = opts;
  const queryClient = useQueryClient();
  const sync = useServerFn(syncBrokers);
  const enabled = useRef(false);
  const inFlight = useRef(false);
  // Les rappels changent à chaque rendu d'App : on lit toujours le dernier
  // sans relancer les minuteries.
  const callbacks = useRef(opts);
  callbacks.current = opts;

  const absorb = useCallback(
    (trades: Trade[], autoOpen: boolean) => {
      if (!userId || trades.length === 0) return;
      const mine = trades.filter((t) => !activeAccountId || t.accountId === activeAccountId);
      if (mine.length) {
        queryClient.setQueryData<Trade[]>(tradesQueryKey(userId, activeAccountId), (prev) => {
          const list = prev ?? [];
          const known = new Set(list.map((t) => t.id));
          const merged = [...list, ...mine.filter((t) => !known.has(t.id))];
          // Même ordre que `loadUserTrades` : date décroissante.
          return merged.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        });
        clearTradesCache(userId);
        if (autoOpen) callbacks.current.onReview(mine);
      }
      const elsewhere = trades.length - mine.length;
      if (elsewhere > 0) callbacks.current.onOtherAccount(elsewhere);
    },
    [userId, activeAccountId, queryClient],
  );

  const run = useCallback(async () => {
    if (!enabled.current || inFlight.current) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    inFlight.current = true;
    try {
      const res = await sync({ data: { force: false } });
      absorb(res.inserted, true);
    } catch {
      // Réseau ou serveur indisponible : silencieux, on réessaie au tour
      // suivant. L'erreur durable (jeton refusé…) est affichée sur la page
      // Brokers, pas en toast toutes les minutes.
    } finally {
      inFlight.current = false;
    }
  }, [sync, absorb]);

  useEffect(() => {
    if (!userId || !ready) return;
    let alive = true;
    const check = async () => {
      enabled.current = await hasActiveBrokerConnection(userId);
      if (alive && enabled.current) void run();
    };
    void check();

    const onImported = (e: Event) => {
      const d = (e as CustomEvent<ImportDetail>).detail;
      if (d) absorb(d.trades, d.autoOpen);
    };
    const onChanged = () => void check();
    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    window.addEventListener(IMPORTED_EVENT, onImported);
    window.addEventListener(CHANGED_EVENT, onChanged);
    document.addEventListener("visibilitychange", onVisible);
    const id = window.setInterval(() => void run(), POLL_MS);
    return () => {
      alive = false;
      window.removeEventListener(IMPORTED_EVENT, onImported);
      window.removeEventListener(CHANGED_EVENT, onChanged);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
    };
  }, [userId, ready, run, absorb]);
}
