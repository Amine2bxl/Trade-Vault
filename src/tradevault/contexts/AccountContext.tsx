import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
  type Account,
  type AccountType,
  loadAccounts,
  createAccount,
  updateAccount,
  deleteAccount as deleteAccountRow,
  loadActiveAccountId,
  saveActiveAccountId,
  setActiveAccountId,
} from '../store';

interface Ctx {
  accounts: Account[];
  activeId: string | null;
  activeAccount: Account | null;
  /** True once accounts + active id are resolved — gate data loads on this. */
  ready: boolean;
  switchAccount: (id: string) => void;
  addAccount: (input: { name: string; type: AccountType; startingBalance: number }) => Promise<Account>;
  editAccount: (id: string, patch: Partial<{ name: string; type: AccountType; startingBalance: number }>) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const AccountCtx = createContext<Ctx | null>(null);

export function useAccounts(): Ctx {
  const ctx = useContext(AccountCtx);
  if (!ctx) throw new Error('useAccounts must be used within AccountProvider');
  return ctx;
}

const lsKey = (uid: string) => `tv-active-account-${uid}`;

export function AccountProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Apply an active account everywhere: ambient store id (scopes queries) +
  // local state (triggers re-fetches) + localStorage (instant next-load).
  const apply = useCallback((uid: string, id: string | null) => {
    setActiveAccountId(id);
    setActiveId(id);
    if (id) {
      try { localStorage.setItem(lsKey(uid), id); } catch { /* noop */ }
    }
  }, []);

  const load = useCallback(async (uid: string) => {
    // Restore last active id synchronously so the very first query is scoped.
    let cached: string | null = null;
    try { cached = localStorage.getItem(lsKey(uid)); } catch { /* noop */ }
    if (cached) setActiveAccountId(cached);

    const list = await loadAccounts(uid);
    setAccounts(list);

    let active = await loadActiveAccountId(uid).catch(() => null);
    if (!active || !list.some((a) => a.id === active)) {
      active = (cached && list.some((a) => a.id === cached) ? cached : null)
        ?? list.find((a) => a.isDefault)?.id
        ?? list[0]?.id
        ?? null;
    }
    apply(uid, active);
    setReady(true);
  }, [apply]);

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
      console.error('Failed to load accounts', e);
      setReady(true); // never hard-block the app on account load
    });
  }, [user?.id, load]);

  const switchAccount = useCallback((id: string) => {
    if (!user || id === activeId) return;
    apply(user.id, id);
    saveActiveAccountId(user.id, id).catch(() => {});
  }, [user, activeId, apply]);

  const addAccount = useCallback(async (input: { name: string; type: AccountType; startingBalance: number }) => {
    if (!user) throw new Error('not authenticated');
    const acc = await createAccount(user.id, input);
    setAccounts((prev) => [...prev, acc]);
    apply(user.id, acc.id); // jump straight into the new account
    saveActiveAccountId(user.id, acc.id).catch(() => {});
    return acc;
  }, [user, apply]);

  const editAccount = useCallback(async (id: string, patch: Partial<{ name: string; type: AccountType; startingBalance: number }>) => {
    if (!user) return;
    await updateAccount(user.id, id, patch);
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, [user]);

  const removeAccount = useCallback(async (id: string) => {
    if (!user) return;
    if (accounts.length <= 1) throw new Error('Cannot delete your only account');
    await deleteAccountRow(user.id, id);
    const remaining = accounts.filter((a) => a.id !== id);
    setAccounts(remaining);
    if (activeId === id) {
      const next = remaining.find((a) => a.isDefault)?.id ?? remaining[0]?.id ?? null;
      apply(user.id, next);
      if (next) saveActiveAccountId(user.id, next).catch(() => {});
    }
  }, [user, accounts, activeId, apply]);

  const refresh = useCallback(async () => {
    if (user) await load(user.id);
  }, [user, load]);

  const value = useMemo<Ctx>(() => ({
    accounts,
    activeId,
    activeAccount: accounts.find((a) => a.id === activeId) ?? null,
    ready,
    switchAccount,
    addAccount,
    editAccount,
    removeAccount,
    refresh,
  }), [accounts, activeId, ready, switchAccount, addAccount, editAccount, removeAccount, refresh]);

  return <AccountCtx.Provider value={value}>{children}</AccountCtx.Provider>;
}
