import type { CalendarEvent } from "../economic-calendar/types";
import type { CodedRule } from "./rules";

/**
 * LE CALENDRIER ÉCONOMIQUE DEVIENT UNE ALERTE.
 *
 * ── LE TROU ─────────────────────────────────────────────────────────────────
 *
 * `NotificationKind` déclarait `"economic_event"` depuis le début, et
 * `NotificationCategory` déclarait `"economic"` — la boîte de réception avait
 * même son filtre « Économie », avec son icône. Mais AUCUNE règle n'émettait
 * jamais cette notification. Un filtre qui ne peut rien contenir, une catégorie
 * qui ne se remplit pas : le calendrier vivait dans sa page, et nulle part
 * ailleurs.
 *
 * Or c'est la seule donnée du produit qui soit à la fois DATÉE et EXTERNE : le
 * trader ne peut pas la déduire de son journal, et elle a une heure limite.
 * C'est exactement ce qu'une notification doit porter — et le reste (ses
 * erreurs, ses objectifs) peut attendre qu'il ouvre la page.
 *
 * ── CE QUI DÉCLENCHE, ET CE QUI SE TAIT ─────────────────────────────────────
 *
 * IMPACT FORT UNIQUEMENT. Le calendrier publie des dizaines d'événements par
 * jour ; les alerter tous reviendrait à n'en alerter aucun. Seules les
 * publications à fort impact — les « rouges » — justifient d'interrompre.
 *
 * DEUX PRÉAVIS, PAS UN COMPTE À REBOURS. Une heure avant : le temps de décider
 * si l'on se met en dehors. Quinze minutes avant : le rappel de celui qui est
 * déjà en position. Entre les deux, silence.
 *
 * UN SEUL RAPPEL PAR PRÉAVIS ET PAR ÉVÉNEMENT. La clé porte l'identifiant de
 * l'événement ET le préavis, donc réévaluer les règles toutes les minutes ne
 * produit pas soixante alertes.
 *
 * RIEN APRÈS L'HEURE. Un événement passé n'a plus de préavis à donner ; le
 * signaler ferait douter de tous les autres.
 */

/** Les deux préavis, en minutes. Du plus lointain au plus proche. */
export const PREAVIS_MIN = [60, 15] as const;

/**
 * Marge de tolérance autour d'un préavis, en minutes.
 *
 * Les règles ne sont pas évaluées à la seconde : elles tournent quand le trader
 * ouvre l'application ou quand une tâche planifiée passe. Exiger exactement
 * « 60 minutes restantes » ne déclencherait donc presque jamais. La fenêtre
 * s'ouvre au préavis et se referme à la moitié du temps restant suivant — assez
 * large pour être attrapée, assez étroite pour que l'alerte reste juste.
 */
const TOLERANCE_MIN = 10;

export interface AlerteEco {
  event: CalendarEvent;
  /** Le préavis qui a déclenché, en minutes. */
  preavis: number;
  /** Minutes réellement restantes au moment de l'évaluation. */
  restant: number;
}

/**
 * Les alertes qui DEVRAIENT exister à cet instant — fonction pure.
 *
 * Rendre les alertes plutôt que de notifier permet de tester la décision sans
 * monter le moteur, et laisse l'appelant choisir ses canaux.
 */
export function alertesEconomiquesImminentes(
  events: CalendarEvent[],
  now: Date = new Date(),
): AlerteEco[] {
  const maintenant = now.getTime();
  const out: AlerteEco[] = [];

  for (const e of events) {
    // Un événement sans heure précise n'a pas de préavis à donner : « dans la
    // journée » ne se compte pas en minutes.
    if (e.allDay) continue;
    if (e.impact !== "high") continue;

    const t = new Date(e.startsAt).getTime();
    if (Number.isNaN(t)) continue;

    const restantMin = (t - maintenant) / 60_000;
    // Passé, ou en cours : plus rien à annoncer.
    if (restantMin <= 0) continue;

    for (const preavis of PREAVIS_MIN) {
      if (restantMin <= preavis && restantMin > preavis - TOLERANCE_MIN) {
        out.push({ event: e, preavis, restant: Math.round(restantMin) });
        // Un seul préavis par passage : à 14 minutes, on est dans la fenêtre
        // des 15 et plus dans celle des 60. Sans ce `break`, un événement
        // pourrait porter deux alertes d'un coup si les fenêtres se
        // chevauchaient.
        break;
      }
    }
  }

  /* Le plus urgent d'abord : si deux publications tombent ensemble, c'est celle
     qui arrive le plus tôt qui décide de ce qu'on fait des cinq prochaines
     minutes. */
  return out.sort((a, b) => a.restant - b.restant);
}

/** Le texte d'une alerte, dans la langue du trader. */
function copie(a: AlerteEco, fr: boolean): { title: string; body: string } {
  const heure = new Date(a.event.startsAt).toLocaleTimeString(fr ? "fr-FR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return {
    title: fr
      ? `${a.event.currency} · ${a.event.title} dans ${a.preavis} min`
      : `${a.event.currency} · ${a.event.title} in ${a.preavis} min`,
    body: fr
      ? `Publication à fort impact à ${heure}. Prévois ta position avant, pas pendant.`
      : `High-impact release at ${heure}. Decide on your position before, not during.`,
  };
}

/**
 * Les alertes, prêtes pour le moteur de notifications.
 *
 * CANAUX. Le préavis d'une heure informe (tableau de bord + toast) ; celui de
 * quinze minutes interrompt (push compris). Un événement daté qui arrive dans
 * un quart d'heure est le cas le plus légitime qui soit pour faire sonner un
 * téléphone — et le seul de tout le produit.
 */
export function reglesEconomiques(
  events: CalendarEvent[],
  now: Date = new Date(),
  fr = false,
): CodedRule[] {
  return alertesEconomiquesImminentes(events, now).map((a) => {
    const { title, body } = copie(a, fr);
    const urgent = a.preavis <= 15;
    return {
      // La clé porte l'ÉVÉNEMENT et le PRÉAVIS : réévaluer toutes les minutes
      // ne produit donc pas soixante alertes pour la même publication.
      key: `economic_event:${a.event.id}:${a.preavis}`,
      input: {
        kind: "economic_event" as const,
        title,
        body,
        severity: urgent ? ("warning" as const) : ("info" as const),
        category: "economic" as const,
        channels: urgent
          ? (["dashboard", "toast", "push"] as const).slice()
          : (["dashboard", "toast"] as const).slice(),
        url: "/economic-news",
        dedupKey: `economic_event:${a.event.id}:${a.preavis}`,
        data: {
          eventId: a.event.id,
          currency: a.event.currency,
          startsAt: a.event.startsAt,
          impact: a.event.impact,
          forecast: a.event.forecast,
          previous: a.event.previous,
          ctaLabel: fr ? "Voir le calendrier" : "Open the calendar",
          ctaPage: "economic-news",
        },
      },
    };
  });
}
