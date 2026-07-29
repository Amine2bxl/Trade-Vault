// ============================================================
//  Economic calendar — format normalisé.
// ------------------------------------------------------------
//  Une seule forme d'événement traverse toute l'application :
//  provider → cache Postgres → server function → UI. Chaque
//  provider est responsable de produire CE type ; personne en
//  aval ne connaît le format d'origine.
// ============================================================

export type EventImpact = "high" | "medium" | "low" | "holiday";

export interface CalendarEvent {
  /** Hash stable de (instant, devise, titre) — clé d'upsert du cache. */
  id: string;
  /** Instant absolu ISO 8601 en UTC. Le fuseau d'affichage est une décision UI. */
  startsAt: string;
  /** Code ISO de la devise concernée (USD, EUR…). */
  currency: string;
  /** Pays/zone lisible, dérivé de la devise. */
  country: string;
  title: string;
  impact: EventImpact;
  /** Valeurs telles que publiées, unités comprises ("3.2%", "215K"). */
  previous: string | null;
  forecast: string | null;
  /** Renseigné à la publication ; null tant que l'événement n'a pas eu lieu. */
  actual: string | null;
  /** Événement sans heure précise — l'UI affiche un jour, pas un horaire. */
  allDay: boolean;
  source: string;
}

export interface CalendarProvider {
  /** Identifiant stocké avec chaque ligne (`source`). */
  readonly id: string;
  /**
   * Récupère la fenêtre courante (semaine en cours + suivante selon le
   * provider). Doit lever en cas d'échec : c'est l'appelant qui décide de la
   * stratégie de repli, jamais le provider.
   */
  fetchEvents(): Promise<CalendarEvent[]>;
}

/** Devise → pays/zone. Sert l'affichage et la recherche ("Etats-Unis"). */
export const CURRENCY_COUNTRY: Record<string, string> = {
  USD: "United States",
  EUR: "Euro Area",
  GBP: "United Kingdom",
  JPY: "Japan",
  CHF: "Switzerland",
  CAD: "Canada",
  AUD: "Australia",
  NZD: "New Zealand",
  CNY: "China",
};

export function countryForCurrency(currency: string): string {
  return CURRENCY_COUNTRY[currency] ?? currency;
}
