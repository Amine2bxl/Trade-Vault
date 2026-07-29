// ============================================================
//  Provider — Forex Factory Calendar Export.
// ------------------------------------------------------------
//  On consomme l'EXPORT OFFICIEL publié par Forex Factory
//  (nfs.faireconomy.media), celui qui alimente leur propre widget
//  de calendrier. Ce n'est pas du scraping HTML : pas de parsing
//  de DOM, pas de contournement, un endpoint machine-readable
//  prévu pour ça. Il est plafonné à ~2 requêtes / 5 minutes tous
//  fichiers confondus — d'où un cron à quelques passages par jour
//  et un cache en base, jamais d'appel par requête utilisateur.
//
//  Le parsing est une fonction PURE, testée sur fixture : c'est la
//  partie qui casse quand la source change de forme, elle doit être
//  vérifiable sans réseau.
// ============================================================

import { countryForCurrency, type CalendarEvent, type CalendarProvider } from "./types";

const THIS_WEEK = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const NEXT_WEEK = "https://nfs.faireconomy.media/ff_calendar_nextweek.json";

export const FOREX_FACTORY_SOURCE = "forexfactory";

/** Forme d'une entrée du flux. Tout est optionnel : on ne fait confiance à rien. */
interface RawEntry {
  title?: unknown;
  country?: unknown;
  date?: unknown;
  impact?: unknown;
  forecast?: unknown;
  previous?: unknown;
  actual?: unknown;
}

/** FNV-1a 32 bits — hash déterministe, synchrone, identique sur tous les runtimes. */
function stableId(parts: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < parts.length; i++) {
    h ^= parts.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  // La source utilise "" pour « pas encore publié » ; on normalise en null pour
  // que l'UI n'ait qu'un seul cas vide à traiter.
  return trimmed === "" ? null : trimmed;
}

function normalizeImpact(value: unknown): CalendarEvent["impact"] {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (v === "high") return "high";
  if (v === "medium") return "medium";
  if (v === "holiday" || v === "non-economic") return "holiday";
  // Inconnu → "low" : un événement mal classé reste visible mais ne pollue pas
  // les filtres à forte impact, sur lesquels un trader règle sa journée.
  return "low";
}

/**
 * `true` quand l'horodatage tombe à minuit DANS LE FUSEAU DE LA SOURCE — la
 * convention du flux pour « All Day » / « Tentative ». On lit l'heure telle
 * qu'écrite dans la chaîne (qui porte son propre décalage), ce qui évite toute
 * dépendance à une base de fuseaux horaires.
 */
function isAllDay(iso: string): boolean {
  return /T00:00(:00)?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.test(iso);
}

/**
 * Convertit le flux brut en événements normalisés.
 *
 * Contrat : ne lève JAMAIS. Une entrée illisible est ignorée, pas fatale — une
 * seule ligne malformée ne doit pas priver le trader de sa semaine.
 */
export function parseForexFactoryFeed(raw: unknown): CalendarEvent[] {
  if (!Array.isArray(raw)) return [];

  const out: CalendarEvent[] = [];
  const seen = new Set<string>();

  for (const item of raw as RawEntry[]) {
    if (!item || typeof item !== "object") continue;

    const title = text(item.title);
    const rawDate = text(item.date);
    const currency = text(item.country)?.toUpperCase();
    if (!title || !rawDate || !currency) continue;

    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) continue;

    const startsAt = parsed.toISOString();
    const id = stableId(`${startsAt}|${currency}|${title}`);
    // Le flux peut répéter un événement entre « cette semaine » et « la semaine
    // prochaine » sur la charnière : on garde la première occurrence.
    if (seen.has(id)) continue;
    seen.add(id);

    out.push({
      id,
      startsAt,
      currency,
      country: countryForCurrency(currency),
      title,
      impact: normalizeImpact(item.impact),
      previous: text(item.previous),
      forecast: text(item.forecast),
      // `actual` n'est présent que si la source le fournit et que la donnée est
      // publiée. Absent = événement à venir, ce que l'UI affiche comme tel.
      actual: text(item.actual),
      allDay: isAllDay(rawDate),
      source: FOREX_FACTORY_SOURCE,
    });
  }

  out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return out;
}

async function fetchWeek(url: string, signal: AbortSignal): Promise<CalendarEvent[]> {
  const response = await fetch(url, {
    signal,
    headers: {
      accept: "application/json",
      // Identification honnête : la source doit pouvoir nous reconnaître et
      // nous contacter plutôt que nous bloquer en silence.
      "user-agent": "TradeVault/1.0 (economic calendar sync; +https://tradevault.app)",
    },
  });
  if (!response.ok) {
    throw new Error(`${url} responded ${response.status}`);
  }
  return parseForexFactoryFeed(await response.json());
}

export const forexFactoryProvider: CalendarProvider = {
  id: FOREX_FACTORY_SOURCE,

  async fetchEvents() {
    // 15 s : au-delà, la source est de toute façon considérée en échec et le
    // cron suivant reprendra. Une fonction serverless ne doit pas attendre.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const thisWeek = await fetchWeek(THIS_WEEK, controller.signal);

      // La semaine suivante est un CONFORT, pas une exigence : son échec ne doit
      // pas invalider la semaine en cours, qui est ce que le trader regarde.
      let nextWeek: CalendarEvent[] = [];
      try {
        nextWeek = await fetchWeek(NEXT_WEEK, controller.signal);
      } catch (error) {
        console.warn("[economic-calendar] next week feed unavailable", error);
      }

      const merged = new Map<string, CalendarEvent>();
      for (const event of [...thisWeek, ...nextWeek]) merged.set(event.id, event);
      return [...merged.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    } finally {
      clearTimeout(timeout);
    }
  },
};
