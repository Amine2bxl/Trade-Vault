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

// La ligne « minimum » : le solde de départ, en tirets saumon. C'est la
// référence contre laquelle toute la courbe se lit — au-dessus on gagne, en
// dessous on perd — et le pointillé dit qu'il s'agit d'un repère, pas d'une
// mesure.
export const EQUITY_FLOOR = {
  stroke: "#f87171",
  strokeWidth: 2,
  strokeDasharray: "7 7",
} as const;

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
