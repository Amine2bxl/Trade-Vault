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
//     `-rgb` triplets → drive glows, gradients, charts, navbar, FAB…
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
}

export type ThemeVars = Record<string, string>;

// ---- color math: sRGB hex → OKLCH -------------------------------------

function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return [6, 182, 212];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToOklch([r, g, b]: [number, number, number]): { L: number; C: number; H: number } {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
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
  const rgbStr = (hex: string) => hexToRgb(hex).join(' ');
  // Normalise chroma against a "vivid" reference (~0.14) so a muted anchor
  // (steel/graphite) yields a muted ramp and a punchy anchor stays punchy.
  const pc = clamp(p.C / 0.14, 0.35, 1.3);
  const sc = clamp(s.C / 0.14, 0.35, 1.3);
  return {
    '--tv-primary-h': p.H.toFixed(1),
    '--tv-primary-c': pc.toFixed(3),
    '--tv-secondary-h': s.H.toFixed(1),
    '--tv-secondary-c': sc.toFixed(3),
    '--tv-accent': theme.primary,
    '--tv-accent-2': theme.secondary,
    '--tv-highlight': theme.highlight,
    '--tv-accent-rgb': rgbStr(theme.primary),
    '--tv-accent-2-rgb': rgbStr(theme.secondary),
    '--tv-highlight-rgb': rgbStr(theme.highlight),
  };
}

/** Apply a resolved variable map to the document root (runtime retint). */
export function applyThemeVars(vars: ThemeVars) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const k in vars) root.style.setProperty(k, vars[k]);
  // Keep the browser UI (address bar / notch) in step with the theme.
  const tc = document.querySelector('meta[name="theme-color"]');
  if (tc) tc.setAttribute('content', '#060810');
}

// ---- palette helpers for the theme editor -----------------------------

/** Nudge a hex toward white for a coherent "highlight" suggestion. */
export function lighten(hex: string, amt = 0.22): string {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * amt);
  return '#' + [mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('');
}

/** Suggest a coherent secondary by rotating the primary hue ~30°. */
export function harmonize(hex: string): string {
  const { L, C, H } = rgbToOklch(hexToRgb(hex));
  return oklchToHex(L, C, (H + 32) % 360);
}

// OKLCH → sRGB hex (needed to synthesise harmonised swatches in the editor).
export function oklchToHex(L: number, C: number, H: number): string {
  const h = (H * Math.PI) / 180;
  const a = Math.cos(h) * C, b = Math.sin(h) * C;
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  let r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  const toGamma = (c: number) => {
    const x = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(clamp(x, 0, 1) * 255);
  };
  return '#' + [toGamma(r), toGamma(g), toGamma(bl)].map((c) => c.toString(16).padStart(2, '0')).join('');
}

// ---- built-in themes --------------------------------------------------

export const BUILTIN_THEMES: ThemeDef[] = [
  { id: 'jarvis',   name: 'Jarvis',   builtin: true, primary: '#06b6d4', secondary: '#14b8a6', highlight: '#22d3ee' },
  { id: 'midnight', name: 'Midnight', builtin: true, primary: '#6366f1', secondary: '#8b5cf6', highlight: '#a5b4fc' },
  { id: 'lucid',    name: 'Lucid',    builtin: true, primary: '#10b981', secondary: '#2dd4bf', highlight: '#6ee7b7' },
  { id: 'ember',    name: 'Ember',    builtin: true, primary: '#f59e0b', secondary: '#fb7185', highlight: '#fcd34d' },
  { id: 'plasma',   name: 'Plasma',   builtin: true, primary: '#ec4899', secondary: '#a855f7', highlight: '#f0abfc' },
  { id: 'graphite', name: 'Graphite', builtin: true, primary: '#64748b', secondary: '#94a3b8', highlight: '#cbd5e1' },
];

export const DEFAULT_THEME_ID = 'midnight';

// ---- persistence (localStorage; per device, restored before paint) -----

const STORE_KEY = 'tv-themes';      // { custom: ThemeDef[], activeId, defaultId }
const VARS_KEY = 'tv-theme-vars';   // flat resolved map for the active theme

export interface ThemeStore {
  custom: ThemeDef[];
  activeId: string;
  defaultId: string;
}

export function loadThemeStore(): ThemeStore {
  const fallback: ThemeStore = { custom: [], activeId: DEFAULT_THEME_ID, defaultId: DEFAULT_THEME_ID };
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return fallback;
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
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
    // Persist the resolved vars separately so the pre-paint bootstrap script
    // can apply them without any color math.
    localStorage.setItem(VARS_KEY, JSON.stringify(activeVars));
  } catch {}
}

export function allThemes(store: ThemeStore): ThemeDef[] {
  return [...BUILTIN_THEMES, ...store.custom];
}

export function findTheme(store: ThemeStore, id: string): ThemeDef {
  return allThemes(store).find((t) => t.id === id) || BUILTIN_THEMES[0];
}
