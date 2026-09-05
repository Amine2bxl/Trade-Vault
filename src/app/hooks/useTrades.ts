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

/**
 * Taille maximale du miroir de session, en caractères.
 *
 * `sessionStorage` plafonne autour de 5 Mo par origine, partagés avec tout le
 * reste. Deux mégaoctets laissent de la marge et couvrent très largement un
 * historique ordinaire.
 *
 * POURQUOI ON NE TRONQUE PAS L'HISTORIQUE POUR LE FAIRE ENTRER. Le miroir sert
 * d'`initialData` : il est peint tel quel, et TOUT ce que le produit calcule —
 * win rate, expectancy, drawdown, Monte-Carlo — le serait sur cet échantillon.
 * Afficher un instant des chiffres faux est pire que d'afficher un squelette
 * une seconde de plus. Au-delà du seuil, on ne miroite donc RIEN.
 */
const MIRROR_MAX_CHARS = 2_000_000;

/** sessionStorage persistence: on F5 the in-memory React Query cache is gone
 * and the dashboard waits ~3s for a cold Supabase round-trip. Persisting the
 * last successful fetch and feeding it back as `initialData` makes the page
 * paint instantly with the previous data while a background refetch silently
 * updates it.
 *
 * `sessionStorage` ET PAS `localStorage` — c'est délibéré, ne pas « corriger ».
 * `localStorage` ferait gagner un clignotement de squelette au retour sur le
 * produit ; il laisserait aussi l'historique complet de P&L du trader sur le
 * disque, indéfiniment, en survivant à la déconnexion et lisible sur une
 * machine partagée ou empruntée. Tout le contenu de ce produit est la
 * performance financière de quelqu'un : l'échange ne vaut pas ce qu'il coûte.
 * Si cela devient une option un jour, elle est opt-in et s'efface à la
 * déconnexion — décision produit, pas refactorisation. */
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

/**
 * Purge le miroir sessionStorage des trades d'un utilisateur.
 *
 * INDISPENSABLE APRÈS UNE ÉCRITURE EN MASSE côté serveur — un recalibrage, par
 * exemple. Invalider la requête React Query ne suffit pas : `initialData` relit
 * sessionStorage et repeint les ANCIENNES valeurs pendant que le refetch part.
 * L'utilisateur voit alors ses montants d'avant et conclut que l'opération n'a
 * rien fait, alors qu'elle a bien eu lieu en base.
 *
 * La construction des clés reste ici, où elle est déjà définie : la dupliquer
 * ailleurs garantirait qu'un des deux endroits finisse par diverger.
 */
export function clearTradesCache(userId: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const prefix = `tv:trades:${userId}:`;
    const doomed: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(prefix)) doomed.push(key);
    }
    for (const key of doomed) sessionStorage.removeItem(key);
  } catch {
    /* stockage indisponible — le refetch corrigera l'affichage */
  }
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
    // Le compte est passé EXPLICITEMENT, depuis la clé.
    //
    // La requête lisait l'état de module `getActiveAccountId()`. Tant que le
    // rendu et la lecture se suivent, les deux coïncident — mais React Query
    // relance aussi une requête HORS du cycle de rendu (reconnexion réseau,
    // nouvelle tentative après échec). Ce refetch-là s'exécutait avec le compte
    // COURANT et écrivait son résultat sous la clé d'un AUTRE compte : les
    // trades du compte B apparaissaient dans la vue du compte A.
    queryFn: () => loadUserTrades(userId as string, { accountId }),
    enabled: isOn,
    staleTime: 30_000,
    initialData,
    // SANS CETTE LIGNE, `initialData` est considérée comme fraîche à l'instant
    // du montage : combinée à `staleTime`, elle empêchait TOUT rafraîchissement
    // pendant trente secondes après un F5. Le commentaire ci-dessus promettait
    // « un refetch d'arrière-plan met silencieusement à jour » ; ce refetch ne
    // partait jamais, et l'écran restait sur la copie de session — y compris
    // après une écriture faite sur un autre appareil.
    //
    // `0` déclare la donnée comme datant de l'époque Unix : elle est donc
    // périmée d'entrée, peinte immédiatement, et rafraîchie aussitôt.
    initialDataUpdatedAt: 0,
  });

  // Persist to sessionStorage on every successful fetch so the next F5
  // restores the data instantly — once scoped to the active account, and once
  // as a userId-level mirror for the pre-account window.
  //
  // L'ÉCHEC DU MIROIR N'EST PLUS SILENCIEUX. `setItem` levait dès que
  // l'historique dépassait le quota, le `catch` l'avalait, et la « peinture
  // instantanée » cessait de fonctionner précisément pour les comptes les plus
  // fournis — sans que rien ne le dise, et en laissant en place une version
  // PÉRIMÉE qui resservait d'`initialData` au F5 suivant.
  useEffect(() => {
    if (!userId || !query.data) return;

    const drop = () => {
      try {
        sessionStorage.removeItem(sKey);
        if (userLevelKey !== sKey) sessionStorage.removeItem(userLevelKey);
      } catch {
        /* stockage indisponible — le refetch corrigera l'affichage */
      }
    };

    let payload: string;
    try {
      payload = JSON.stringify(query.data);
    } catch {
      drop();
      return;
    }

    if (payload.length > MIRROR_MAX_CHARS) {
      // Trop gros : pas de miroir du tout, et surtout pas de miroir PARTIEL —
      // il serait peint comme s'il était l'historique complet.
      drop();
      return;
    }

    try {
      sessionStorage.setItem(sKey, payload);
      // Compte nul : les deux clés sont la MÊME chaîne, inutile d'écrire deux fois.
      if (userLevelKey !== sKey) sessionStorage.setItem(userLevelKey, payload);
    } catch {
      drop();
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
