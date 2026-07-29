import { createServerFn } from "@tanstack/react-start";
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
  /** `true` quand la dernière tentative a échoué : on sert alors du cache. */
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
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      // Configuration incomplète : on renvoie une charge vide plutôt que de
      // faire tomber la page. Le repli d'affichage est géré côté UI.
      console.error("[economic-calendar] supabase public credentials missing");
      return { events: [], lastSuccessAt: null, stale: true };
    }

    const sb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [eventsResult, syncResult] = await Promise.all([
      sb
        .from("economic_events")
        .select(
          "id, starts_at, currency, country, title, impact, previous, forecast, actual, all_day, source",
        )
        .gte("starts_at", data.from)
        .lt("starts_at", data.to)
        .order("starts_at", { ascending: true }),
      sb
        .from("economic_calendar_sync")
        .select("last_success_at, last_error")
        .eq("id", true)
        .maybeSingle(),
    ]);

    if (eventsResult.error) {
      console.error("[economic-calendar] read failed", eventsResult.error);
      return { events: [], lastSuccessAt: null, stale: true };
    }

    return {
      events: ((eventsResult.data ?? []) as EventRow[]).map(rowToEvent),
      lastSuccessAt: syncResult.data?.last_success_at ?? null,
      stale: !!syncResult.data?.last_error,
    };
  });
