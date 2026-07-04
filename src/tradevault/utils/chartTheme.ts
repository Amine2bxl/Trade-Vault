// Shared Recharts theming so every chart across the app (Dashboard, Analytics,
// Mistakes, Calendar) animates and looks the same — one place to tune "premium feel".

// Same signature ease-out-with-a-touch-of-overshoot curve used by .card-premium /
// .animate-fade-in-up in styles.css, so chart reveals feel like one motion language
// with the rest of the UI instead of recharts' default linear-ish easing.
const ORGANIC_EASING = 'cubic-bezier(0.16,1,0.3,1)';

export const CHART_ANIMATION = {
  animationDuration: 1100,
  // react-smooth (recharts' animation engine) accepts any cubic-bezier string at
  // runtime; its TS union only lists the 5 named presets, so we cast past that.
  animationEasing: ORGANIC_EASING as unknown as 'ease-out',
};

export const tooltipStyle = {
  contentStyle: {
    background: 'rgba(17,24,39,0.96)',
    border: '1px solid rgba(59,130,246,0.18)',
    borderRadius: '12px',
    fontSize: 11,
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
    padding: '8px 12px',
  },
  labelStyle: { color: '#94a3b8', marginBottom: 2 },
  itemStyle: { color: '#e2e8f0' },
  cursor: { fill: 'rgba(148,163,184,0.06)' },
};

export function glowDot(color: string) {
  return { r: 4, strokeWidth: 2, stroke: '#0a0f1e', fill: color };
}

export function glowActiveDot(color: string) {
  return { r: 6, strokeWidth: 2, stroke: '#0a0f1e', fill: color, style: { filter: `drop-shadow(0 0 6px ${color})` } };
}
