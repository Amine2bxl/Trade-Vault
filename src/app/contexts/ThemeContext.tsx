import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ThemeDef,
  ThemeStore,
  BUILTIN_THEMES,
  DEFAULT_THEME_ID,
  allThemes,
  findTheme,
  loadThemeStore,
  saveThemeStore,
  computeThemeVars,
  applyThemeVars,
} from "../utils/themes";

interface ThemeContextValue {
  themes: ThemeDef[];
  active: ThemeDef;
  activeId: string;
  defaultId: string;
  setActive: (id: string) => void;
  setDefault: (id: string) => void;
  /** Create a custom theme; returns its id so the UI can select/edit it. */
  createTheme: (def: Omit<ThemeDef, "id" | "builtin">) => string;
  updateTheme: (id: string, patch: Partial<Omit<ThemeDef, "id" | "builtin">>) => void;
  duplicateTheme: (id: string) => string;
  deleteTheme: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const rid = () => "c" + Math.random().toString(36).slice(2, 9);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initialise from localStorage synchronously on the client so the very first
  // render already matches the persisted theme (the pre-paint bootstrap script
  // in __root has typically applied the vars already).
  const [store, setStore] = useState<ThemeStore>(() => loadThemeStore());

  const active = useMemo(() => findTheme(store, store.activeId), [store]);

  // Apply + persist whenever the active theme (or its definition) changes.
  useEffect(() => {
    const vars = computeThemeVars(active);
    applyThemeVars(vars);
    saveThemeStore(store, vars);
  }, [store, active]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themes: allThemes(store),
      active,
      activeId: store.activeId,
      defaultId: store.defaultId,
      setActive: (id) => setStore((s) => ({ ...s, activeId: id })),
      setDefault: (id) => setStore((s) => ({ ...s, defaultId: id })),
      createTheme: (def) => {
        const id = rid();
        setStore((s) => ({ ...s, custom: [...s.custom, { ...def, id }], activeId: id }));
        return id;
      },
      updateTheme: (id, patch) =>
        setStore((s) => ({
          ...s,
          custom: s.custom.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      duplicateTheme: (id) => {
        const src = findTheme(store, id);
        const nid = rid();
        const copy: ThemeDef = {
          id: nid,
          name: `${src.name} copy`,
          primary: src.primary,
          secondary: src.secondary,
          highlight: src.highlight,
        };
        setStore((s) => ({ ...s, custom: [...s.custom, copy], activeId: nid }));
        return nid;
      },
      deleteTheme: (id) =>
        setStore((s) => {
          const custom = s.custom.filter((t) => t.id !== id);
          const gone = s.activeId === id;
          const defGone = s.defaultId === id;
          const fallback = defGone ? DEFAULT_THEME_ID : s.defaultId;
          return {
            custom,
            activeId: gone ? fallback : s.activeId,
            defaultId: defGone ? DEFAULT_THEME_ID : s.defaultId,
          };
        }),
    }),
    [store, active],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export { BUILTIN_THEMES };
