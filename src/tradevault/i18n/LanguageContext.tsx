import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { loadLanguage, saveLanguage } from '../store';
import { LANG_NAMES, translate, type Lang, type TKey } from './translations';

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: TKey) => string;
  langName: string;
}

const LanguageCtx = createContext<Ctx | null>(null);

const STORAGE_KEY = 'tv.lang';

function readInitialLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && stored in LANG_NAMES) return stored as Lang;
  const browser = window.navigator.language?.slice(0, 2);
  return (browser && browser in LANG_NAMES) ? (browser as Lang) : 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [lang, setLangState] = useState<Lang>(() => readInitialLang());

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
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { window.localStorage.setItem(STORAGE_KEY, l); } catch {}
    if (user) saveLanguage(user.id, l).catch(() => {});
  }, [user]);

  const value = useMemo<Ctx>(() => ({
    lang,
    setLang,
    t: (k: TKey) => translate(lang, k),
    langName: LANG_NAMES[lang],
  }), [lang, setLang]);

  return <LanguageCtx.Provider value={value}>{children}</LanguageCtx.Provider>;
}

export function useT() {
  const ctx = useContext(LanguageCtx);
  if (!ctx) throw new Error('useT must be used within LanguageProvider');
  return ctx;
}