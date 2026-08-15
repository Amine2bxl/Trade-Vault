/**
 * Design tokens — the TradeVault visual identity, centralized.
 *
 * These tokens codify the **app design system** per `DESIGN_SYSTEM.md`: Inter
 * type, blue accent (#4D8DFF), dark default, no shadows, dense data, and the
 * shared motion language. This file is the single typed reference every
 * primitive and future screen builds on.
 *
 * IMPORTANT: this does not restyle anything. The visual source of truth is the
 * CSS in `src/styles.css` (custom properties + utility classes); these tokens
 * *point at* that CSS (class names + CSS variables) so code stays in sync with
 * the rendered theme instead of hardcoding divergent values.
 */

/** Typography — Inter only inside the app. */
export const font = {
  /** Inter body stack (applied to `body` in styles.css). */
  body: '"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
  /** Display stack — same as body; landing keeps Sora in landing.css. */
  display: '"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
  /** Utility class for display/headings. */
  displayClass: "font-semibold",
  /** Tabular figures for prices / R / stats. */
  tabularClass: "tabular-nums",
} as const;

/**
 * Color — semantic roles as Tailwind color *stems* (compose with a utility
 * prefix, e.g. `text-${color.profit}`, `bg-${color.brand}/15`). Brand accents
 * are runtime-themeable via the `--accent*` variables.
 */
export const color = {
  brand: "cyan", // primary accent ramp (regenerated as blue #4D8DFF)
  brandAlt: "teal", // deprecated, mapped to the same blue ramp
  profit: "emerald-500",
  loss: "red-500",
  warning: "amber-500",
} as const;

/** Brand accent CSS variables (themeable at runtime by the ThemeProvider). */
export const accentVar = {
  accent: "var(--accent)",
  accentHover: "var(--accent-hover)",
  accentSubtle: "var(--accent-subtle)",
} as const;

/** Surfaces — the institutional grey-blue system shared by the app. */
export const surface = {
  /** Base page background. */
  base: "var(--bg-base)",
  /** Translucent glass panel. */
  glassClass: "glass",
  /** Opaque glass (modals, menus). */
  glassStrongClass: "glass-strong",
  /** Hover-lift premium card. */
  cardPremiumClass: "card-premium",
  /** Solid panel for dense dashboards. */
  panelClass: "bg-surface border rounded-md",
  /** Subtle inset surface for nested sections. */
  insetClass: "bg-raised border rounded-md",
} as const;

/** Radius scale (Tailwind `rounded-*`). Cards and panels use md (6px). */
export const radius = ["sm", "md", "lg", "xl"] as const;

/**
 * Motion — the shared animation language. All signature transitions use the
 * same standard ease, so new components feel like one motion system. 300ms hard
 * cap per MOTION_AND_PERF.md.
 */
export const motion = {
  easing: "cubic-bezier(0.4, 0, 0.2, 1)",
  easeOut: "cubic-bezier(0, 0, 0.2, 1)",
  fadeInUp: "animate-fade-in-up",
  fadeIn: "animate-fade-in",
  slideIn: "animate-slide-in",
  slideUp: "animate-slide-up",
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
  /** Page gutters — mobile stays a touch tighter so more fits on screen. */
  pagePad: "p-4 md:p-7",
  /** Vertical rhythm between page sections. */
  sectionGap: "mb-4 md:mb-5",
  /** Grid gap between sibling cards. */
  gridGap: "gap-3 md:gap-4",
} as const;

/**
 * Typography roles — named steps replacing ad hoc pixel classes.
 *
 * Real floor: 10px (`micro`), nothing below in the product UI.
 */
export const type = {
  /** Page title. */
  h1: "text-[26px] md:text-[32px] font-semibold tracking-[-0.02em]",
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
