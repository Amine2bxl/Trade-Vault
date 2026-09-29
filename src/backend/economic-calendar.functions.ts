import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { CalendarEvent, EventImpact } from "@/modules/economic-calendar";

// ============================================================
//  Lecture du calendrier économique — SOURCE UNIQUE du frontend.
// ------------------------------------------------------------
//  Toute l'UI passe par ici. Aucun composant ne parle à la source externe, ni
//  même directement à la table : la forme des données est décidée une fois.
//
//  Pas de middleware d'authentification : la donnée est publique et non
//  personnelle. La sécurité tient à ce que la table n'a AUCUNE policy
//  d'écriture — la clé publiable ne peut rien faire d'autre que lire.
// ============================================================

const Input = z.object({
  /** Début de fenêtre, ISO 8601 (inclus). */
  from: z.string().datetime(),
  /** Fin de fenêtre, ISO 8601 (exclue). */
  to: z.string().datetime(),
});

interface EventRow {
  id: string;
  starts_at: string;
  currency: string;
  country: string;
  title: string;
  impact: string;
  previous: string | null;
  forecast: string | null;
  actual: string | null;
  all_day: boolean;
  source: string;
}

export interface EconomicCalendarPayload {
  events: CalendarEvent[];
  /** Dernière synchro réussie — l'UI affiche la fraîcheur réelle, sans mentir. */
  lastSuccessAt: string | null;
  /** `true` quand la dernière synchro réussie de la semaine courante date de plus de 2 h. */
  stale: boolean;
}

function rowToEvent(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    startsAt: row.starts_at,
    currency: row.currency,
    country: row.country,
    title: row.title,
    impact: row.impact as EventImpact,
    previous: row.previous,
    forecast: row.forecast,
    actual: row.actual,
    allDay: row.all_day,
    source: row.source,
  };
}

/**
 * Événements d'une fenêtre temporelle. Le filtrage fin (devise, importance,
 * recherche) reste côté client : une semaine tient dans quelques centaines de
 * lignes, un aller-retour réseau par clic de filtre serait une régression d'UX
 * pour zéro gain.
 */
export const fetchEconomicCalendar = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<EconomicCalendarPayload> => {
    // Les variables côté serveur peuvent manquer sur Vercel (les mêmes valeurs
    // sont exposées en VITE_* pour le client) : on retombe dessus — exactement
    // le même repli que le client/auth. Sans lui, la page afficherait « inactif »
    // sur la preview alors que la base est parfaitement lisible.
    const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      // Configuration incomplète : on renvoie une charge vide plutôt que de
      // faire tomber la page. Le repli d'affichage est géré côté UI.
      console.error("[economic-calendar] supabase public credentials missing");
      return { events: [], lastSuccessAt: null, stale: true };
    }

    const sb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const isCurrentWeek = Date.parse(data.from) <= Date.now() && Date.now() < Date.parse(data.to);

    const readEvents = () =>
      sb
        .from("economic_events")
        .select(
          "id, starts_at, currency, country, title, impact, previous, forecast, actual, all_day, source",
        )
        .gte("starts_at", data.from)
        .lt("starts_at", data.to)
        .order("starts_at", { ascending: true });
    const readSync = () =>
      sb.from("economic_calendar_sync").select("last_success_at").eq("id", true).maybeSingle();

    // 1. LE CACHE D'ABORD — une lecture locale rapide.
    let [eventsResult, syncResult] = await Promise.all([readEvents(), readSync()]);

    if (eventsResult.error) {
      console.error("[economic-calendar] read failed", eventsResult.error);
      return { events: [], lastSuccessAt: null, stale: true };
    }

    // 2. LA SYNCHRO, TENUE EN VIE JUSQU'À SON TERME.
    //
    // Elle était lancée sans être attendue ni déclarée au runtime. Sur Vercel,
    // l'instance est gelée dès la réponse envoyée : la requête vers la source
    // restait suspendue, et au dégel le minuteur l'annulait — « This
    // operation was aborted », une tentative comptée en échec alors que la
    // source répondait très bien. C'était l'origine du bandeau jaune.
    //
    // Désormais la synchro est confiée à `waitUntil` (le runtime la laisse
    // finir après la réponse), et quand le cache a dépassé le délai de
    // rafraîchissement, le visiteur l'attend quelques secondes : la première
    // visite après un silence lit des données fraîches, pas celles d'avant.
    if (isCurrentWeek) {
      const sync = triggerBackgroundSync();
      const age = ageMs(syncResult.data?.last_success_at);
      if (age > REFRESH_DUE_MS || eventsResult.data?.length === 0) {
        const settled = await Promise.race([
          sync.then(() => true),
          new Promise<false>((r) => setTimeout(() => r(false), SYNC_WAIT_MS)),
        ]);
        if (settled) {
          const [e2, s2] = await Promise.all([readEvents(), readSync()]);
          if (!e2.error) eventsResult = e2;
          if (!s2.error) syncResult = s2;
        }
      }
    }

    const events = (eventsResult.data ?? []) as EventRow[];
    const lastSuccessAt = syncResult.data?.last_success_at ?? null;

    return {
      events: events.map(rowToEvent),
      lastSuccessAt,
      // « En retard » se juge sur l'ÂGE des données, pas sur la dernière
      // tentative. Un seul échec réseau passé suffisait à allumer le bandeau
      // alors que la dernière synchro réussie datait de dix minutes. Une autre
      // semaine que la courante n'a rien à attendre de la source : jamais
      // « en retard ».
      stale: isCurrentWeek && ageMs(lastSuccessAt) > STALE_AFTER_MS,
    };
  });

/** Au-delà, une synchro est due : le visiteur l'attend (dans la limite de `SYNC_WAIT_MS`). */
const REFRESH_DUE_MS = 15 * 60_000;
/** Attente maximale d'une synchro par le visiteur — la source répond en < 1 s. */
const SYNC_WAIT_MS = 4_000;
/**
 * Au-delà, les données sont dites en retard. Deux heures : plusieurs
 * tentatives (une toutes les 10 min au plus) ont forcément échoué d'affilée —
 * un vrai problème de source, que l'on montre, et plus un hoquet.
 */
export const STALE_AFTER_MS = 2 * 60 * 60_000;

function ageMs(iso: string | null | undefined): number {
  if (!iso) return Infinity;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Infinity : Date.now() - t;
}

/**
 * Déclare une promesse au runtime pour qu'il la laisse aboutir après la
 * réponse. Même contrat que `waitUntil` de `@vercel/functions`, sans la
 * dépendance : le runtime Node de Vercel expose le contexte de la requête sur
 * ce symbole global ; le runtime « web » (et Nitro) le pose sur la requête.
 * Ailleurs (dev, preview locale) le processus vit de toute façon.
 */
function keepAlive(promise: Promise<unknown>): void {
  try {
    const ctx = (
      globalThis as { [k: symbol]: { get?: () => { waitUntil?: (p: Promise<unknown>) => void } } }
    )[Symbol.for("@vercel/request-context")]?.get?.();
    if (ctx?.waitUntil) return ctx.waitUntil(promise);
    const req = getRequest() as Request & { waitUntil?: (p: Promise<unknown>) => void };
    req.waitUntil?.(promise);
  } catch {
    /* hors contexte de requête : rien à déclarer */
  }
}

/**
 * Synchronisation opportuniste déclenchée par la lecture, sans bloquer la
 * réponse. Une seule synchro en vol à la fois : les visites suivantes pendant
 * qu'elle tourne la réutilisent au lieu d'en lancer une seconde. Voir le
 * commentaire dans le handler pour la justification complète.
 */
let pendingSync: Promise<void> | null = null;

function triggerBackgroundSync(): Promise<void> {
  if (pendingSync) return pendingSync;
  const run = async () => {
    try {
      const { syncIfStale } = await import("./economic-calendar.server");
      await syncIfStale();
    } catch (error) {
      console.error("[economic-calendar] opportunistic sync failed", error);
    }
  };
  pendingSync = run().finally(() => {
    pendingSync = null;
  });
  keepAlive(pendingSync);
  return pendingSync;
}
