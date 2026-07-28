import { useEffect, useState } from "react";
import type { Lang } from "../i18n/translations";
import { LANG_NAMES } from "../i18n/translations";

const STORAGE_KEY = "tv.lang";

/**
 * Reads the persisted UI language without the app's LanguageProvider.
 *
 * The public routes (/privacy, /terms, /contact) render OUTSIDE the app tree,
 * so no provider is mounted. Starting at "en" keeps the SSR markup and the
 * first client paint identical — the stored language is applied after mount,
 * which avoids a hydration mismatch.
 */
export function usePersistedLang(): Lang {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && stored in LANG_NAMES) setLang(stored as Lang);
    } catch {
      // storage unavailable — keep English
    }
  }, []);
  return lang;
}
