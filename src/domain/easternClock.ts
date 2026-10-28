/**
 * L'HEURE DE NEW YORK D'UN INSTANT PROUVÉ — module pur.
 *
 * Les sessions du produit (Asie, Londres, New York) et les tranches horaires
 * sont exprimées en heure Eastern (convention des futures NQ/ES). Une saisie
 * manuelle suit cette convention ; un trade broker, lui, porte des heures
 * écrites dans le fuseau DU TRADER (voir `modules/brokers/toTrade`). Quand
 * l'instant UTC de l'entrée est prouvé (`Trade.entryAt`), l'heure Eastern se
 * DÉDUIT exactement, changement d'heure compris, au lieu d'être supposée.
 */

/** Instant ISO 8601 valide → millisecondes, sinon `null`. */
export function instantMs(iso: string | null | undefined): number | null {
  if (typeof iso !== "string" || iso.trim() === "") return null;
  // Un instant sans décalage (« 2026-10-21T14:00 ») n'est pas un instant : il
  // dépendrait du fuseau de la machine qui le lit.
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso.trim())) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

const FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface EasternClock {
  /** Date civile à New York, `AAAA-MM-JJ`. */
  date: string;
  /** Minute de la journée à New York, 0–1439. */
  minute: number;
  /** Jour de la semaine à New York, 0 = dimanche. */
  weekday: number;
}

/** Heure de New York d'un instant prouvé, ou `null`. */
export function easternClockOf(iso: string | null | undefined): EasternClock | null {
  const ms = instantMs(iso);
  if (ms === null) return null;
  const parts = FORMAT.formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const weekday = WEEKDAY[get("weekday")];
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || weekday === undefined) return null;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minute: hour * 60 + minute,
    weekday,
  };
}
