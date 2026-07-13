import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../contexts/AuthContext";
import { loadLanguage, saveLanguage } from "../store";
import { useRealtimeProfile } from "../hooks/useRealtimeProfile";
import { LANG_NAMES, en, localeLoaders, type Dict, type Lang, type TKey } from "./translations";

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: TKey) => string;
  langName: string;
}

const LanguageCtx = createContext<Ctx | null>(null);

const STORAGE_KEY = "tv.lang";

function readInitialLang(): Lang {
  // Always default to English. Language only changes when the user explicitly
  // picks one in Settings (persisted to localStorage / their profile). We do NOT
  // auto-detect the browser locale — that caused unwanted Spanish/other defaults.
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && stored in LANG_NAMES) return stored as Lang;
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [lang, setLangState] = useState<Lang>(() => readInitialLang());
  // Non-English dicts are code-split; English (the fallback) ships in the
  // main bundle. Until the chunk resolves, t() falls back to English.
  const [dict, setDict] = useState<Dict | null>(null);

  useEffect(() => {
    if (lang === "en") {
      setDict(null);
      return;
    }
    let active = true;
    localeLoaders[lang]()
      .then((m) => {
        if (active) setDict(m.default);
      })
      .catch(() => {
        if (active) setDict(null);
      });
    return () => {
      active = false;
    };
  }, [lang]);

  useEffect(() => {
    if (!user) return;
    loadLanguage(user.id)
      .then((l) => {
        if (l && l in LANG_NAMES) {
          setLangState(l as Lang);
          window.localStorage.setItem(STORAGE_KEY, l);
        }
      })
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    }
  }, [lang]);

  const setLang = useCallback(
    (l: Lang) => {
      setLangState(l);
      try {
        window.localStorage.setItem(STORAGE_KEY, l);
      } catch {
        // storage unavailable (private mode) — non-fatal
      }
      if (user) saveLanguage(user.id, l).catch(() => {});
    },
    [user],
  );

  // Live cross-device sync: when the language is changed on another device, the
  // profile row updates and we apply it here in real time. No-op if the remote
  // value matches, or if Realtime isn't enabled on `profiles`.
  const onProfileChange = useCallback((row: Record<string, unknown>) => {
    const l = row.language;
    if (typeof l === "string" && l in LANG_NAMES) {
      setLangState((prev) => (prev === l ? prev : (l as Lang)));
      try {
        window.localStorage.setItem(STORAGE_KEY, l);
      } catch {
        // storage unavailable (private mode) — non-fatal
      }
    }
  }, []);
  useRealtimeProfile(user?.id, onProfileChange);

  const value = useMemo<Ctx>(
    () => ({
      lang,
      setLang,
      t: (k: TKey) => dict?.[k] ?? en[k],
      langName: LANG_NAMES[lang],
    }),
    [lang, setLang, dict],
  );

  return <LanguageCtx.Provider value={value}>{children}</LanguageCtx.Provider>;
}

export function useT() {
  const ctx = useContext(LanguageCtx);
  if (!ctx) throw new Error("useT must be used within LanguageProvider");
  return ctx;
}
