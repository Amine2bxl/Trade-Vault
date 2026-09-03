// ============================================================
//  Theme engine
// ------------------------------------------------------------
//  A theme is defined by 2–3 anchor colors (primary / secondary /
//  highlight). From those we derive a flat map of CSS custom
//  properties that the whole UI inherits automatically:
//
//   • --tv-primary-h / --tv-primary-c  → drive the entire `cyan-*`
//     Tailwind ramp (regenerated in oklch from the hue + chroma).
//   • --tv-secondary-h / --tv-secondary-c → drive the `teal-*` ramp.
//   • --tv-accent / --tv-accent-2 / --tv-highlight (hex) and their
//     `-rgb` triplets → drive charts, active states, the primary button…
//
//  Un thème ne change QUE l'identité (la teinte de l'accent, le fond). Il ne
//  peut pas changer la grammaire : la plaque, le liseré, la densité et le
//  vocabulaire du chiffre sont les mêmes partout. C'est ce qui fait qu'un
//  thème est une variante du produit, et non un autre produit.
//
//  Because every accent surface reads these variables, swapping the
//  active theme retints the app in one paint with zero component edits.
// ============================================================

export interface ThemeDef {
  id: string;
  name: string;
  builtin?: boolean;
  /** main accent (buttons, active states, line charts) */
  primary: string;
  /** secondary accent (gradient end, teal ramp) */
  secondary: string;
  /** bright highlight used for glows / gradient tips */
  highlight: string;
  /**
   * Fond de l'application. OPTIONNEL — et c'est ce qui rend l'extension sûre :
   * les thèmes déjà enregistrés par les utilisateurs ne portent pas ce champ,
   * ils retombent donc sur la valeur d'origine et restent identiques.
   */
  background?: string;
  /** Couleur de texte principale. Optionnelle, même raison. */
  text?: string;
}

/** Valeurs d'origine — le rendu sans thème personnalisé, à l'identique. */
export const DEFAULT_BACKGROUND = "#0a0b0d";
export const DEFAULT_TEXT = "#e6e8ea";

export type ThemeVars = Record<string, string>;

// ---- color math: sRGB hex → OKLCH -------------------------------------

function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return [6, 182, 212];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToOklch([r, g, b]: [number, number, number]): { L: number; C: number; H: number } {
  const lr = srgbToLinear(r),
    lg = srgbToLinear(g),
    lb = srgbToLinear(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l),
    m_ = Math.cbrt(m),
    s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const C = Math.sqrt(a * a + bb * bb);
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Resolve a theme definition into the flat CSS-variable map applied to :root. */
export function computeThemeVars(theme: ThemeDef): ThemeVars {
  const p = rgbToOklch(hexToRgb(theme.primary));
  const s = rgbToOklch(hexToRgb(theme.secondary));
  const rgbStr = (hex: string) => hexToRgb(hex).join(" ");
  // Normalise chroma against a "vivid" reference (~0.14) so a muted anchor
  // (steel/graphite) yields a muted ramp and a punchy anchor stays punchy.
  const pc = clamp(p.C / 0.14, 0.35, 1.3);
  const sc = clamp(s.C / 0.14, 0.35, 1.3);
  return {
    "--tv-primary-h": p.H.toFixed(1),
    "--tv-primary-c": pc.toFixed(3),
    "--tv-secondary-h": s.H.toFixed(1),
    "--tv-secondary-c": sc.toFixed(3),
    "--tv-accent": theme.primary,
    "--tv-accent-2": theme.secondary,
    "--tv-highlight": theme.highlight,
    "--tv-accent-rgb": rgbStr(theme.primary),
    "--tv-accent-2-rgb": rgbStr(theme.secondary),
    "--tv-highlight-rgb": rgbStr(theme.highlight),
    "--tv-bg": theme.background ?? DEFAULT_BACKGROUND,
    "--tv-text": theme.text ?? DEFAULT_TEXT,
  };
}

/** Apply a resolved variable map to the document root (runtime retint). */
export function applyThemeVars(vars: ThemeVars) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const k in vars) root.style.setProperty(k, vars[k]);
  // Keep the browser UI (address bar / notch) in step with the theme.
  const tc = document.querySelector('meta[name="theme-color"]');
  if (tc) tc.setAttribute("content", vars["--tv-bg"] ?? DEFAULT_BACKGROUND);
}

// ---- palette helpers for the theme editor -----------------------------

/** Nudge a hex toward white for a coherent "highlight" suggestion. */
export function lighten(hex: string, amt = 0.22): string {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * amt);
  return "#" + [mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("");
}

/** Suggest a coherent secondary by rotating the primary hue ~30°. */
export function harmonize(hex: string): string {
  const { L, C, H } = rgbToOklch(hexToRgb(hex));
  return oklchToHex(L, C, (H + 32) % 360);
}

// OKLCH → sRGB hex (needed to synthesise harmonised swatches in the editor).
function oklchToHex(L: number, C: number, H: number): string {
  const h = (H * Math.PI) / 180;
  const a = Math.cos(h) * C,
    b = Math.sin(h) * C;
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3,
    m = m_ ** 3,
    s = s_ ** 3;
  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const toGamma = (c: number) => {
    const x = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(clamp(x, 0, 1) * 255);
  };
  return (
    "#" + [toGamma(r), toGamma(g), toGamma(bl)].map((c) => c.toString(16).padStart(2, "0")).join("")
  );
}

// ---- built-in themes --------------------------------------------------

export const BUILTIN_THEMES: ThemeDef[] = [
  {
    /* L'identité par défaut. Émeraude sobre sur noir neutre — la lecture
       que font les plateformes de prop firm (Lucid, Topstep) : le vert est
       déjà la couleur du gain, l'accent parle donc la langue du métier. */
    id: "vault",
    name: "Vault",
    builtin: true,
    primary: "#10b981",
    secondary: "#059669",
    highlight: "#34d399",
  },
  {
    /* Gris pur, aucune teinte. Pour qui ne veut AUCUNE couleur en dehors
       du P&L lui-même — la version la plus austère du produit. */
    id: "graphite",
    name: "Graphite",
    builtin: true,
    primary: "#94a3b8",
    secondary: "#64748b",
    highlight: "#cbd5e1",
  },
  {
    /* Bleu d'acier. Le calme d'un terminal, sans le cyan électrique
       d'origine : la chroma de l'ancre est volontairement basse. */
    id: "steel",
    name: "Steel",
    builtin: true,
    primary: "#3b82f6",
    secondary: "#2563eb",
    highlight: "#60a5fa",
  },
  {
    /* Ambre. Un accent chaud, utile aux daltonismes deutan/protan pour
       qui vert et rouge se ressemblent. */
    id: "amber",
    name: "Amber",
    builtin: true,
    primary: "#f59e0b",
    secondary: "#d97706",
    highlight: "#fbbf24",
  },
  {
    /* Indigo. La seule fantaisie qui reste, et elle est sombre. */
    id: "indigo",
    name: "Indigo",
    builtin: true,
    primary: "#6366f1",
    secondary: "#4f46e5",
    highlight: "#818cf8",
  },
  {
    /* Cyan — l'ancienne identité « Jarvis », conservée comme thème pour
       qui la préférait. Elle n'est plus le défaut. */
    id: "jarvis",
    name: "Jarvis",
    builtin: true,
    primary: "#06b6d4",
    secondary: "#0891b2",
    highlight: "#22d3ee",
  },
];

export const DEFAULT_THEME_ID = "vault";

// ---- persistence (localStorage; per device, restored before paint) -----

/* Les clés portent un « v2 » : les appareils qui ont déjà navigué sur
   TradeVault ont en mémoire la carte de variables de l'ancienne identité
   (fond navy, accent cyan), et le script de pré-peinture l'applique AVANT
   la feuille de style. Sans changement de clé, la refonte serait invisible
   sur exactement les appareils des utilisateurs existants. Repartir d'une
   clé neuve les remet sur l'identité par défaut ; les thèmes personnalisés
   de l'ancienne clé sont récupérés une fois, à la première lecture. */
const STORE_KEY = "tv-themes-v2"; // { custom: ThemeDef[], activeId, defaultId }
const LEGACY_STORE_KEY = "tv-themes";
const VARS_KEY = "tv-theme-vars-v2"; // flat resolved map for the active theme

export interface ThemeStore {
  custom: ThemeDef[];
  activeId: string;
  defaultId: string;
}

export function loadThemeStore(): ThemeStore {
  const fallback: ThemeStore = {
    custom: [],
    activeId: DEFAULT_THEME_ID,
    defaultId: DEFAULT_THEME_ID,
  };
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      // Première visite depuis la refonte : on ne reprend QUE les thèmes que
      // l'utilisateur a lui-même créés. Le thème actif, lui, repart du défaut.
      const legacy = localStorage.getItem(LEGACY_STORE_KEY);
      if (!legacy) return fallback;
      const old = JSON.parse(legacy);
      return { ...fallback, custom: Array.isArray(old.custom) ? old.custom : [] };
    }
    const parsed = JSON.parse(raw);
    return {
      custom: Array.isArray(parsed.custom) ? parsed.custom : [],
      activeId: parsed.activeId || parsed.defaultId || DEFAULT_THEME_ID,
      defaultId: parsed.defaultId || DEFAULT_THEME_ID,
    };
  } catch {
    return fallback;
  }
}

export function saveThemeStore(store: ThemeStore, activeVars: ThemeVars) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
    // Persist the resolved vars separately so the pre-paint bootstrap script
    // can apply them without any color math.
    localStorage.setItem(VARS_KEY, JSON.stringify(activeVars));
  } catch {
    /* best-effort persistence — ignore */
  }
}

export function allThemes(store: ThemeStore): ThemeDef[] {
  return [...BUILTIN_THEMES, ...store.custom];
}

export function findTheme(store: ThemeStore, id: string): ThemeDef {
  return allThemes(store).find((t) => t.id === id) || BUILTIN_THEMES[0];
}
