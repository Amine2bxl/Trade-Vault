// ============================================================
//  Provider d'HISTORIQUE — pages hebdomadaires de Forex Factory.
// ------------------------------------------------------------
//  L'export officiel (`forex-factory.ts`) ne publie que la semaine en
//  cours : un trade d'il y a trois mois ne trouvait donc aucune annonce
//  pour sa journée. Pour lui rendre son contexte, on lit la page
//  publique du calendrier d'une semaine passée
//  (`/calendar?week=mar10.2026`) : elle embarque ses événements en JSON
//  (`calendarComponentStates[…] = { days: [...] }`), valeurs publiées
//  (`actual`) comprises.
//
//  RÈGLES DE POLITESSE, tenues côté serveur (`economic-calendar.server`) :
//    • une semaine passée ne change plus : récupérée UNE fois, gardée ;
//    • une page à la fois, jamais plus d'une toutes les 20 s ;
//    • un échec (blocage, page changée) n'est retenté qu'après 7 jours,
//      trois fois au plus.
//
//  Même identifiant que l'export (hash instant|devise|titre) : une semaine
//  vue par les deux sources ne crée aucun doublon.
//
//  Le parsing est PUR et testé sur fixture : c'est ce qui casse quand la
//  page change de forme, il doit se vérifier sans réseau. Il ne lève
//  jamais : une page illisible rend une liste vide.
// ============================================================

import { countryForCurrency, type CalendarEvent } from "./types";
import { figure, normalizeImpact, SourceHttpError, stableId } from "./forex-factory";

export const FOREX_FACTORY_HISTORY_SOURCE = "forexfactory";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** `2026-03-08` → `https://www.forexfactory.com/calendar?week=mar8.2026`. */
export function forexFactoryWeekUrl(weekStart: string): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  return `https://www.forexfactory.com/calendar?week=${MONTHS[m - 1]}${d}.${y}`;
}

/** Une entrée d'événement de la page. Rien n'est garanti : on ne fait confiance à rien. */
interface PageEvent {
  name?: unknown;
  prefixedName?: unknown;
  currency?: unknown;
  dateline?: unknown;
  timeLabel?: unknown;
  impactName?: unknown;
  impactClass?: unknown;
  actual?: unknown;
  forecast?: unknown;
  previous?: unknown;
}

/**
 * Extrait le tableau JSON qui commence à `start` (un `[`), en respectant les
 * chaînes et leurs échappements. `null` si le tableau ne se referme pas.
 */
function balancedArray(src: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

/** Ancienne classe d'icône → impact, si `impactName` manque. */
function impactFromClass(value: unknown): CalendarEvent["impact"] | null {
  if (typeof value !== "string") return null;
  if (value.includes("-red")) return "high";
  if (value.includes("-ora")) return "medium";
  if (value.includes("-yel")) return "low";
  if (value.includes("-gra")) return "holiday";
  return null;
}

/** « All Day », « Tentative », « Day 2 » : pas d'heure précise. */
function isAllDayLabel(label: unknown): boolean {
  if (typeof label !== "string") return false;
  const l = label.trim().toLowerCase();
  return l === "all day" || l === "tentative" || /^day \d+$/.test(l);
}

/**
 * Convertit une page hebdomadaire en événements normalisés.
 *
 * Contrat : ne lève JAMAIS. Une entrée illisible est ignorée.
 */
export function parseForexFactoryCalendarPage(html: string): CalendarEvent[] {
  if (typeof html !== "string" || !html) return [];
  const out: CalendarEvent[] = [];
  const seen = new Set<string>();

  // La page peut porter plusieurs états de composant ; chacun a ses `days`.
  const marker = /calendarComponentStates\[\d+\]\s*=\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = marker.exec(html))) {
    const daysAt = html.indexOf("days:", m.index);
    if (daysAt < 0) continue;
    const open = html.indexOf("[", daysAt);
    if (open < 0) continue;
    const json = balancedArray(html, open);
    if (!json) continue;

    let days: unknown;
    try {
      days = JSON.parse(json);
    } catch {
      continue;
    }
    if (!Array.isArray(days)) continue;

    for (const day of days) {
      const events = (day as { events?: unknown })?.events;
      if (!Array.isArray(events)) continue;
      for (const raw of events as PageEvent[]) {
        if (!raw || typeof raw !== "object") continue;
        const title =
          (typeof raw.prefixedName === "string" && raw.prefixedName.trim()) ||
          (typeof raw.name === "string" && raw.name.trim()) ||
          "";
        const currency = typeof raw.currency === "string" ? raw.currency.trim().toUpperCase() : "";
        const dateline = typeof raw.dateline === "number" ? raw.dateline : Number(raw.dateline);
        if (!title || !/^[A-Z]{3}$/.test(currency) || !Number.isFinite(dateline)) continue;

        const startsAt = new Date(dateline * 1000).toISOString();
        const id = stableId(`${startsAt}|${currency}|${title}`);
        if (seen.has(id)) continue;
        seen.add(id);

        const impact =
          typeof raw.impactName === "string" && raw.impactName.trim()
            ? normalizeImpact(raw.impactName)
            : (impactFromClass(raw.impactClass) ?? "low");

        out.push({
          id,
          startsAt,
          currency,
          country: countryForCurrency(currency),
          title,
          impact,
          previous: figure(raw.previous),
          forecast: figure(raw.forecast),
          actual: figure(raw.actual),
          allDay: isAllDayLabel(raw.timeLabel),
          source: FOREX_FACTORY_HISTORY_SOURCE,
        });
      }
    }
  }

  out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return out;
}

/** Une page de défi anti-robot n'est pas une semaine vide : c'est un refus. */
function isChallengePage(html: string): boolean {
  return /cf-chl|challenge-platform|Just a moment\.\.\./i.test(html);
}

const PAGE_TIMEOUT_MS = 10_000;

/**
 * Récupère une semaine passée. Lève si la page est refusée ou illisible : un
 * résultat vide n'est jamais confondu avec « aucune annonce cette semaine ».
 */
export async function fetchForexFactoryWeek(weekStart: string): Promise<CalendarEvent[]> {
  const url = forexFactoryWeekUrl(weekStart);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
        // Identification honnête, comme pour l'export.
        "user-agent": "Mozilla/5.0 (compatible; TradeVault/1.0; +https://tradevault.be)",
      },
    });
    if (!response.ok) throw new SourceHttpError(url, response.status);
    const html = await response.text();
    if (isChallengePage(html)) throw new Error(`${url} answered with a bot challenge`);
    const events = parseForexFactoryCalendarPage(html);
    if (events.length === 0) throw new Error(`${url} contained no readable events`);
    return events;
  } finally {
    clearTimeout(timeout);
  }
}
