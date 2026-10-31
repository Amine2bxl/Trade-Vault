import type { EmotionalState } from "@/app/trading/readiness";
import type { PlanRespected, ReflectionReason } from "@/app/store/tradeIntel";
import type { MissedOpportunity } from "@/app/types";

/**
 * Le passage de relais entre deux écrans — UNE valeur, lue UNE fois.
 *
 * POURQUOI. Le bilan de séance sait déjà presque tout d'un trade ou d'un
 * setup manqué : date, sens, risque, état, plan, écarts, leçon. Le faire
 * retaper dans le formulaire du journal est exactement la friction qui fait
 * qu'on ne l'encode pas. L'écran qui sait dépose ; l'écran qui s'ouvre prend.
 *
 * EN MÉMOIRE, PAS EN STOCKAGE. Un relais n'a pas à survivre à un rechargement :
 * il est consommé dans la seconde qui suit, à l'ouverture du formulaire. Le
 * garder hors de `localStorage` évite qu'un relais oublié pré-remplisse, des
 * jours plus tard, un formulaire sans rapport.
 */

/** Champs du formulaire de trade (`TradeModal`) qu'un relais peut pré-remplir. */
export interface TradePrefill {
  date?: string;
  symbol?: string;
  direction?: "long" | "short" | "be";
  riskAmount?: string;
  entryTime?: string;
  exitTime?: string;
  strategy?: string;
  mistakes?: string[];
  intentEmotion?: EmotionalState | null;
  intentReasoning?: string;
  intentPlan?: string;
  reflectionPlan?: PlanRespected | null;
  reflectionReason?: ReflectionReason | null;
  reflectionNote?: string;
}

export type MissedPrefill = Partial<Omit<MissedOpportunity, "id" | "screenshots">>;

interface Payloads {
  trade: TradePrefill;
  missed: MissedPrefill;
}

const slots = new Map<keyof Payloads, unknown>();

export function handOff<K extends keyof Payloads>(kind: K, payload: Payloads[K]): void {
  slots.set(kind, payload);
}

/** Rend le relais en attente et l'efface : un second appel rend `null`. */
export function takeHandoff<K extends keyof Payloads>(kind: K): Payloads[K] | null {
  const v = slots.get(kind) as Payloads[K] | undefined;
  slots.delete(kind);
  return v ?? null;
}
