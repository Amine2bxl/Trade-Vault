import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./AuthContext";
import {
  type Account,
  type AccountType,
  loadAccounts,
  createAccount,
  updateAccount,
  deleteAccount as deleteAccountRow,
  recalibrateAccount,
  loadActiveAccountId,
  saveActiveAccountId,
  setActiveAccountId,
} from "../store";
import { factorFor } from "../utils/accountCalibration";
import { clearTradesCache } from "../hooks/useTrades";

interface Ctx {
  accounts: Account[];
  activeId: string | null;
  activeAccount: Account | null;
  /** True once accounts + active id are resolved — gate data loads on this. */
  ready: boolean;
  switchAccount: (id: string) => void;
  addAccount: (input: {
    name: string;
    type: AccountType;
    icon?: string;
    startingBalance: number;
  }) => Promise<Account>;
  editAccount: (
    id: string,
    patch: Partial<{ name: string; type: AccountType; icon: string; startingBalance: number }>,
  ) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;
  /** Recalibre un compte. Convertit les trades déjà encodés, une seule fois,
   *  puis rend leur nombre. */
  recalibrate: (id: string, targetBalance: number) => Promise<number>;
  refresh: () => Promise<void>;
}

const AccountCtx = createContext<Ctx | null>(null);

export function useAccounts(): Ctx {
  const ctx = useContext(AccountCtx);
  if (!ctx) throw new Error("useAccounts must be used within AccountProvider");
  return ctx;
}

const lsKey = (uid: string) => `tv-active-account-${uid}`;

export function AccountProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Apply an active account everywhere: ambient store id (scopes queries) +
  // local state (triggers re-fetches) + localStorage (instant next-load).
  const apply = useCallback((uid: string, id: string | null) => {
    setActiveAccountId(id);
    setActiveId(id);
    if (id) {
      try {
        localStorage.setItem(lsKey(uid), id);
      } catch {
        /* noop */
      }
    }
  }, []);

  const load = useCallback(
    async (uid: string) => {
      // Restore last active id synchronously so the very first query is scoped.
      let cached: string | null = null;
      try {
        cached = localStorage.getItem(lsKey(uid));
      } catch {
        /* noop */
      }
      if (cached) setActiveAccountId(cached);

      const list = await loadAccounts(uid);
      // Restore icons from localStorage
      for (const a of list) {
        try {
          const icon = localStorage.getItem(`tv.accountIcon.${a.id}`);
          if (icon) a.icon = icon;
        } catch {
          /* localStorage indisponible (navigation privée, quota) — l'icône
             est un confort, jamais un prérequis. */
        }
      }
      setAccounts(list);

      let active = await loadActiveAccountId(uid).catch(() => null);
      if (!active || !list.some((a) => a.id === active)) {
        active =
          (cached && list.some((a) => a.id === cached) ? cached : null) ??
          list.find((a) => a.isDefault)?.id ??
          list[0]?.id ??
          null;
      }
      apply(uid, active);
      setReady(true);
    },
    [apply],
  );

  useEffect(() => {
    if (!user) {
      setAccounts([]);
      setActiveId(null);
      setActiveAccountId(null);
      setReady(false);
      return;
    }
    setReady(false);
    load(user.id).catch((e) => {
      console.error("Failed to load accounts", e);
      setReady(true); // never hard-block the app on account load
    });
  }, [user?.id, load]);

  const switchAccount = useCallback(
    (id: string) => {
      if (!user || id === activeId) return;
      apply(user.id, id);
      saveActiveAccountId(user.id, id).catch(() => {});
    },
    [user, activeId, apply],
  );

  const addAccount = useCallback(
    async (input: { name: string; type: AccountType; icon?: string; startingBalance: number }) => {
      if (!user) throw new Error("not authenticated");
      const acc = await createAccount(user.id, {
        name: input.name,
        type: input.type,
        startingBalance: input.startingBalance,
      });
      if (input.icon) {
        try {
          localStorage.setItem(`tv.accountIcon.${acc.id}`, input.icon);
        } catch {
          /* localStorage indisponible (navigation privée, quota) — l'icône
             est un confort, jamais un prérequis. */
        }
        acc.icon = input.icon;
      }
      setAccounts((prev) => [...prev, acc]);
      apply(user.id, acc.id);
      saveActiveAccountId(user.id, acc.id).catch(() => {});
      return acc;
    },
    [user, apply],
  );

  const editAccount = useCallback(
    async (
      id: string,
      patch: Partial<{ name: string; type: AccountType; icon: string; startingBalance: number }>,
    ) => {
      if (!user) return;
      const { icon, ...dbPatch } = patch;
      await updateAccount(
        user.id,
        id,
        dbPatch as Partial<{ name: string; type: AccountType; startingBalance: number }>,
      );
      if (icon !== undefined) {
        try {
          localStorage.setItem(`tv.accountIcon.${id}`, icon);
        } catch {
          /* localStorage indisponible (navigation privée, quota) — l'icône
             est un confort, jamais un prérequis. */
        }
      }
      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    },
    [user],
  );

  const removeAccount = useCallback(
    async (id: string) => {
      if (!user) return;
      if (accounts.length <= 1) throw new Error("Cannot delete your only account");
      await deleteAccountRow(user.id, id);
      const remaining = accounts.filter((a) => a.id !== id);
      setAccounts(remaining);
      if (activeId === id) {
        const next = remaining.find((a) => a.isDefault)?.id ?? remaining[0]?.id ?? null;
        apply(user.id, next);
        if (next) saveActiveAccountId(user.id, next).catch(() => {});
      }
    },
    [user, accounts, activeId, apply],
  );

  const recalibrate = useCallback(
    async (id: string, targetBalance: number) => {
      if (!user) return 0;
      const account = accounts.find((a) => a.id === id);
      // Un compte absent de la liste de CET utilisateur n'est pas
      // recalibrable : première barrière, avant le filtre `user_id` de la
      // requête et les politiques RLS.
      if (!account) throw new Error("Unknown account");

      // Le facteur porte sur la représentation COURANTE, puisque c'est elle
      // qui est stockée : le recalibrage précédent a réellement converti les
      // lignes. Le facteur cumulé, lui, se mesure depuis le capital d'origine
      // et sert à l'affichage et au retour en arrière.
      const original = account.originalBalance || account.startingBalance;
      const factor = factorFor(account.startingBalance, targetBalance);
      const cumulative = factorFor(original, targetBalance);

      const converted = await recalibrateAccount(user.id, id, {
        originalBalance: original,
        targetBalance,
        factor,
        cumulative,
      });

      setAccounts((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                startingBalance: targetBalance,
                calibrationScale: cumulative,
                originalBalance: original,
                calibratedAt: new Date().toISOString(),
              }
            : a,
        ),
      );

      // Le recalibrage réécrit des dizaines de lignes côté serveur : la copie
      // que l'application tient en mémoire est devenue fausse d'un coup. Sans
      // ces deux lignes, le Journal continue d'afficher les anciens montants
      // jusqu'à un rechargement complet — et le trader conclut, à raison, que
      // « le recalibrage ne fait rien ».
      //
      // Le miroir sessionStorage doit être purgé AVANT l'invalidation : il sert
      // d'`initialData`, donc il repeindrait les valeurs d'avant pendant que le
      // refetch est en vol.
      clearTradesCache(user.id);
      await queryClient.invalidateQueries({ queryKey: ["trades"] });

      return converted;
    },
    [user, accounts, queryClient],
  );

  const refresh = useCallback(async () => {
    if (user) await load(user.id);
  }, [user, load]);

  const value = useMemo<Ctx>(
    () => ({
      accounts,
      activeId,
      activeAccount: accounts.find((a) => a.id === activeId) ?? null,
      ready,
      switchAccount,
      addAccount,
      editAccount,
      removeAccount,
      recalibrate,
      refresh,
    }),
    [
      accounts,
      activeId,
      ready,
      switchAccount,
      addAccount,
      editAccount,
      removeAccount,
      recalibrate,
      refresh,
    ],
  );

  return <AccountCtx.Provider value={value}>{children}</AccountCtx.Provider>;
}
