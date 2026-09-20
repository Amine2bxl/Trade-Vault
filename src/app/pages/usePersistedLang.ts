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

/**
 * LA LANGUE D'UNE PAGE PUBLIQUE — la vitrine d'abord, l'app ensuite.
 *
 * Les pages légales sont atteintes par le pied de page de la VITRINE, qui a
 * son propre sélecteur et sa propre clé (`tv.landing.lang`). Ne lire que
 * `tv.lang` produisait la coupure suivante : un visiteur non connecté passait
 * la vitrine en français, cliquait « Confidentialité », et tombait sur un
 * document anglais - parce qu'il n'avait jamais ouvert l'application et donc
 * jamais écrit `tv.lang`.
 *
 * L'ordre inverse serait pire pour un utilisateur connecté, qui a choisi la
 * langue de son application et ne s'attend pas à ce qu'une visite passée sur
 * la vitrine la lui change. D'où cette règle : la préférence vitrine gagne
 * quand elle existe, sinon la préférence application, sinon l'anglais.
 */
const LANDING_KEY = "tv.landing.lang";

export function usePublicLang(): Lang {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    try {
      const vitrine = window.localStorage.getItem(LANDING_KEY);
      if (vitrine && vitrine in LANG_NAMES) {
        setLang(vitrine as Lang);
        return;
      }
      const app = window.localStorage.getItem(STORAGE_KEY);
      if (app && app in LANG_NAMES) setLang(app as Lang);
    } catch {
      // storage unavailable — keep English
    }
  }, []);
  return lang;
}
