/**
 * Les pages de l'application — SOURCE UNIQUE.
 *
 * Le tableau porte la vérité et le type en dérive, pas l'inverse : une union TS
 * s'efface à la compilation, donc toute validation à l'exécution devait
 * recopier la liste à la main. Cette recopie existait à deux endroits dans
 * `App.tsx` et ne demandait qu'à diverger — ajouter une page à l'union sans
 * l'ajouter au tableau produisait une page silencieusement non restaurable.
 */
export const PAGES = [
  "dashboard",
  "inbox",
  "journal",
  "checklist",
  "calendar",
  "analytics",
  "mistakes",
  "missed",
  "insights",
  "profile",
  "news",
  "seasonality",
  "calculator",
  "settings",
  "reports",
  "goals",
  "tradingplan",
  "appearance",
  "subscription",
  "montecarlo",
] as const;

export type Page = (typeof PAGES)[number];

/**
 * Les SECTIONS — regroupement de présentation, au-dessus de `PAGES`.
 *
 * Vingt-et-une entrées de navigation à plat ne tiennent ni dans une barre
 * latérale lisible ni dans une barre mobile ; six sections, oui. Le
 * regroupement est PUREMENT une affaire d'affichage : chaque page garde son
 * URL, le routage ne bouge pas, les liens profonds continuent de fonctionner.
 *
 * La page par défaut d'une section est `pages[0]` — délibérément pas un champ
 * `default` séparé, qui ferait deux sources pour un même fait (`PRODUCT.md`
 * §2).
 *
 * `inbox` n'appartient à aucune section : c'est une surface de notification
 * (cloche dans l'en-tête), pas une destination de navigation.
 */
export const SECTIONS = [
  { id: "dashboard", pages: ["dashboard"] },
  {
    id: "preparation",
    pages: ["checklist", "calculator", "news"],
  },
  { id: "journal", pages: ["journal", "calendar", "mistakes", "missed"] },
  { id: "analysis", pages: ["analytics", "seasonality", "reports", "montecarlo"] },
  { id: "coach", pages: ["insights"] },
  { id: "strategy", pages: ["tradingplan", "goals"] },
  { id: "settings", pages: ["settings", "profile", "appearance", "subscription"] },
] as const satisfies readonly { id: string; pages: readonly Page[] }[];

export type SectionId = (typeof SECTIONS)[number]["id"];

/** Pages qui ne vivent dans aucune section (surfaces, pas destinations). */
export const UNSECTIONED_PAGES: readonly Page[] = ["inbox"];

/** Garde d'exécution — la seule façon sûre de valider une valeur stockée. */
export function isPage(value: unknown): value is Page {
  return typeof value === "string" && (PAGES as readonly string[]).includes(value);
}

export { type TradeDirection, type Trade, type TradeStats, isBreakEven } from "@/domain/trade";

export interface User {
  id: string;
  email: string;
  name: string;
}

export const STRATEGIES = [
  "Scalping",
  "Momentum",
  "Reversal",
  "Breakout",
  "Trend Following",
  "VWAP Play",
  "Gap Fill",
  "Range Trading",
  // ICT setups
  "Silver Bullet",
  "Judas Swing",
  "FVG Entry",
  "Order Block",
  "Liquidity Sweep",
  "Breaker Block",
  "Power of 3",
  "Other",
] as const;

export const MISTAKE_OPTIONS = [
  "No stop loss",
  "Overtrading",
  "Revenge trade",
  "FOMO entry",
  "Premature exit",
  "Holding too long",
  "Size too large",
  "Ignored plan",
  "Chased entry",
  "Averaged down",
  "Ignored market conditions",
  "Low liquidity",
] as const;

export const DEFAULT_CONFLUENCES = [
  "Support/Resistance",
  "Trend line",
  "Fibonacci",
  "VWAP",
  "EMA alignment",
  "Volume confirmation",
  "Market structure",
  "Order block",
  "Supply/Demand zone",
  "Liquidity sweep",
  "Divergence",
  "Break of structure",
];

export interface MissedOpportunity {
  id: string;
  date: string;
  symbol: string;
  reasonNotTaken: string;
  whatHappened: string;
  lessonLearned: string;
  nextTimePlan: string;
  estimatedR: number;
  screenshots: string[];
}

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "nl", label: "Nederlands" },
  { code: "ru", label: "Русский" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
] as const;

export const SUPPORT_EMAIL = "tradevault@outlook.fr";

// Public review page. The domain must match the one verified via the
// trustpilot-one-time-domain-verification-id meta tag in __root.tsx.
export const TRUSTPILOT_REVIEW_URL = "https://www.trustpilot.com/evaluate/tradevaultt.vercel.app";
