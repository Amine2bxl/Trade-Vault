import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { activeProvider, type CalendarEvent } from "@/modules/economic-calendar";

// ============================================================
//  Synchronisation du calendrier économique.
// ------------------------------------------------------------
//  Un seul chemin d'écriture : ce fichier, exécuté par le cron Vercel avec la
//  clé service role. Aucune requête utilisateur ne déclenche jamais un appel à
//  la source — c'est ce qui rend le plafond de requêtes du fournisseur (2 / 5
//  min) sans objet, et le temps de réponse de la page indépendant de lui.
//
//  Règle de survie : un échec ne détruit rien. Les lignes déjà en base restent
//  servies, l'erreur est journalisée, le cron suivant réessaie. La page ne peut
//  pas devenir vide à cause d'un incident réseau.
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyClient = SupabaseClient<any, any, any>;

export interface SyncResult {
  ok: boolean;
  upserted: number;
  error?: string;
}

function serviceClient(): AnyClient | null {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function toRow(event: CalendarEvent) {
  return {
    id: event.id,
    starts_at: event.startsAt,
    currency: event.currency,
    country: event.country,
    title: event.title,
    impact: event.impact,
    previous: event.previous,
    forecast: event.forecast,
    actual: event.actual,
    all_day: event.allDay,
    source: event.source,
    updated_at: new Date().toISOString(),
  };
}

async function recordAttempt(sb: AnyClient, patch: Record<string, unknown>): Promise<void> {
  // Le suivi d'état est du confort de diagnostic : s'il échoue, la synchro
  // reste valide. On ne laisse jamais une écriture de télémétrie casser le run.
  const { error } = await sb
    .from("economic_calendar_sync")
    .upsert({ id: true, ...patch }, { onConflict: "id" });
  if (error) console.error("[economic-calendar] sync state write failed", error);
}

/**
 * Récupère la fenêtre courante chez le fournisseur et la fusionne dans le cache.
 *
 * L'upsert est volontairement additif : on ne supprime aucune ligne existante.
 * Un événement retiré du flux garde donc sa dernière valeur connue plutôt que
 * de disparaître de l'historique — et `actual` se remplit tout seul au fil des
 * passages, puisque la clé primaire est stable.
 */
export async function syncEconomicCalendar(): Promise<SyncResult> {
  const sb = serviceClient();
  if (!sb) {
    return { ok: false, upserted: 0, error: "supabase service credentials missing" };
  }

  const attemptAt = new Date().toISOString();

  let events: CalendarEvent[];
  try {
    events = await activeProvider.fetchEvents();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[economic-calendar] provider fetch failed", error);
    // `consecutive_failures` s'incrémente via une lecture-écriture simple : la
    // concurrence est nulle (un seul cron), une transaction serait du zèle.
    const { data } = await sb
      .from("economic_calendar_sync")
      .select("consecutive_failures")
      .eq("id", true)
      .maybeSingle();
    await recordAttempt(sb, {
      last_attempt_at: attemptAt,
      last_error: message,
      consecutive_failures: (data?.consecutive_failures ?? 0) + 1,
    });
    return { ok: false, upserted: 0, error: message };
  }

  if (events.length === 0) {
    // Un flux vide est suspect (jour férié mondial mis à part) : on le traite en
    // échec pour ne pas écraser une bonne synchro par un silence.
    const message = "provider returned no events";
    console.warn(`[economic-calendar] ${message}`);
    await recordAttempt(sb, { last_attempt_at: attemptAt, last_error: message });
    return { ok: false, upserted: 0, error: message };
  }

  const { error } = await sb
    .from("economic_events")
    .upsert(events.map(toRow), { onConflict: "id" });

  if (error) {
    console.error("[economic-calendar] upsert failed", error);
    await recordAttempt(sb, { last_attempt_at: attemptAt, last_error: error.message });
    return { ok: false, upserted: 0, error: error.message };
  }

  await recordAttempt(sb, {
    last_attempt_at: attemptAt,
    last_success_at: attemptAt,
    last_error: null,
    consecutive_failures: 0,
    events_upserted: events.length,
  });

  return { ok: true, upserted: events.length };
}

/**
 * Délai minimal entre deux synchros déclenchées par la consultation de la page.
 * 10 min laisse une marge confortable sous le plafond de la source (~2 requêtes
 * / 5 min, et une synchro en consomme deux), quel que soit le nombre de
 * lecteurs simultanés.
 */
const REFRESH_THROTTLE_MS = 10 * 60_000;

/**
 * Rafraîchissement opportuniste, déclenché par la lecture de la page.
 *
 * Le plan Vercel de ce projet ne permet qu'UN passage de cron par jour — trop
 * lent pour voir arriver les valeurs réelles. La consultation prend donc le
 * relais : la première visite après 10 minutes de silence relance une synchro.
 * Personne n'attend le résultat (la page est servie depuis le cache), et
 * personne ne déclenche deux synchros en même temps.
 *
 * L'anti-concurrence est un compare-and-swap : on ne réserve le créneau que si
 * l'écriture conditionnelle de `last_attempt_at` touche effectivement la ligne.
 * Deux requêtes simultanées ne peuvent pas gagner toutes les deux.
 */
export async function syncIfStale(): Promise<void> {
  const sb = serviceClient();
  if (!sb) return;

  const cutoff = new Date(Date.now() - REFRESH_THROTTLE_MS).toISOString();
  const { data, error } = await sb
    .from("economic_calendar_sync")
    .update({ last_attempt_at: new Date().toISOString() })
    .eq("id", true)
    .or(`last_attempt_at.is.null,last_attempt_at.lt.${cutoff}`)
    .select("id");

  if (error) {
    console.error("[economic-calendar] refresh claim failed", error);
    return;
  }
  // Créneau déjà pris par quelqu'un d'autre : il n'y a rien à faire.
  if (!data || data.length === 0) return;

  await syncEconomicCalendar();
}

/**
 * Purge des événements trop anciens pour intéresser qui que ce soit. Le cache
 * doit rester borné : sans cela la table grossit indéfiniment pour une donnée
 * que personne ne consulte.
 */
async function pruneOldEvents(sb: AnyClient): Promise<void> {
  const cutoff = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const { error } = await sb.from("economic_events").delete().lt("starts_at", cutoff);
  if (error) console.error("[economic-calendar] prune failed", error);
}

/** Point d'entrée cron Vercel (voir src/server.ts). */
export async function handleEconomicCalendarCron(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const result = await syncEconomicCalendar();

  const sb = serviceClient();
  if (sb && result.ok) await pruneOldEvents(sb);

  // 200 même en échec : le cache précédent est toujours servi, l'incident est
  // journalisé, et un 500 ne ferait que déclencher des alertes pour une
  // situation que le prochain passage corrige de lui-même.
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
