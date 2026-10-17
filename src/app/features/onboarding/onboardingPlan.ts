/**
 * LE PLAN DE PERSONNALISATION — module PUR.
 *
 * L'onboarding n'est pas un questionnaire posé sur l'application : chaque
 * réponse RECONFIGURE quelque chose de réel. Ce module dit quoi, sans rien
 * écrire — `Onboarding.tsx` applique, ce fichier décide. Séparé pour être
 * testé sans Supabase, et pour qu'on lise en un endroit ce que l'onboarding
 * change dans le produit :
 *
 *   • le COMPTE      — nom, type, capital et devise du compte principal
 *                      (ex. « Apex 50K », prop, 50 000 $) : chaque %, chaque
 *                      drawdown est juste dès le premier trade ;
 *   • les RÈGLES     — risque max, trades par jour, arrêt après N pertes,
 *                      perte max du jour : `domain/ruleCheck` vérifie chaque
 *                      trade loggé contre elles ;
 *   • le PROFIL      — style, marchés, expérience, angle mort, mission : la
 *                      checklist pré-market se génère dessus
 *                      (`checklistDefaults`), Jarvis s'y ancre (`aiContext`,
 *                      mode de voix, motif surveillé en priorité) ;
 *   • l'APPARENCE et la LANGUE, appliquées à chaud.
 *
 * Les vocabulaires (`style`, `experience`, `goal`, `pain`) sont ceux que lisent
 * déjà ces consommateurs : on ne les renomme pas. `pain` est désormais UNE
 * valeur — la checklist le compare par égalité, et l'ancienne multi-sélection
 * (« emotions, overtrading ») ne déclenchait donc aucun de ses blocs.
 */
import type { TradingRule } from "@/domain/ruleCheck";
import type { AccountType } from "@/app/store/accounts";
import type { OnboardingData } from "@/app/store/profile";

export type Arena = "prop_challenge" | "funded" | "personal" | "demo";
export type Style = "scalping" | "daytrading" | "swing";
export type Experience = "new" | "intermediate" | "seasoned" | "funded";
export type Leak = "emotions" | "overtrading" | "risk" | "consistency" | "journaling";
export type Goal = "prop_challenge" | "fulltime" | "consistency" | "discipline" | "side";
export type Market = "futures" | "forex" | "stocks" | "crypto" | "options";

export const ARENAS: Arena[] = ["prop_challenge", "funded", "personal", "demo"];
export const STYLES: Style[] = ["scalping", "daytrading", "swing"];
export const EXPERIENCES: Experience[] = ["new", "intermediate", "seasoned", "funded"];
export const LEAKS: Leak[] = ["emotions", "overtrading", "risk", "consistency", "journaling"];
export const GOALS: Goal[] = ["prop_challenge", "fulltime", "consistency", "discipline", "side"];
export const MARKETS: Market[] = ["futures", "forex", "stocks", "crypto", "options"];

/** Les prop firms proposées. Des NOMS, rien d'autre : aucun logo, aucune
 *  affiliation suggérée. « other » laisse le trader nommer la sienne. */
export const PROP_FIRMS = [
  { id: "apex", name: "Apex" },
  { id: "topstep", name: "Topstep" },
  { id: "ftmo", name: "FTMO" },
  { id: "the5ers", name: "The5ers" },
  { id: "fundednext", name: "FundedNext" },
  { id: "tradeify", name: "Tradeify" },
  { id: "other", name: "" },
] as const;
export type PropFirmId = (typeof PROP_FIRMS)[number]["id"];

export const PROP_SIZES = [25_000, 50_000, 100_000, 150_000] as const;
export const CAPITAL_PRESETS = [1_000, 5_000, 10_000, 25_000, 50_000, 100_000] as const;
export const TARGET_PRESETS = [2, 4, 6] as const;

export interface Guardrails {
  /** % du compte risqué au plus par trade (`max_risk_pct`). `null` = désactivé. */
  riskPct: number | null;
  /** Trades au plus par jour (`max_trades_day`). */
  maxTrades: number | null;
  /** Arrêt pour la journée après N pertes (`stop_after_losses`). */
  stopAfter: number | null;
  /** Perte max du jour, en devise du compte — engagement écrit (`custom`). */
  dailyLoss: number | null;
}

export interface OnboardingAnswers {
  firstName: string;
  arena: Arena | null;
  firm: PropFirmId | null;
  capital: number | null;
  currency: string;
  assets: Market[];
  usesIct: boolean;
  style: Style | null;
  experience: Experience | null;
  leak: Leak | null;
  goal: Goal | null;
  monthlyTarget: number | null;
  guardrails: Guardrails;
}

export const EMPTY_GUARDRAILS: Guardrails = {
  riskPct: null,
  maxTrades: null,
  stopAfter: null,
  dailyLoss: null,
};

export function isProp(arena: Arena | null): boolean {
  return arena === "prop_challenge" || arena === "funded";
}

/** La mission proposée en premier, selon l'arène. */
export function defaultGoal(arena: Arena | null): Goal {
  switch (arena) {
    case "prop_challenge":
      return "prop_challenge";
    case "funded":
      return "fulltime";
    case "demo":
      return "discipline";
    default:
      return "consistency";
  }
}

/**
 * Les garde-fous PROPOSÉS — un point de départ prudent, que le trader ajuste.
 *
 * Des valeurs de bon sens, pas des promesses : un compte de prop firm ou un
 * débutant part sur 0,5 % de risque, les autres sur 1 % ; le nombre de trades
 * suit la durée de détention ; l'angle mort déclaré resserre la règle qui le
 * concerne. Aucune n'est présentée comme « optimale ».
 */
export function suggestGuardrails(
  a: Pick<OnboardingAnswers, "arena" | "style" | "experience" | "leak" | "capital">,
): Guardrails {
  const careful = isProp(a.arena) || a.experience === "new";
  let riskPct = careful ? 0.5 : 1;
  if (a.leak === "risk") riskPct = Math.min(riskPct, 0.5);

  let maxTrades = a.style === "scalping" ? 6 : a.style === "swing" ? 2 : 4;
  if (a.leak === "overtrading") maxTrades = Math.max(1, Math.min(maxTrades, 3));

  const stopAfter = a.leak === "emotions" ? 2 : 3;

  // Perte max du jour : seulement pour une prop firm, où elle existe déjà
  // dans le contrat. 2 % du compte, arrondi à la centaine — le trader la
  // remplace par celle de SA firme.
  const dailyLoss =
    isProp(a.arena) && a.capital && a.capital > 0
      ? Math.max(100, Math.round((a.capital * 0.02) / 100) * 100)
      : null;

  return { riskPct, maxTrades, stopAfter, dailyLoss };
}

/** Le garde-fou qui répond à l'angle mort déclaré — mis en avant à l'écran. */
export function guardrailForLeak(leak: Leak | null): keyof Guardrails | null {
  switch (leak) {
    case "emotions":
      return "stopAfter";
    case "overtrading":
      return "maxTrades";
    case "risk":
      return "riskPct";
    case "consistency":
      return "riskPct";
    default:
      return null;
  }
}

/** Le nom du compte principal : « Apex 50K », « FTMO 100K · Funded »… */
export function accountName(
  a: Pick<OnboardingAnswers, "arena" | "firm" | "capital">,
  labels: { personal: string; demo: string; funded: string; prop: string },
): string {
  if (isProp(a.arena)) {
    const firm = PROP_FIRMS.find((f) => f.id === a.firm)?.name || labels.prop;
    const size = a.capital && a.capital >= 1000 ? ` ${Math.round(a.capital / 1000)}K` : "";
    return `${firm}${size}${a.arena === "funded" ? ` · ${labels.funded}` : ""}`;
  }
  return a.arena === "demo" ? labels.demo : labels.personal;
}

export function accountType(arena: Arena | null): AccountType {
  if (isProp(arena)) return "prop";
  if (arena === "demo") return "demo";
  return "personal";
}

/** Les textes des règles, dans la langue du trader (il les relit tels quels). */
export interface RuleTexts {
  risk: string;
  trades: string;
  stop: string;
  daily: string;
}

const fill = (tpl: string, v: string) => tpl.replace("{v}", v);

/**
 * Les règles écrites dans `profiles.trading_rules`.
 *
 * Identifiants STABLES (`onb-…`) : refaire l'onboarding remplace ces règles
 * sans dupliquer, et les règles que le trader a écrites lui-même — tout autre
 * identifiant — sont conservées telles quelles.
 */
export function buildRules(
  g: Guardrails,
  texts: RuleTexts,
  formatMoney: (n: number) => string,
  existing: TradingRule[] = [],
  formatNumber: (n: number) => string = String,
): TradingRule[] {
  const generated: TradingRule[] = [];
  if (g.riskPct !== null && g.riskPct > 0) {
    generated.push({
      id: "onb-max-risk",
      kind: "max_risk_pct",
      value: String(g.riskPct),
      text: fill(texts.risk, formatNumber(g.riskPct)),
      enabled: true,
    });
  }
  if (g.maxTrades !== null && g.maxTrades > 0) {
    generated.push({
      id: "onb-max-trades",
      kind: "max_trades_day",
      value: String(g.maxTrades),
      text: fill(texts.trades, formatNumber(g.maxTrades)),
      enabled: true,
    });
  }
  if (g.stopAfter !== null && g.stopAfter > 0) {
    generated.push({
      id: "onb-stop-losses",
      kind: "stop_after_losses",
      value: String(g.stopAfter),
      text: fill(texts.stop, formatNumber(g.stopAfter)),
      enabled: true,
    });
  }
  if (g.dailyLoss !== null && g.dailyLoss > 0) {
    generated.push({
      id: "onb-daily-loss",
      kind: "custom",
      value: String(g.dailyLoss),
      text: fill(texts.daily, formatMoney(g.dailyLoss)),
      enabled: true,
    });
  }
  const kept = existing.filter((r) => !r.id.startsWith("onb-"));
  return [...kept, ...generated];
}

/** Combien de garde-fous seront actifs — affiché pendant la calibration. */
export function armedCount(g: Guardrails): number {
  return [g.riskPct, g.maxTrades, g.stopAfter, g.dailyLoss].filter((v) => v !== null && v > 0)
    .length;
}

/** Ce qui part sur le profil (`saveOnboarding`) — vocabulaire des consommateurs. */
export function profileFields(a: OnboardingAnswers): OnboardingData {
  const ictMarkets: Market[] = ["futures", "forex", "crypto"];
  return {
    goal: a.goal,
    assets: a.assets,
    style: a.style,
    experience: a.arena === "funded" && !a.experience ? "funded" : a.experience,
    usesIct: a.usesIct && a.assets.some((m) => ictMarkets.includes(m)),
    // La firme vit dans la colonne des brokers : c'est là que Jarvis lit
    // « où tu trades » (`backend/ai-tools`). « other » n'apprend rien.
    brokers: isProp(a.arena) && a.firm && a.firm !== "other" ? [a.firm] : [],
    pain: a.leak,
    monthlyTarget: a.monthlyTarget,
    onboardedAt: null,
    skipped: false,
  };
}

/** Le marché qui montre l'interrupteur ICT / SMC. */
export function offersIct(assets: Market[]): boolean {
  return assets.some((m) => m === "futures" || m === "forex" || m === "crypto");
}
