// Shared Recharts theming so every chart across the app (Dashboard, Analytics,
// Mistakes, Calendar) animates and looks the same — one place to tune "premium feel".

// Same signature ease-out-with-a-touch-of-overshoot curve used by .card-premium /
// .animate-fade-in-up in styles.css, so chart reveals feel like one motion language
// with the rest of the UI instead of recharts' default linear-ish easing.
const ORGANIC_EASING = 'cubic-bezier(0.16,1,0.3,1)';

export const CHART_ANIMATION = {
  // Slightly longer than the CSS draw-reveal (1.35s) so recharts' own line growth
  // settles just as the wipe completes — one continuous, natural motion.
  animationDuration: 1300,
  // react-smooth (recharts' animation engine) accepts any cubic-bezier string at
  // runtime; its TS union only lists the 5 named presets, so we cast past that.
  animationEasing: ORGANIC_EASING as unknown as 'ease-out',
};

// Dedicated, more cinematic reveal for the equity curves — a longer draw with a
// gentle late settle, kicked off after a short beat so the wipe reads as a
// deliberate "drawing" motion rather than an instant pop.
export const EQUITY_ANIMATION = {
  animationDuration: 1700,
  animationBegin: 90,
  animationEasing: 'cubic-bezier(0.22,1,0.36,1)' as unknown as 'ease-out',
};

// Shared equity-line look so Dashboard + Analytics curves match: a rounded,
// dynamic stroke with a soft accent drop-shadow for a professional, alive feel.
export const EQUITY_LINE = {
  strokeWidth: 3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

// Hover cursor shared by every chart. TradingView-style: a single hairline-thin,
// solid guide in the active theme accent — deliberately faint so the glowing
// marker dot (glowActiveDot) is the star of the hover, not a loud dashed line.
// The soft glow is applied in CSS via `.recharts-tooltip-cursor`, so it always
// tracks the current theme.
export const crosshairCursor = {
  stroke: 'var(--tv-accent)',
  strokeWidth: 1,
  strokeOpacity: 0.28,
  fill: 'transparent',
};

export const tooltipStyle = {
  contentStyle: {
    background: 'rgba(17,24,39,0.96)',
    border: '1px solid rgb(var(--tv-accent-rgb) / 0.18)',
    borderRadius: '12px',
    fontSize: 11,
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
    padding: '8px 12px',
  },
  labelStyle: { color: '#94a3b8', marginBottom: 2 },
  itemStyle: { color: '#e2e8f0' },
  cursor: crosshairCursor,
};

export function glowDot(color: string) {
  return { r: 4, strokeWidth: 2, stroke: '#0a0f1e', fill: color };
}

// Premium hover marker — a small, precise circle with a soft two-stop glow in
// the series color. Small radius + a thin dark ring keep it discreet and crisp
// against the line; the layered drop-shadows give the light TradingView-like
// halo without a heavy dashed crosshair.
export function glowActiveDot(color: string) {
  return {
    r: 4,
    strokeWidth: 1.5,
    stroke: '#0a0f1e',
    fill: color,
    style: { filter: `drop-shadow(0 0 3px ${color}) drop-shadow(0 0 7px rgba(255,255,255,0.12))` },
  };
}

// Pads the Y domain so the curve's peaks/troughs never touch the chart edges —
// without this, recharts fits the axis exactly to data min/max and the line
// looks visually "cut off" at the top/bottom of the plot area.
export function equityYDomain([dataMin, dataMax]: [number, number]): [number, number] {
  const pad = Math.max((dataMax - dataMin) * 0.15, 20);
  return [Math.floor(dataMin - pad), Math.ceil(dataMax + pad)];
}

export const EQUITY_X_PADDING = { left: 16, right: 16 };
