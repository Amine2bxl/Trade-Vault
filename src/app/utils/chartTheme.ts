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

// Shared equity-line look so Dashboard + Analytics curves match: a precise
// 2px stroke, no glow, no drop-shadow. Legibility of the path IS the styling.
export const EQUITY_LINE = {
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

// `monotone` never overshoots between points, so the curve stays faithful to
// the equity it plots — `natural` (a cubic spline) invents wobbles and bumps
// that do not exist in the data, which is exactly what made the old curve look
// decorative rather than professional.
export const EQUITY_CURVE_TYPE = "monotone" as const;

// Horizontal-only grid, whisper-faint. Gives the eye a baseline to read levels
// against without drawing attention to itself.
export const EQUITY_GRID = {
  stroke: "rgba(148,163,184,0.08)",
  strokeDasharray: "0",
  vertical: false,
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

// Pads the Y domain so the curve's peaks/troughs never touch the chart edges.
// The domain is SYMMETRIC around zero (the break-even line): a +$2k gain and a
// -$460 loss must be drawn at their true relative amplitude, not both stretched
// to the chart edges. Max absolute value sets the half-height, so a profitable
// curve never quietly inflates a small loss into a big one.
export function equityYDomain([dataMin, dataMax]: [number, number]): [number, number] {
  const m = Math.max(Math.abs(dataMin), Math.abs(dataMax), 0);
  const pad = m * 0.12 + 20;
  const top = Math.ceil(m + pad);
  return [-top, top];
}

export const EQUITY_X_PADDING = { left: 16, right: 16 };
