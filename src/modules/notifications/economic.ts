import type { CalendarEvent } from "../economic-calendar/types";
import type { CodedRule } from "./rules";

/**
 * LE CALENDRIER ÉCONOMIQUE DEVIENT UNE ALERTE — LA SEULE QUI INTERROMPT.
 *
 * ── CE QUI A CHANGÉ ─────────────────────────────────────────────────────────
 *
 * Avant : deux préavis (60 et 15 min) pour TOUTE annonce à fort impact, quelle
 * que soit la devise, en toast de quatre secondes qui ne nommait même pas
 * l'annonce. Un trader de NQ recevait la BoJ, un trader d'EUR/USD le PIB
 * canadien — et le préavis de quinze minutes « ouvrait le popup » à condition
 * qu'un trade ait été enregistré dans les deux minutes, donc presque jamais.
 *
 * Maintenant, une seule règle, et c'est la seule notification du produit qui
 * s'ouvre d'elle-même (le reste attend dans la boîte de réception) :
 *
 *   • UNE HEURE AVANT, pas de compte à rebours — le temps de décider de rester
 *     en dehors ou de réduire, pas une sirène quand il est trop tard ;
 *   • IMPACT FORT UNIQUEMENT — les « rouges » ;
 *   • SEULEMENT LES DEVISES QUE LE TRADER TRADE VRAIMENT — calculées sur son
 *     journal (`domain/instrumentCurrency.currencyFocus`) : NQ → USD,
 *     EURUSD → EUR et USD, DAX → EUR… ;
 *   • ANNONCES SIMULTANÉES REGROUPÉES — « CPI + Core CPI » à 14 h 30 est UNE
 *     alerte, pas deux ;
 *   • HEURES SÛRES SEULEMENT — le repli intégré (`source: "builtin"`) donne des
 *     heures approximatives : il sert la page Calendrier, jamais une alerte.
 *
 * UN SEUL RAPPEL PAR ANNONCE : la clé porte l'identifiant de l'événement, donc
 * réévaluer les règles toutes les cinq minutes ne produit pas douze alertes.
 */

/** Le préavis, en minutes. */
export const PREAVIS_MIN = 60;

/**
 * La fenêtre de tir : de 60 à 45 minutes avant.
 *
 * Les règles sont évaluées à l'ouverture de l'application puis toutes les cinq
 * minutes. Exiger exactement « 60 minutes restantes » ne déclencherait
 * presque jamais ; quinze minutes de tolérance garantissent le rappel sans
 * qu'il arrive trop tard pour servir à quelque chose.
 */
const FENETRE_MIN = 15;

export interface FocusDevises {
  /** Devises à surveiller. Vide → l'USD, la plus tradée du produit. */
  currencies: string[];
  /** Part des trades récents exposés à chaque devise (0–1), si connue. */
  share?: Partial<Record<string, number>>;
}

export interface AlerteEco {
  /** L'annonce de référence (la première du groupe). */
  event: CalendarEvent;
  /** Toutes les annonces à fort impact de cette devise à cette heure. */
  groupe: CalendarEvent[];
  /** Le préavis, en minutes. */
  preavis: number;
  /** Minutes réellement restantes au moment de l'évaluation. */
  restant: number;
}

/**
 * Les alertes qui DEVRAIENT exister à cet instant — fonction pure.
 *
 * `focus` absent : toutes les devises (comportement neutre, pour les appels
 * qui ne connaissent pas le trader). Présent : seulement ses devises.
 */
export function alertesEconomiquesImminentes(
  events: CalendarEvent[],
  now: Date = new Date(),
  focus?: FocusDevises,
): AlerteEco[] {
  const maintenant = now.getTime();
  const devises = focus ? new Set(focus.currencies.length ? focus.currencies : ["USD"]) : null;
  const groupes = new Map<string, CalendarEvent[]>();

  for (const e of events) {
    // « Dans la journée » ne se compte pas en minutes.
    if (e.allDay) continue;
    if (e.impact !== "high") continue;
    // Une heure approximative ne fait pas une alerte.
    if (e.source === "builtin") continue;
    if (devises && !devises.has(e.currency)) continue;

    const t = new Date(e.startsAt).getTime();
    if (Number.isNaN(t)) continue;
    const restantMin = (t - maintenant) / 60_000;
    if (restantMin <= PREAVIS_MIN - FENETRE_MIN || restantMin > PREAVIS_MIN) continue;

    const cle = `${e.currency}|${e.startsAt}`;
    const g = groupes.get(cle);
    if (g) g.push(e);
    else groupes.set(cle, [e]);
  }

  const out: AlerteEco[] = [];
  for (const groupe of groupes.values()) {
    // L'ordre du flux est stable : la première annonce donne son identifiant
    // au groupe, la clé de déduplication ne bouge donc pas d'un passage à
    // l'autre.
    const tries = [...groupe].sort((a, b) => a.id.localeCompare(b.id));
    const ref = tries[0];
    const restant = Math.round((new Date(ref.startsAt).getTime() - maintenant) / 60_000);
    out.push({ event: ref, groupe: tries, preavis: PREAVIS_MIN, restant });
  }
  // La plus proche d'abord ; à égalité, la devise la plus tradée.
  const part = (c: string) => focus?.share?.[c] ?? 0;
  return out.sort(
    (a, b) => a.restant - b.restant || part(b.event.currency) - part(a.event.currency),
  );
}

/** Le texte d'une alerte, dans la langue du trader. */
function copie(
  a: AlerteEco,
  fr: boolean,
  share: number | undefined,
): { title: string; body: string; plan: string } {
  const heure = new Date(a.event.startsAt).toLocaleTimeString(fr ? "fr-FR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const titres = a.groupe.map((e) => e.title);
  const nom = titres.length > 2 ? `${titres[0]} +${titres.length - 1}` : titres.join(" + ");
  const exposition =
    share && share > 0
      ? fr
        ? ` ${Math.round(share * 100)} % de tes trades récents sont exposés au ${a.event.currency}.`
        : ` ${Math.round(share * 100)}% of your recent trades are exposed to ${a.event.currency}.`
      : "";
  return {
    title: fr
      ? `${a.event.currency} · ${nom} dans ${a.restant} min`
      : `${a.event.currency} · ${nom} in ${a.restant} min`,
    body: fr
      ? `Annonce à fort impact à ${heure}.${exposition}`
      : `High-impact release at ${heure}.${exposition}`,
    plan: fr
      ? `Décide maintenant, pas à ${heure} : rester en dehors, réduire la taille ou sortir avant l'annonce.`
      : `Decide now, not at ${heure}: stay flat, size down or close before the release.`,
  };
}

/**
 * Les alertes, prêtes pour le moteur de notifications.
 *
 * CANAUX : la boîte de réception (trace) et le push (téléphone, si le trader
 * l'a activé). Pas de toast : l'alerte s'ouvre en POPUP (`data.popup`), la
 * seule de tout le produit — voir l'adaptateur `persist` de `App.tsx`.
 */
export function reglesEconomiques(
  events: CalendarEvent[],
  now: Date = new Date(),
  fr = false,
  focus?: FocusDevises,
): CodedRule[] {
  return alertesEconomiquesImminentes(events, now, focus).map((a) => {
    const share = focus?.share?.[a.event.currency];
    const { title, body, plan } = copie(a, fr, share);
    const cle = `economic_event:${a.event.id}:${a.preavis}`;
    return {
      key: cle,
      once: true,
      input: {
        kind: "economic_event" as const,
        title,
        body,
        severity: "warning" as const,
        category: "economic" as const,
        channels: (["dashboard", "push"] as const).slice(),
        url: "/news",
        dedupKey: cle,
        data: {
          eventId: a.event.id,
          currency: a.event.currency,
          startsAt: a.event.startsAt,
          impact: a.event.impact,
          forecast: a.event.forecast,
          previous: a.event.previous,
          titles: a.groupe.map((e) => e.title),
          exposure: share ?? null,
          plan,
          popup: true,
          ctaLabel: fr ? "Voir le calendrier" : "Open the calendar",
          ctaPage: "news",
        },
      },
    };
  });
}
