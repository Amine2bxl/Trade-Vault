/**
 * Design tokens — the TradeVault visual identity, centralized.
 *
 * These tokens codify the **landing page theme** (Manrope/Sora type, cyan/teal
 * accents, deep-navy glass surfaces, the shared motion language) which
 * `styles.css` already applies across the whole product. This file is the
 * single, typed, documented reference every primitive and every future screen
 * builds on — the "soul & skeleton" of the UI.
 *
 * IMPORTANT: this does not restyle anything. The visual source of truth is the
 * CSS in `src/styles.css` (custom properties + utility classes); these tokens
 * *point at* that CSS (class names + CSS variables) so code stays in sync with
 * the rendered theme instead of hardcoding divergent values.
 */

/** Typography — one identity across marketing site and product. */
export const font = {
  /** Manrope body stack (applied to `body` in styles.css). */
  body: '"Manrope","Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
  /** Sora display stack — use via the `font-display` utility class. */
  display: '"Sora","Manrope","Inter",-apple-system,BlinkMacSystemFont,sans-serif',
  /** Utility class for display/headings (Sora). */
  displayClass: "font-display",
  /** Tabular figures for prices / R / stats. */
  tabularClass: "tabular-nums",
} as const;

/**
 * Color — semantic roles as Tailwind color *stems* (compose with a utility
 * prefix, e.g. `text-${color.profit}`, `bg-${color.brand}/15`). Brand accents
 * are runtime-themeable via the `--tv-*` variables (default = landing cyan/teal).
 */
export const color = {
  brand: "cyan", // primary accent ramp (regenerated from --tv-primary-*)
  brandAlt: "teal", // secondary accent ramp (--tv-secondary-*)
  profit: "emerald-500",
  loss: "red-500",
  warning: "amber-500",
} as const;

/** Brand accent CSS variables (themeable at runtime by the ThemeProvider). */
export const accentVar = {
  accent: "var(--tv-accent)", // #06b6d4 default
  accentAlt: "var(--tv-accent-2)", // #14b8a6 default
  highlight: "var(--tv-highlight)", // #22d3ee default
} as const;

/** Surfaces — the deep-navy glass system shared by landing and app. */
export const surface = {
  /** Base page background (html), the landing's deep navy. */
  base: "#060d16",
  /** Translucent glass panel. */
  glassClass: "glass",
  /** Opaque glass (modals, menus). */
  glassStrongClass: "glass-strong",
  /** Hover-lift premium card. */
  cardPremiumClass: "card-premium",
  /** Solid, slightly elevated panel for dense dashboards (TradeTanto direction). */
  panelClass: "bg-[#0b1220] border border-white/[0.06] rounded-2xl",
  /** Subtle inset surface for nested sections. */
  insetClass: "bg-white/[0.02] border border-white/[0.05] rounded-xl",
} as const;

/** Radius scale (Tailwind `rounded-*`). `2xl`/`3xl` dominate the app. */
export const radius = ["sm", "md", "lg", "xl", "2xl", "3xl", "full"] as const;

/**
 * Motion — the shared animation language. All signature transitions use the
 * same ease-out-with-late-settle curve, so new components feel like one motion
 * system. Use the class names for entrances; use `easing` for JS/inline styles.
 */
export const motion = {
  /** Signature easing used across onboarding, cards, charts and modals. */
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
  fadeInUp: "animate-fade-in-up",
  fadeIn: "animate-fade-in",
  /** Modal / menu entrance (scale-in). */
  slideIn: "animate-slide-in",
  /** Bottom-sheet entrance (used by the Modal primitive on mobile). */
  slideUp: "animate-slide-up",
  glow: "animate-glow",
} as const;

/**
 * Density — the app's spacing contract. TradeVault is a working tool (traders
 * scan it daily), so surfaces stay tight and information-dense in the spirit of
 * TradingView / Linear rather than the airy marketing-SaaS default. These are
 * the ONLY padding steps a screen should use; `Card`, `PageContainer` and
 * `PageHeader` consume them so density evolves in one place.
 */
export const density = {
  /** Card/panel inner padding. */
  cardPad: "p-3.5 md:p-4",
  /** Tighter variant for list rows and compact tiles. */
  cardPadTight: "p-3",
  /** Roomier variant, reserved for hero/feature surfaces. */
  cardPadLoose: "p-5 md:p-6",
  /** Page gutters — mobile stays a touch tighter so more fits on screen.
   *  `md:p-5` matches the Mistakes page (the spacing reference for the app):
   *  one gutter size across every screen. */
  pagePad: "p-4 md:p-5",
  /** Vertical rhythm between page sections. */
  sectionGap: "mb-4 md:mb-5",
  /** Grid gap between sibling cards. */
  gridGap: "gap-3 md:gap-4",
} as const;

/**
 * Typography roles — sept étapes nommées remplaçant les `text-[Npx]` ad hoc.
 *
 * PLANCHER RÉEL : 10px (`micro`), et rien en dessous dans l'UI produit.
 *
 * Ce fichier annonçait auparavant un plancher de 11px que ~200 appels en 10px
 * contredisaient : deux sources de vérité, donc aucune. Le 10px est le palier
 * de chrome dense réellement utilisé (badges, unités, méta de cellule) et il
 * reste lisible ; le supprimer aurait été une réécriture visuelle massive et
 * invérifiable, pas une amélioration. Le palier 8px, lui, a été éliminé de
 * l'UI produit — il ne subsiste que dans la maquette miniature décorative de
 * la landing, où le texte est un motif et non une information à lire.
 *
 * Toute nouvelle surface utilise ces rôles, jamais une classe en pixels.
 */
export const type = {
  /** Page title — calm, not massive. */
  h1: "text-[26px] md:text-[30px] font-bold tracking-[-0.02em]",
  /** Section title. */
  h2: "text-base md:text-lg font-semibold tracking-[-0.01em]",
  /** Card title. */
  h3: "text-sm md:text-[15px] font-semibold",
  /** Body copy. */
  body: "text-[15px] leading-relaxed",
  /** Secondary/meta copy. */
  caption: "text-xs",
  /** Compact uppercase label (11px). */
  label: "text-[11px] uppercase tracking-[0.08em] font-medium",
  /** Chrome dense : badges, unités, méta de cellule. Le plancher — rien en dessous. */
  micro: "text-[10px]",
} as const;

/**
 * Semantic layer — the seven levels of the TradeVault visual language.
 *
 * `color` above answers "which Tailwind ramp"; this answers "what is this
 * surface FOR". Every entry points at a CSS variable defined in `styles.css`,
 * so a theme swap retints all of them at once and no theme can drift into
 * looking like a different product.
 */
export const level = {
  /** L1 — the page itself. */
  background: "var(--tv-bg)",
  /** L2 — primary surface: a card, a section, a list. Class: `tv-l2`. */
  surface: "var(--tv-surface-1)",
  /** L3 — secondary surface: a panel inside a panel. Class: `tv-l3`. */
  surfaceElevated: "var(--tv-surface-2)",
  /** L4 — interactive at rest: buttons, chips, toggles. Class: `tv-l4`. */
  interactive: "var(--tv-surface-3)",
  /** L5 — data emphasis: the accent, used on what the trader must read first. */
  emphasis: "var(--tv-accent)",
  /** L6 — risk. */
  warning: "var(--tv-warning)",
  danger: "var(--tv-danger)",
  /** L7 — discipline kept. */
  success: "var(--tv-success)",
} as const;

/** Text roles — three steps. Nothing readable lives below `muted`. */
export const text = {
  primary: "var(--tv-text-primary)",
  secondary: "var(--tv-text-secondary)",
  muted: "var(--tv-text-muted)",
} as const;

/** Borders — three weights, no more. */
export const border = {
  hairline: "var(--tv-border)",
  strong: "var(--tv-border-strong)",
  accent: "var(--tv-border-accent)",
} as const;

/** Elevation — shadows lift a surface; glow is reserved for the accent. */
export const elevation = {
  low: "var(--tv-elev-1)",
  medium: "var(--tv-elev-2)",
  high: "var(--tv-elev-3)",
  glow: "var(--tv-glow-accent)",
} as const;

/**
 * Durations — four steps, and every transition in the product picks one.
 * 1 = pointer feedback · 2 = state/page change · 3 = entrance · 4 = deliberate.
 */
export const duration = {
  feedback: "var(--tv-dur-1)",
  transition: "var(--tv-dur-2)",
  entrance: "var(--tv-dur-3)",
  deliberate: "var(--tv-dur-4)",
} as const;

/** Stacking order — declared once so no component guesses a z-index. */
export const zIndex = {
  rail: 30,
  float: 40,
  nav: 50,
  modal: 70,
  toast: 80,
  palette: 90,
} as const;

/** Signature interaction/animation classes from `styles.css`. */
export const behavior = {
  /** Shared hover/press/focus contract for anything clickable. */
  interactive: "tv-interactive",
  /** Page-change reveal (applied by `PageTransition`). */
  pageIn: "page-in",
  /** A value that just changed. */
  tick: "tv-tick",
  /** A completed action acknowledged. */
  confirm: "tv-confirm",
  /** Numbers that carry meaning. */
  numeric: "tv-num",
} as const;

/** The full token set, for ergonomic single-import access. */
export const tokens = {
  font,
  color,
  accentVar,
  surface,
  radius,
  motion,
  density,
  type,
  level,
  text,
  border,
  elevation,
  duration,
  zIndex,
  behavior,
} as const;
