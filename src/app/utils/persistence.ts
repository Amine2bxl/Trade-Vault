// ============================================================
//  Global persistence layer
// ------------------------------------------------------------
//  A tiny, dependency-free store on top of localStorage that:
//   • namespaces every key per user (so two accounts on one device
//     never see each other's drafts / chat),
//   • notifies subscribers the instant a value changes — in the SAME
//     tab (via a CustomEvent) and ACROSS tabs (via the native `storage`
//     event) — so a badge in one component reacts to a write in another,
//   • survives reloads and "come back later" navigation.
//
//  This is the client half of "global memory": actions in progress
//  (a half-written trade, an open AI conversation) persist immediately
//  and are restored wherever/whenever the user returns on that device.
//  Cross-DEVICE sync of server-backed prefs is handled separately by the
//  Supabase profile store + realtime hook.
// ============================================================

import { useEffect, useState } from "react";

const PREFIX = "tv";
const CHANGED_EVENT = "tv:persist-change";

/** Build a per-user namespaced storage key. Falls back to `anon` pre-login. */
export function nsKey(userId: string | undefined | null, key: string): string {
  return `${PREFIX}.${userId || "anon"}.${key}`;
}

export function readJSON<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw != null ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: key }));
  } catch {
    // storage full / unavailable (private mode) — persistence is best-effort
  }
}

export function removeKey(key: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(key);
    window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: key }));
  } catch {
    // ignore
  }
}

/**
 * Read a persisted value that re-renders the component whenever it changes,
 * from anywhere: this tab (CustomEvent) or another tab (storage event).
 * `fallback` is treated as stable — pass a constant, not a fresh object literal
 * you expect to change.
 */
export function usePersistedValue<T>(key: string, fallback: T): T {
  const [val, setVal] = useState<T>(() => readJSON(key, fallback));

  useEffect(() => {
    // Key may have changed (e.g. user logged in) — resync immediately.
    setVal(readJSON(key, fallback));
    const onChange = (e: Event) => {
      if ((e as CustomEvent).detail === key) setVal(readJSON(key, fallback));
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setVal(readJSON(key, fallback));
    };
    window.addEventListener(CHANGED_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
    // fallback intentionally excluded — see doc above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return val;
}

// ---- Trade draft ----------------------------------------------------------

/** Text fields of a half-written trade. Screenshots are excluded on purpose:
 *  their upload lifecycle can't safely outlive the modal, so drafts stay text. */
export type TradeDraft = Record<string, unknown>;

export function tradeDraftKey(userId: string | undefined | null): string {
  return nsKey(userId, "draft.trade");
}

/** Reactive "is there a saved draft?" flag for Add-trade badges. */
export function useHasTradeDraft(userId: string | undefined | null): boolean {
  const draft = usePersistedValue<TradeDraft | null>(tradeDraftKey(userId), null);
  return draft != null;
}
