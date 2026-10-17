import { forwardRef } from "react";
import { createLucideIcon, type IconNode, type LucideIcon, type LucideProps } from "lucide-react";

/** Catalogue TradeVault : glyphes de marché, de carnet et de trajectoire,
 * sur une grille 24 px, trait 1,6 et couleur héritée. Les pictogrammes
 * utilitaires rares restent compatibles avec les noms Lucide existants. */
// eslint-disable-next-line react-refresh/only-export-components -- Réexport de compatibilité du catalogue d’icônes.
export * from "lucide-react";
const path = (d: string): IconNode => [["path", { d, key: "p" }]];
function glyph(name: string, d: string): LucideIcon {
  const Drawing = createLucideIcon(`Vault${name}`, path(d));
  const Icon = forwardRef<SVGSVGElement, LucideProps>(({ strokeWidth = 1.6, ...props }, ref) => (
    <Drawing ref={ref} strokeWidth={strokeWidth} {...props} />
  ));
  Icon.displayName = `Vault${name}`;
  return Icon;
}
export const LayoutDashboard = /* @__PURE__ */ glyph(
  "Dashboard",
  "M4 3.5h16a.5.5 0 0 1 .5.5v16a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5ZM3.5 9h17M10 9v11.5M6 6.3h.01M9 6.3h.01M13 16l2-3 2 1 2-3",
);
export const BarChart3 = /* @__PURE__ */ glyph(
  "Analytics",
  "M3.5 5v15.5H21M7 17v-4M11 17V9M15 17V6M19 17v-7M6 7l5-4 4 1 5-2",
);
export const LineChart = /* @__PURE__ */ glyph("Equity", "M3 4v16h18M6 15l4-5 4 2 6-7M17 5h3v3");
export const BookOpen = /* @__PURE__ */ glyph(
  "Journal",
  "M7 3.5h13v17H7a3 3 0 0 1-3-3v-11a3 3 0 0 1 3-3ZM7 3.5v17M10 7h7M10 11h3M16 10v4M14.5 12h3M10 16h7",
);
export const CalendarDays = /* @__PURE__ */ glyph(
  "Calendar",
  "M4 5.5h16v15H4v-15ZM8 3v5M16 3v5M4 10h16M8 13h1M12 13h1M16 13h1M8 17h1M12 17h1",
);
export const Calendar = CalendarDays;
export const CalendarRange = /* @__PURE__ */ glyph(
  "Seasonality",
  "M4 5h16v15H4V5ZM8 3v4M16 3v4M4 10h16M7 17c2-6 4-6 5-2s3 4 5-2",
);
export const ClipboardCheck = /* @__PURE__ */ glyph(
  "Checklist",
  "M9 4H5v17h14V4h-4M9 2.5h6v4H9v-4ZM8 11l1.5 1.5L12 10M14 12h2M8 16l1.5 1.5L12 15M14 17h2",
);
export const Calculator = /* @__PURE__ */ glyph(
  "PositionSize",
  "M4 4h16v16H4V4ZM4 10h16M10 10v10M7 6v2M6 7h2M13 7h4M6 15h2M13 14l4 4M17 14l-4 4",
);
export const Newspaper = /* @__PURE__ */ glyph(
  "News",
  "M3.5 5h17v14h-17V5ZM7 8h5v4H7V8ZM15 8h2M15 11h2M7 15h10M9 2v3M15 19v3",
);
export const AlertTriangle = /* @__PURE__ */ glyph(
  "ExecutionError",
  "M4 19h16L12 4 4 19ZM12 9v4M12 16h.01M3 6h4M17 6h4",
);
export const TriangleAlert = AlertTriangle;
export const Crosshair = /* @__PURE__ */ glyph(
  "MissedSetup",
  "M7 3H3v4M17 3h4v4M21 17v4h-4M7 21H3v-4M12 6v12M8 9h8v6H8V9M6 12h2M16 12h2",
);
export const Target = /* @__PURE__ */ glyph(
  "Goal",
  "M4 4h12v12H4V4ZM8 8h4v4H8V8ZM14 10l7-7M17 3h4v4M8 20h12v-8",
);
export const Map = /* @__PURE__ */ glyph(
  "TradingPlan",
  "M4 4h5v5H4V4ZM15 15h5v5h-5v-5ZM9 6.5h8.5V12M6.5 9v8.5H15M15 10l2.5 2.5L20 10",
);
export const Bot = /* @__PURE__ */ glyph(
  "Coach",
  "M12 2.5l4.5 4.5-4.5 4.5L7.5 7 12 2.5ZM5 12.5l4.5 4.5L5 21.5.5 17 5 12.5ZM19 12.5l4.5 4.5-4.5 4.5-4.5-4.5 4.5-4.5ZM10 11l-3 3M14 11l3 3M10 17h4",
);
export const Brain = /* @__PURE__ */ glyph(
  "Mindset",
  "M12 3v18M8 4H5v5H3v6h2v5h3M16 4h3v5h2v6h-2v5h-3M8 8l4 4-4 4M16 8l-4 4 4 4",
);
export const Sparkles = /* @__PURE__ */ glyph(
  "Insight",
  "M12 4v4M12 16v4M4 12h4M16 12h4M12 8l4 4-4 4-4-4 4-4ZM4 4l2 2M18 18l2 2",
);
export const User = /* @__PURE__ */ glyph(
  "Profile",
  "M4 4h16v16H4V4ZM15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM7 18v-1c0-2 10-2 10 0v1",
);
export const Settings = /* @__PURE__ */ glyph(
  "Settings",
  "M6 3v5M6 13v8M18 3v11M18 19v2M12 3v1M12 9v12M3.5 8h5v5h-5V8ZM9.5 4h5v5h-5V4ZM15.5 14h5v5h-5v-5Z",
);
export const SlidersHorizontal = /* @__PURE__ */ glyph(
  "Filters",
  "M3 6h5M13 6h8M3 12h11M19 12h2M3 18h2M10 18h11M8 3.5h5v5H8v-5ZM14 9.5h5v5h-5v-5ZM5 15.5h5v5H5v-5Z",
);
export const FileText = /* @__PURE__ */ glyph(
  "Report",
  "M5 3.5h10l4 4v13H5v-17ZM15 3.5v4h4M8 16l3-4 3 2 2-3M8 8h3",
);
export const Palette = /* @__PURE__ */ glyph(
  "Appearance",
  "M3 6h12v15H3V6ZM7 3h14v14M3 11h12M7 15h4M7 18h4",
);
export const CreditCard = /* @__PURE__ */ glyph(
  "Membership",
  "M3 5h18v14H3V5ZM3 9h18M6 15h4M16 12l2 2-2 2-2-2 2-2Z",
);
export const Shuffle = /* @__PURE__ */ glyph(
  "Projection",
  "M3 12h5M8 12l7-8h6M8 12h7l6-5M8 12l7 8h6M18 17l3 3-3 3M18 1l3 3-3 3",
);
export const Cable = /* @__PURE__ */ glyph(
  "BrokerBridge",
  "M3 5h6v6H3V5ZM15 13h6v6h-6v-6ZM9 8h9v5M15 16H6v-5M5 7h2M17 15h2",
);
export const CandlestickChart = /* @__PURE__ */ glyph(
  "Execution",
  "M7 3v4M7 16v5M4 7h6v9H4V7ZM17 3v8M17 18v3M14 11h6v7h-6v-7Z",
);
export const Wallet = /* @__PURE__ */ glyph(
  "Capital",
  "M3 5h17v15H3V5ZM3 8h17M15 12h6v5h-6v-5ZM17 14.5h.01M6 3h11",
);
export const Bell = /* @__PURE__ */ glyph(
  "Inbox",
  "M5 5h14v11H5V5ZM2 19h20M9 22h6M8 9h8M8 12h5M12 2v3",
);
export const TrendingUp = /* @__PURE__ */ glyph("Uptrend", "M3 18l5-7 4 3 8-10M15 4h5v5M3 21h18");
export const TrendingDown = /* @__PURE__ */ glyph(
  "Downtrend",
  "M3 5l5 7 4-3 8 10M15 19h5v-5M3 22h18",
);
export const Layers = /* @__PURE__ */ glyph(
  "Accounts",
  "M3 5l9-3 9 3-9 3-9-3ZM3 11l9 3 9-3M3 17l9 3 9-3",
);
export const Scale = /* @__PURE__ */ glyph(
  "RiskReward",
  "M3 5h18M12 3v18M7 5l-4 9h8L7 5ZM17 5l-4 9h8l-4-9ZM8 21h8",
);
export const Gauge = /* @__PURE__ */ glyph(
  "Readiness",
  "M3.5 17a8.5 8.5 0 1 1 17 0M5 12l2 1M12 5v3M19 12l-2 1M12 17l5-7M7 20h10",
);
export const Clock = /* @__PURE__ */ glyph("Time", "M4 4h16v16H4V4ZM12 7v5l4 2M7 7h.01M7 17h.01");
export const History = /* @__PURE__ */ glyph("History", "M5 8a8 8 0 1 1-1 8M2 4v5h5M12 7v5l4 2");
export const Lightbulb = /* @__PURE__ */ glyph(
  "Observation",
  "M7 16V8l5-5 5 5v8M7 16h10M9 19h6M10 22h4M9 10l3 3 3-3",
);
export const ShieldCheck = /* @__PURE__ */ glyph(
  "Discipline",
  "M4 4h16v9c0 4-8 8-8 8s-8-4-8-8V4ZM8 11l3 3 5-6",
);
export const ShieldAlert = /* @__PURE__ */ glyph(
  "RiskFlag",
  "M4 4h16v9c0 4-8 8-8 8s-8-4-8-8V4ZM12 8v5M12 16h.01",
);
export const Lock = /* @__PURE__ */ glyph(
  "Lock",
  "M5 10h14v11H5V10ZM8 10V6a4 4 0 0 1 8 0v4M12 14v3",
);
export const Crown = /* @__PURE__ */ glyph("Tier", "M4 6l4 4 4-6 4 6 4-4-2 12H6L4 6ZM6 21h12");
export const Star = /* @__PURE__ */ glyph("Grade", "M12 3l3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6Z");
export const Zap = /* @__PURE__ */ glyph("Impulse", "M13 2 5 13h6v9l8-12h-6V2Z");
export const Search = /* @__PURE__ */ glyph(
  "Search",
  "M15 9a6 6 0 1 1-12 0 6 6 0 0 1 12 0ZM14 14l7 7M6 9h6",
);
export const Pencil = /* @__PURE__ */ glyph("Edit", "M4 16 16 4l4 4L8 20H4v-4ZM13 7l4 4M13 21h8");
export const PenLine = Pencil;
export const Trash2 = /* @__PURE__ */ glyph(
  "Delete",
  "M4 6h16M9 3h6M6 6l1 15h10l1-15M10 10v7M14 10v7",
);
export const Trash = Trash2;
export const Plus = /* @__PURE__ */ glyph(
  "Add",
  "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M12 8v8M8 12h8",
);
export const Minus = /* @__PURE__ */ glyph("Minus", "M5 12h14");
export const X = /* @__PURE__ */ glyph("Close", "M6 6l12 12M18 6 6 18");
export const Check = /* @__PURE__ */ glyph("Check", "M4 12l5 6L20 5");
export const CheckCircle2 = /* @__PURE__ */ glyph("Confirmed", "M4 4h16v16H4V4ZM7 12l3 3 7-7");
export const ChevronDown = /* @__PURE__ */ glyph("Expand", "M6 9l6 6 6-6");
export const ChevronUp = /* @__PURE__ */ glyph("Collapse", "M6 15l6-6 6 6");
export const ChevronLeft = /* @__PURE__ */ glyph("Previous", "M15 6l-6 6 6 6");
export const ChevronRight = /* @__PURE__ */ glyph("Next", "M9 6l6 6-6 6");
export const ArrowRight = /* @__PURE__ */ glyph("Forward", "M3 12h17M14 6l6 6-6 6");
export const ArrowLeft = /* @__PURE__ */ glyph("Back", "M21 12H4M10 6l-6 6 6 6");
export const ArrowUpRight = /* @__PURE__ */ glyph("Profit", "M5 19 19 5M7 5h12v12");
export const ArrowDownRight = /* @__PURE__ */ glyph("Loss", "M5 5l14 14M7 19h12V7");
export const Upload = /* @__PURE__ */ glyph("Upload", "M4 15v6h16v-6M12 17V3M7 8l5-5 5 5");
export const Download = /* @__PURE__ */ glyph("Download", "M4 15v6h16v-6M12 3v14M7 12l5 5 5-5");
export const Copy = /* @__PURE__ */ glyph("Duplicate", "M8 8h13v13H8V8ZM16 4H4v12");
export const Info = /* @__PURE__ */ glyph("Info", "M4 4h16v16H4V4ZM12 10v7M12 7h.01");
export const AlertCircle = /* @__PURE__ */ glyph("Notice", "M4 4h16v16H4V4ZM12 7v6M12 17h.01");
export const ImagePlus = /* @__PURE__ */ glyph(
  "Screenshot",
  "M3 4h14v16H3V4ZM3 16l5-6 5 7M12 13l3-3M20 3v6M17 6h6",
);
export const Activity = /* @__PURE__ */ glyph("Activity", "M2 13h5l3-8 4 14 3-6h5");
export const Eye = /* @__PURE__ */ glyph(
  "Inspect",
  "M2 12l5-6h10l5 6-5 6H7l-5-6ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
);
export const Play = /* @__PURE__ */ glyph("Play", "M6 3.5 21 12 6 20.5v-17Z");
export const RotateCcw = /* @__PURE__ */ glyph("Reset", "M4 9a8 8 0 1 1 0 6M2 3v6h6");
export const RefreshCw = /* @__PURE__ */ glyph("Sync", "M3 8h14l-3-3M21 16H7l3 3M20 7v4M4 13v4");
