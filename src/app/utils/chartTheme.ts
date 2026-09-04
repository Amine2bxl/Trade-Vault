// Shared Recharts theming so every chart across the app (Dashboard, Analytics,
// Mistakes, Calendar) animates and looks the same — one place to tune "premium feel".

// Same signature ease-out-with-a-touch-of-overshoot curve used by .card-premium /
// .animate-fade-in-up in styles.css, so chart reveals feel like one motion language
// with the rest of the UI instead of recharts' default linear-ish easing.
const ORGANIC_EASING = "cubic-bezier(0.16,1,0.3,1)";

export const CHART_ANIMATION = {
  // Slightly longer than the CSS draw-reveal (1.35s) so recharts' own line growth
  // settles just as the wipe completes — one continuous, natural motion.
  animationDuration: 1300,
  // react-smooth (recharts' animation engine) accepts any cubic-bezier string at
  // runtime; its TS union only lists the 5 named presets, so we cast past that.
  animationEasing: ORGANIC_EASING as unknown as "ease-out",
};

// Equity-curve reveal. Deliberately restrained: a single, quick, decelerating
// draw. Institutional charting tools (Topstep, Lucid) animate once and get out
// of the way — a long cinematic wipe reads as a marketing effect, not a tool.
export const EQUITY_ANIMATION = {
  animationDuration: 900,
  animationBegin: 40,
  animationEasing: "cubic-bezier(0.33,1,0.68,1)" as unknown as "ease-out",
};

// Le trait d'equity, partagé par le tableau de bord et Analytics : épais,
// bouts ronds, aucun halo. Il passe de 2 à 3px — sur une courbe très lissée,
// un trait fin se lit comme un fil de fer ; c'est l'épaisseur qui donne la
// sensation de fluide.
export const EQUITY_LINE = {
  strokeWidth: 3,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/**
 * LE TRAIT SECONDAIRE — la petite sœur d'`EQUITY_LINE`.
 *
 * Une série de tendance posée SUR un histogramme (taux de réussite, R:R moyen)
 * ne peut pas prendre les 3px de la courbe d'equity : elle écraserait les
 * barres qu'elle commente. Elle en garde en revanche les deux traits de
 * caractère — les bouts ronds, et surtout AUCUNE PASTILLE AU REPOS. Les points
 * semés le long du tracé le hachaient en une suite d'évènements ; le point
 * n'existe qu'au survol, là où il sert à lire une valeur.
 */
export const TREND_LINE = {
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

// `natural` — une spline cubique, la courbe RONDE et fluide des tableaux de
// bord de prop firm.
//
// À dire clairement, parce que c'est un arbitrage et pas un détail : une
// spline cubique passe par tous les points mais peut DÉPASSER entre deux —
// un sommet peut apparaître légèrement plus haut que la valeur réelle. C'est
// le prix de la rondeur, et c'est celui que paie la référence.
//
// Ce qui rend le compromis acceptable ici : la courbe d'equity sert à lire une
// FORME (est-ce que ça monte, où était le creux), pas à relever une valeur au
// pixel. La valeur exacte, elle, se lit à l'infobulle, qui affiche la donnée
// brute et n'est pas interpolée.
export const EQUITY_CURVE_TYPE = "natural" as const;

// Horizontal-only grid, whisper-faint. Gives the eye a baseline to read levels
// against without drawing attention to itself.
export const EQUITY_GRID = {
  stroke: "rgba(148,163,184,0.08)",
  strokeDasharray: "0",
  vertical: false,
} as const;

// LE ZÉRO, en tirets rouges.
//
// La courbe d'equity trace un CUMUL de P&L qui part de zéro (voir
// `tradeCalcs`) : le repère est donc le zéro lui-même, pas la valeur du
// premier jour. Au-dessus on est en profit, en dessous en perte — et c'est
// tout ce que la ligne dit. Le pointillé dit « repère », pas « mesure ».
//
// Elle peut être rouge sans ambiguïté parce que la COURBE, elle, est toujours
// verte (voir `EquityChart`) : les deux pastilles de la légende ne peuvent
// plus se confondre comme lorsque la courbe virait au rouge en perte.
export const EQUITY_FLOOR = {
  stroke: "var(--tv-chart-red)",
  strokeWidth: 2,
  strokeDasharray: "7 7",
} as const;

/**
 * LE VERT DE LA DONNÉE — fixe sur tous les thèmes.
 *
 * L'accent habille l'interface et change avec le thème ; la donnée non. Une
 * courbe d'equity qui monte est verte, sur Amber comme sur Steel. Si elle
 * suivait l'accent, le trader lirait une couleur qui ne veut plus rien dire.
 *
 * Toute série qui porte un GAIN utilise ceci, jamais `--tv-accent`.
 */
export const CHART_GREEN = "var(--tv-chart-green)";
export const CHART_RED = "var(--tv-chart-red)";

/**
 * Le dégradé sous une courbe — les trois paliers de la courbe d'equity, qui
 * est la référence visuelle du produit. 30 % au contact du trait, 10 % à
 * mi-hauteur, zéro en bas : la masse pèse assez pour que la montée se lise de
 * loin, et s'efface assez pour ne pas devenir un bloc.
 *
 * `id` doit être unique par graphe rendu — deux `<defs>` portant le même id
 * dans un même document, et le second est ignoré.
 */
export function areaGradientStops(color: string) {
  return [
    { offset: "0%", opacity: 0.3 },
    { offset: "55%", opacity: 0.1 },
    { offset: "100%", opacity: 0 },
  ].map((s) => ({ ...s, color }));
}

/**
 * LA COULEUR D'UNE SÉRIE DE TENDANCE.
 *
 * Un taux de réussite tracé sur un histogramme de P&L ne peut pas être vert :
 * dans ce produit le vert VEUT DIRE gain, et une ligne verte posée sur des
 * barres vertes et rouges se lit comme un troisième P&L. La tendance est du
 * contexte, pas de la donnée monétaire — elle prend donc le gris du texte
 * secondaire, le même que les graduations, et laisse la couleur aux barres.
 */
export const TREND_STROKE = "var(--tv-text-secondary)";

/**
 * LES DÉGRADÉS DE BARRE — le principe de la courbe d'equity, appliqué aux
 * histogrammes.
 *
 * Sous la courbe, la masse est dense au contact du trait et s'efface vers le
 * bas. Une barre fait la même chose : pleine à son extrémité, effacée vers la
 * ligne du zéro. Un aplat à 55 % d'opacité, lui, donnait un vert olive qui
 * n'appartenait à aucune autre pièce de l'interface.
 *
 * Les dégradés SVG sont en coordonnées relatives à la boîte de chaque
 * rectangle : chaque barre reçoit donc son propre dégradé, quelle que soit sa
 * hauteur. Les identifiants sont volontairement globaux et stables — ils sont
 * déclarés une fois dans la coque (`ChartDefs`) et servent tous les graphes.
 *
 * LE SECOND TERME EST UN REPLI, et il n'est pas décoratif. La syntaxe de
 * peinture SVG accepte `<url> <couleur>` : si la référence ne résout pas, le
 * navigateur peint la couleur. Sans lui, un graphe rendu hors de la coque
 * (une route qui ne monte pas `ChartDefs`, un aperçu isolé) ne dessine
 * simplement AUCUNE barre — vérifié : le rectangle n'est pas peint du tout,
 * il n'y a pas de couleur par défaut. Le repli transforme une panne muette en
 * simple perte du dégradé.
 */
export const BAR_FILL_GREEN = "url(#tvBarGreen) var(--tv-chart-green)";
export const BAR_FILL_RED = "url(#tvBarRed) var(--tv-chart-red)";

/**
 * UNE ÉCHELLE MONÉTAIRE À PALIERS RONDS, prête à poser sur un `<YAxis>`.
 *
 * C'est `niceEquityScale` — l'échelle de la courbe d'equity — offerte aux
 * histogrammes, avec le formatage et le dépouillement (pas d'axe, pas de
 * tirets) qui vont avec. Sans elle, recharts découpe l'intervalle des données
 * en parts égales et affiche « $1700 / $850 / $-850 » : des montants exacts
 * que personne ne peut situer.
 */
export function moneyAxisProps(values: number[]) {
  const { domain, ticks } = niceEquityScale(values, 5);
  const widest = ticks.reduce((m, t) => Math.max(m, Math.abs(t)), 0);
  return {
    domain,
    ticks,
    tick: AXIS_TICK,
    tickFormatter: (v: number) => formatAxisMoney(v),
    axisLine: false as const,
    tickLine: false as const,
    // La largeur suit la longueur du plus grand montant : une largeur fixe
    // rogne « $12.5k » ou laisse un trou devant « $80 ».
    width: 26 + formatAxisMoney(widest).length * 7,
  };
}

/**
 * LE RAYON DES BARRES — une seule valeur pour tout le produit.
 *
 * On trouvait 3, 4 et 6 selon la page : trois grammaires de coin dans un même
 * produit, qu'on ne remarque pas isolément mais qui empêchent l'ensemble de se
 * lire comme une seule main. 6px est la valeur de la langue « bubble » du
 * reste de l'interface (l'échelle `--radius-*` démarre à 8 sur les surfaces).
 *
 * Deux formes seulement : la barre VERTICALE s'arrondit en haut, l'HORIZONTALE
 * à droite — du côté où elle finit, jamais du côté de l'axe.
 */
export const BAR_RADIUS: [number, number, number, number] = [6, 6, 0, 0];
export const BAR_RADIUS_H: [number, number, number, number] = [0, 6, 6, 0];

// Axis ticks — one muted slate, one size, everywhere. `--tv-text-muted` is the
// same token the rest of the UI uses for de-emphasised text, so an axis label
// and a caption are the same grey by construction rather than by coincidence.
export const AXIS_TICK = { fill: "var(--tv-text-muted)", fontSize: 11 } as const;

// Compact money labels ($1.2k) so the Y axis stays narrow and readable at any
// account size instead of wrapping five-digit numbers.
export function formatAxisMoney(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1000) {
    const k = abs / 1000;
    return `${sign}$${k >= 10 ? Math.round(k) : k.toFixed(1)}k`;
  }
  return `${sign}$${Math.round(abs)}`;
}

// Hover cursor shared by every chart: a neutral hairline guide, no accent tint
// and no glow. It marks the hovered point and nothing more.
export const crosshairCursor = {
  stroke: "#94a3b8",
  strokeWidth: 1,
  strokeOpacity: 0.22,
  fill: "transparent",
};

// Tooltip — a plain, dense data card. Neutral border, real shadow, no accent
// halo: the numbers should be the only thing that stands out.
export const tooltipStyle = {
  contentStyle: {
    // Design-system surface, not a one-off colour: the tooltip is the densest
    // data card in the product, so it must be built from the same border,
    // elevation and text tokens as every other card. Hardcoding its navy meant
    // a theme could retint the whole app and leave every tooltip behind.
    background: "var(--tv-bg)",
    border: "1px solid var(--tv-border-strong)",
    borderRadius: "10px",
    fontSize: 11,
    boxShadow: "var(--tv-elev-2)",
    padding: "8px 11px",
  },
  labelStyle: { color: "var(--tv-text-secondary)", marginBottom: 3, fontSize: 10 },
  itemStyle: { color: "var(--tv-text-primary)", fontWeight: 600 },
  cursor: crosshairCursor,
};

export function glowDot(color: string) {
  return { r: 4, strokeWidth: 2, stroke: "var(--tv-bg)", fill: color };
}

// Hover marker — a small filled dot with a dark ring so it reads crisply on top
// of the line. No drop-shadow halo: the glow was the single loudest "cheap neon"
// signal on the equity curve.
export function glowActiveDot(color: string) {
  return {
    r: 3.5,
    strokeWidth: 2,
    // The ring is a hole punched in the curve, so it must BE the page colour.
    stroke: "var(--tv-bg)",
    fill: color,
  };
}

// Pads the Y domain so the curve's peaks/troughs never touch the chart edges —
// without this, recharts fits the axis exactly to data min/max and the line
// looks visually "cut off" at the top/bottom of the plot area.
export function equityYDomain([dataMin, dataMax]: [number, number]): [number, number] {
  const pad = Math.max((dataMax - dataMin) * 0.12, 20);
  return [Math.floor(dataMin - pad), Math.ceil(dataMax + pad)];
}

/**
 * Une échelle d'ordonnée à PALIERS RONDS.
 *
 * `equityYDomain` bornait l'axe sur les données plus une marge, et recharts
 * découpait cet intervalle en parts égales : on lisait « $58,877 », « $54,159 »,
 * « $51,659 ». Des montants exacts, mais qui ne veulent rien dire — personne ne
 * situe un solde par rapport à 51 659. La référence affiche $58,000, $56,000,
 * $54,000 : des paliers qu'on peut tenir en tête.
 *
 * La méthode est celle des axes de tout outil de graphe : on cherche un pas
 * « rond » (1, 2, 2.5 ou 5 fois une puissance de dix) qui donne à peu près le
 * nombre de graduations voulu, puis on élargit le domaine aux multiples de ce
 * pas. L'axe déborde donc légèrement des données — c'est le but : la courbe ne
 * touche jamais le haut ni le bas du cadre.
 */
export function niceEquityScale(
  values: number[],
  targetTicks = 5,
): { domain: [number, number]; ticks: number[] } {
  if (values.length === 0) return { domain: [0, 1], ticks: [0, 1] };
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi === lo) {
    // Un compte parfaitement plat : on ouvre une fenêtre autour de la valeur,
    // sinon l'axe n'a aucune hauteur et la courbe se colle au bord.
    const span = Math.max(Math.abs(hi) * 0.02, 10);
    lo -= span;
    hi += span;
  } else {
    const pad = (hi - lo) * 0.12;
    lo -= pad;
    hi += pad;
  }
  const raw = (hi - lo) / Math.max(1, targetTicks - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  // La tolérance absorbe l'erreur du flottant : sans elle, un pas de 0.1
  // laisse tomber la dernière graduation une fois sur deux.
  for (let v = start; v <= end + step * 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { domain: [start, end], ticks };
}

/**
 * La date en abscisse : « 2 août », pas « 02/08/26 ».
 *
 * Un axe se survole, il ne se déchiffre pas. Le jour et le mois abrégé se
 * lisent d'un coup d'œil là où une date à trois nombres demande de décoder
 * quel champ est lequel — et l'ordre de ces champs change avec la langue.
 * `toLocaleDateString` s'en charge selon la langue du navigateur.
 */
export function formatAxisDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export const EQUITY_X_PADDING = { left: 16, right: 16 };
