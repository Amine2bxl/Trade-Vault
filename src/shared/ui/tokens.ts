/**
 * Design tokens — the TradeVault visual identity, centralized.
 *
 * Ils codifient l'identité « Vault » : Inter pour la parole, chasse fixe pour
 * le chiffre, un accent vert unique et rare, des plaques opaques sur un noir
 * neutre, une seule échelle de mouvement. C'est la référence typée et
 * documentée sur laquelle chaque primitive et chaque nouvel écran s'appuient.
 *
 * Les trois règles que ce fichier fait tenir :
 *   1. La couleur est RARE — elle marque l'état actif, l'action principale et
 *      le signe du P&L. Une surface qui n'est ni l'un ni l'autre est grise.
 *   2. La profondeur vient de la VALEUR, pas de la lumière — une plaque plus
 *      claire est devant. Rien ne rayonne, rien ne flotte sans raison.
 *   3. Le chiffre a sa propre voix — chasse fixe, tabulaire, et seulement
 *      pour les montants de tête.
 *
 * IMPORTANT: this does not restyle anything. The visual source of truth is the
 * CSS in `src/styles.css` (custom properties + utility classes); these tokens
 * *point at* that CSS (class names + CSS variables) so code stays in sync with
 * the rendered theme instead of hardcoding divergent values.
 */

/** Typography — one identity across marketing site and product.
 *  Inter porte body ET display (la grotesque de référence côté 21st.dev /
 *  Linktree, le raffinement de Roboto côté Google/YouTube) : la hiérarchie
 *  vient de la graisse, de la taille et de l'approche, jamais d'un changement
 *  de police. */
export const font = {
  /** Inter body stack (applied to `body` in styles.css). */
  body: '"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
  /** Inter display stack — use via the `font-display` utility class. */
  display: '"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
  /** Roboto Mono stack for the rare technical spots (codes, session times). */
  mono: '"Roboto Mono",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace',
  /** Utility class for display emphasis (headings + hero metrics). */
  displayClass: "font-display",
  /** Tabular figures for prices / R / stats. */
  tabularClass: "tabular-nums",
} as const;

/**
 * Color — semantic roles as Tailwind color *stems* (compose with a utility
 * prefix, e.g. `text-${color.profit}`, `bg-${color.brand}/15`). Brand accents
 * are runtime-themeable via the `--tv-*` variables (défaut = émeraude « Vault »).
 */
export const color = {
  // Les noms de rampe restent `cyan`/`teal` — ce sont les utilitaires Tailwind
  // que ~700 appels portent déjà — mais leurs valeurs sont RÉGÉNÉRÉES depuis
  // l'accent du thème (émeraude par défaut). Écrire `text-cyan-400` revient
  // donc à écrire « la couleur d'accent, cran 400 ».
  brand: "cyan", // primary accent ramp (regenerated from --tv-primary-*)
  brandAlt: "teal", // secondary accent ramp (--tv-secondary-*)
  profit: "emerald-500",
  loss: "red-500",
  warning: "amber-500",
} as const;

/** Brand accent CSS variables (themeable at runtime by the ThemeProvider). */
export const accentVar = {
  accent: "var(--tv-accent)", // #10b981 par défaut
  accentAlt: "var(--tv-accent-2)", // #059669 par défaut
  highlight: "var(--tv-highlight)", // #34d399 par défaut
} as const;

/** Surfaces — les plaques opaques partagées par la landing et le produit. */
export const surface = {
  /** Base page background (html) — noir neutre, un seul à-plat. */
  base: "#07090a",
  /** La plaque standard. Le nom « glass » survit aux ~200 appels existants ;
   *  la matière, elle, est opaque depuis la refonte. */
  glassClass: "glass",
  /** Plaque des surfaces qui flottent réellement (modales, menus). */
  glassStrongClass: "glass-strong",
  /** Carte qui répond au survol (éclaircissement, jamais de soulèvement). */
  cardPremiumClass: "card-premium",
  /** Alias historique — rend exactement la même plaque que `glass`. */
  panelClass: "panel rounded-2xl",
  /** Surface creuse pour une section imbriquée. */
  insetClass: "bg-white/[0.025] border border-white/[0.06] rounded-xl",
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
  /** Neutralisée par la refonte — ne peint plus rien. Conservée le temps que
   *  les derniers appels disparaissent ; ne pas en ajouter. */
  glow: "animate-glow",
} as const;

/**
 * Densité — le contrat d'espacement du produit.
 *
 * L'échelle précédente était celle d'un terminal : 14px de padding de carte,
 * 12px de gouttière. Sur des cartes désormais arrondies à 18-24px, ce serrage
 * donnait des angles qui mordaient sur le contenu — un rayon large a besoin
 * d'air pour se lire comme une forme, sinon il se lit comme un défaut. Chaque
 * cran monte donc d'une marche.
 *
 * Ce sont les SEULS paliers qu'un écran a le droit d'utiliser ; `Card`,
 * `PageContainer` et `PageHeader` les consomment, donc la densité du produit
 * entier se règle ici et nulle part ailleurs.
 */
export const density = {
  /** Card/panel inner padding. */
  cardPad: "p-4 md:p-5",
  /** Tighter variant for list rows and compact tiles. */
  cardPadTight: "p-3.5",
  /** Roomier variant, reserved for hero/feature surfaces. */
  cardPadLoose: "p-6 md:p-7",
  /** Page gutters — mobile reste un cran plus serré, l'écran est étroit. */
  pagePad: "p-4 md:p-6",
  /** Vertical rhythm between page sections. */
  sectionGap: "mb-5 md:mb-6",
  /** Grid gap between sibling cards. */
  gridGap: "gap-4 md:gap-5",
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
  /** Hero / display — titres d'en-tête à très forte présence. */
  display: "font-display text-[30px] md:text-[34px] font-bold tracking-[-0.025em]",
  /** Page title — calm, not massive. */
  h1: "text-[26px] md:text-[30px] font-bold tracking-[-0.02em]",
  /** Titre de section — même rôle que le titre de carte. Le produit n'a plus
   *  qu'UN titre : la calculatrice n'en tient qu'un, à 14px, et ça suffit. */
  h2: "tv-title",
  /** Titre de carte. */
  h3: "tv-title",
  /** Prose : explication, état vide, phrase d'aide. 12px, interligne ouvert. */
  body: "tv-prose",
  /** Mention secondaire. */
  caption: "tv-prose",
  /** Mention fine, sourde par définition (sous un titre, sous un champ). */
  hint: "tv-hint",
  /** Libellé de ligne, en face d'un chiffre. */
  rowLabel: "tv-row-label",
  /** Le libellé LARGE — la légende sous un chiffre héros. */
  labelWide: "tv-label-wide",
  /** Libellé de case — petites capitales espacées. C'est LE rôle d'étiquetage
   *  du produit : il nomme une case, il ne la décrit pas. Toute étiquette de
   *  KPI, de colonne ou de champ le porte. Les valeurs viennent de la page
   *  Calculatrice de lot, référence typographique du produit. La couleur reste
   *  au point d'appel (un libellé peut porter un état). */
  label: "tv-label",
  /** Chrome dense : badges, unités, méta de cellule. Le plancher — rien en dessous. */
  micro: "text-[10px]",
  /** LE CHIFFRE — chasse fixe, tabulaire. Réservé aux montants de tête
   *  (P&L, solde, drawdown, cible) : c'est la signature typographique de la
   *  refonte, et elle ne vaut que si elle reste rare. Les nombres au fil du
   *  texte et dans les tableaux denses gardent Inter + `tabular-nums`. */
  fin: "tv-figure text-base tracking-[-0.03em]",
  /** Le même chiffre, taille de tuile KPI. */
  figure: "tv-figure text-xl md:text-[26px] leading-none",
  /** Le même chiffre, taille héros (P&L du mois, solde du compte). */
  figureLg: "tv-figure text-[30px] md:text-[38px] leading-none",
  /** Navigation (rail, onglets). */
  nav: "text-[13px] font-medium tracking-[-0.01em]",
  /** Boutons. */
  button: "text-sm font-semibold",
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

/** Élévation — et le premier cran est `none` : sur un fond quasi noir, une
 *  ombre portée assombrit du noir. Ce qui sépare deux plans, c'est la valeur
 *  de la plaque et son liseré. Les ombres ne restent que sous ce qui flotte
 *  vraiment (modales, menus, docks). `glow` ne vaut plus rien : l'accent est
 *  une couleur, pas une source de lumière. */
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
  /** Un chiffre de tête (chasse fixe, tabulaire). */
  figure: "tv-figure",
  /** Un libellé de case (petites capitales espacées). */
  label: "tv-label",
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
