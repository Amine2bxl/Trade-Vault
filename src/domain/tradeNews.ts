/**
 * LES ANNONCES ÉCONOMIQUES DE LA JOURNÉE D'UN TRADE — module PUR.
 *
 * Un trade est daté (jour civil du trader) et porte un symbole ; le calendrier
 * publie des annonces datées à l'instant près, par devise. Ce module relie les
 * deux : quelles annonces fortes ou moyennes ont touché les devises du trade
 * ce jour-là, et lesquelles tombaient pendant qu'il était en position.
 *
 * Il sert deux surfaces :
 *   • TradeModal — une ligne discrète : « USD · CPI 14:30 · FOMC 20:00 » ;
 *   • Analytics — les résultats des jours d'annonce face aux jours calmes,
 *     chacun avec son `n`, rien sous l'échantillon minimum, aucune causalité.
 *
 * Semaine du calendrier : du DIMANCHE au samedi, la convention de la source.
 */
import { localDateOf } from "@/shared/calendar-date";
import { currenciesForSymbol } from "./instrumentCurrency";
import { MIN_BUCKET_SAMPLE } from "./quantStats";

/** La forme minimale d'une annonce (structurellement compatible avec `CalendarEvent`). */
export interface NewsEvent {
  id: string;
  startsAt: string;
  currency: string;
  title: string;
  impact: "high" | "medium" | "low" | "holiday";
  allDay: boolean;
  source: string;
  actual?: string | null;
  forecast?: string | null;
  previous?: string | null;
}

/** Le repli intégré : des heures déduites d'une règle, jamais confirmées. */
export const APPROXIMATE_SOURCE = "builtin";

// ── Semaines ────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

function utcNoon(day: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const d = new Date(`${day}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Le dimanche qui ouvre la semaine de `day` (`YYYY-MM-DD`). */
export function weekStartOf(day: string): string...[truncated]