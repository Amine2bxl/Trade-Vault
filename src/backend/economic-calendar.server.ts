import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  activeProvider,
  fetchForexFactoryWeek,
  type CalendarEvent,
} from "@/modules/economic-calendar";
import { isWeekStart, previousWeekStarts } from "@/domain/tradeNews";

// ============================================================
//  Synchronisation du calendrier économique.
// ------------------------------------------------------------
//  Un seul chemin d'écriture : ce fichier, exécuté avec la clé service role,
//  par le cron quotidien ou par le rafraîchissement opportuniste. Deux requêtes
//  vers la source au maximum toutes les 10 minutes — le plafond du fournisseur
//  (~2 fichiers / 5 min) est respecté par construction, pas par chance.
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
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
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

  // `actual` est écrit SÉPARÉMENT, et jamais en null.
  //
  // Les fichiers de la source ne portent pas tous la valeur publiée : celui de
  // la semaine en cours ne la donne jamais. Un upsert unique incluant la
  // colonne l'écraserait donc à chaque passage, effaçant une valeur déjà
  // connue. En omettant la colonne du premier lot, PostgREST ne la touche pas
  // du tout ; le second lot ne concerne que les événements pour lesquels la
  // source a effectivement publié un chiffre.
  const { error } = await sb.from("economic_events").upsert(events.map(toRow), {
    onConflict: "id",
  });

  if (error) {
    console.error("[economic-calendar] upsert failed", error);
    await recordAttempt(sb, { last_attempt_at: attemptAt, last_error: error.message });
    return { ok: false, upserted: 0, error: error.message };
  }

  const released = events.filter((event) => event.actual !== null);
  if (released.length > 0) {
    const { error: actualError } = await sb.from("economic_events").upsert(
      released.map((event) => ({ ...toRow(event), actual: event.actual })),
      {
        onConflict: "id",
      },
    );
    // Non bloquant : le calendrier reste juste, il lui manque des valeurs
    // réelles. Mieux vaut cela qu'une synchro marquée en échec.
    if (actualError) console.error("[economic-calendar] actual upsert failed", actualError);
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
 * Ce visiteur-là l'attend (une lambda gelée n'exécute pas de promesse
 * détachée), les autres lisent le cache sans rien payer.
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
/* LA RÉTENTION SUIT L'USAGE.
   Les annonces à impact fort et moyen restent TROIS ANS : elles donnent à
   chaque trade le contexte de sa journée (TradeModal) et nourrissent l'analyse
   « jours d'annonces » — le flux Forex Factory ne publie que la semaine en
   cours, l'historique n'existe donc que si on le garde. Le reste (impact
   faible, jours fériés) part après 90 jours, comme avant. */
async function pruneOldEvents(sb: AnyClient): Promise<void> {
  const minor = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const all = new Date(Date.now() - 3 * 365 * 86_400_000).toISOString();
  const { error } = await sb
    .from("economic_events")
    .delete()
    .lt("starts_at", minor)
    .in("impact", ["low", "holiday"]);
  if (error) console.error("[economic-calendar] prune (minor) failed", error);
  const { error: oldError } = await sb.from("economic_events").delete().lt("starts_at", all);
  if (oldError) console.error("[economic-calendar] prune (old) failed", oldError);
}

// ── HISTORIQUE : les semaines passées, une page à la fois ────────────────────
//
// Le flux officiel ne publie que la semaine en cours. Pour qu'un trade ancien
// retrouve les annonces de sa journée, les semaines passées sont lues sur les
// pages hebdomadaires de la source (`forex-factory-history.ts`) et rangées dans
// le même cache. Le registre `economic_calendar_backfill` retient ce qui a été
// tenté : une semaine réussie n'est plus jamais redemandée, un échec n'est
// retenté qu'après une semaine, trois fois au plus.

/** Écart minimal entre deux pages demandées à la source, tous appelants confondus. */
const BACKFILL_SPACING_MS = 20_000;
/** Délai avant de retenter une semaine en échec. */
const BACKFILL_RETRY_MS = 7 * 86_400_000;
const BACKFILL_MAX_ATTEMPTS = 3;
/** Au-delà de ce nombre d'annonces fortes/moyennes, une semaine est déjà connue. */
const WEEK_KNOWN_MIN_EVENTS = 10;

export type BackfillOutcome = "filled" | "known" | "busy" | "skipped" | "failed";

interface BackfillRow {
  week_start: string;
  attempted_at: string;
  succeeded: boolean;
  attempts: number;
}

/* Si le registre n'existe pas encore (migration pas appliquée), la mémoire de
   l'instance le remplace : moins durable, mais jamais une page de trop. */
const memoryRegistry = new Map<string, BackfillRow>();
let lastPageAt = 0;

async function readRegistry(sb: AnyClient, week: string): Promise<BackfillRow | null> {
  const { data, error } = await sb
    .from("economic_calendar_backfill")
    .select("week_start, attempted_at, succeeded, attempts")
    .eq("week_start", week)
    .maybeSingle();
  if (error) return memoryRegistry.get(week) ?? null;
  return (data as BackfillRow | null) ?? null;
}

async function writeRegistry(
  sb: AnyClient,
  row: BackfillRow & { events?: number; last_error?: string | null },
): Promise<void> {
  memoryRegistry.set(row.week_start, row);
  const { error } = await sb
    .from("economic_calendar_backfill")
    .upsert(row, { onConflict: "week_start" });
  if (error) console.warn("[economic-calendar] backfill registry unavailable", error.message);
}

async function lastRegistryAttempt(sb: AnyClient): Promise<number> {
  const { data, error } = await sb
    .from("economic_calendar_backfill")
    .select("attempted_at")
    .order("attempted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const fromDb = !error && data?.attempted_at ? Date.parse(data.attempted_at as string) : 0;
  return Math.max(fromDb, lastPageAt);
}

/** Nombre d'annonces fortes/moyennes déjà en cache pour la semaine. */
async function knownEventsInWeek(sb: AnyClient, week: string): Promise<number> {
  const from = new Date(`${week}T00:00:00Z`);
  const to = new Date(from.getTime() + 7 * 86_400_000);
  const { count, error } = await sb
    .from("economic_events")
    .select("id", { count: "exact", head: true })
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .in("impact", ["high", "medium"]);
  return error ? 0 : (count ?? 0);
}

/**
 * Récupère UNE semaine passée si elle manque encore. Idempotent : appelé
 * cent fois pour la même semaine, il ne contacte la source qu'une fois.
 */
export async function backfillEconomicWeek(
  week: string,
  opts: { spacingMs?: number } = {},
): Promise<{ outcome: BackfillOutcome; events: number }> {
  const sb = serviceClient();
  if (!sb || !isWeekStart(week)) return { outcome: "skipped", events: 0 };
  // Jamais la semaine en cours ni une semaine future : le flux officiel s'en charge.
  if (Date.parse(`${week}T00:00:00Z`) + 7 * 86_400_000 > Date.now()) {
    return { outcome: "skipped", events: 0 };
  }

  const known = await knownEventsInWeek(sb, week);
  const reg = await readRegistry(sb, week);
  if (reg?.succeeded || known >= WEEK_KNOWN_MIN_EVENTS) {
    if (!reg?.succeeded) {
      await writeRegistry(sb, {
        week_start: week,
        attempted_at: new Date().toISOString(),
        succeeded: true,
        attempts: reg?.attempts ?? 0,
        events: known,
      });
    }
    return { outcome: "known", events: known };
  }
  if (
    reg &&
    (reg.attempts >= BACKFILL_MAX_ATTEMPTS ||
      Date.now() - Date.parse(reg.attempted_at) < BACKFILL_RETRY_MS)
  ) {
    return { outcome: "skipped", events: 0 };
  }

  const spacing = opts.spacingMs ?? BACKFILL_SPACING_MS;
  if (Date.now() - (await lastRegistryAttempt(sb)) < spacing) {
    return { outcome: "busy", events: 0 };
  }

  // Le créneau est réservé AVANT l'appel : un second appelant voit la page en cours.
  const attemptedAt = new Date().toISOString();
  lastPageAt = Date.now();
  const attempts = (reg?.attempts ?? 0) + 1;
  await writeRegistry(sb, {
    week_start: week,
    attempted_at: attemptedAt,
    succeeded: false,
    attempts,
  });

  let events: CalendarEvent[];
  try {
    events = await fetchForexFactoryWeek(week);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[economic-calendar] backfill fetch failed", week, message);
    await writeRegistry(sb, {
      week_start: week,
      attempted_at: attemptedAt,
      succeeded: false,
      attempts,
      last_error: message.slice(0, 300),
    });
    return { outcome: "failed", events: 0 };
  }

  // Une semaine passée porte ses valeurs publiées : on les écrit avec le reste.
  const { error } = await sb.from("economic_events").upsert(
    events.map((e) => ({ ...toRow(e), ...(e.actual !== null ? { actual: e.actual } : {}) })),
    { onConflict: "id" },
  );
  if (error) {
    console.error("[economic-calendar] backfill upsert failed", error);
    await writeRegistry(sb, {
      week_start: week,
      attempted_at: attemptedAt,
      succeeded: false,
      attempts,
      last_error: error.message.slice(0, 300),
    });
    return { outcome: "failed", events: 0 };
  }

  await writeRegistry(sb, {
    week_start: week,
    attempted_at: attemptedAt,
    succeeded: true,
    attempts,
    events: events.length,
    last_error: null,
  });
  return { outcome: "filled", events: events.length };
}

/**
 * Le cron remonte le temps, une semaine par passage : la plus récente des
 * semaines passées qui manque encore (trois ans au plus). Les trades anciens
 * retrouvent ainsi leur contexte même si personne ne les rouvre.
 */
async function backfillNextMissingWeek(): Promise<void> {
  const sb = serviceClient();
  if (!sb) return;
  for (const week of previousWeekStarts(new Date(), 156)) {
    const reg = await readRegistry(sb, week);
    if (reg?.succeeded) continue;
    if (reg && reg.attempts >= BACKFILL_MAX_ATTEMPTS) continue;
    const { outcome } = await backfillEconomicWeek(week, { spacingMs: 0 });
    // Déjà connue, ou en attente de son prochain essai : on remonte d'une semaine.
    if (outcome === "known" || outcome === "skipped") continue;
    return;
  }
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
  // Une semaine d'historique par passage, sans jamais faire échouer le cron.
  await backfillNextMissingWeek().catch((e) =>
    console.error("[economic-calendar] cron backfill failed", e),
  );

  // 200 même en échec : le cache précédent est toujours servi, l'incident est
  // journalisé, et un 500 ne ferait que déclencher des alertes pour une
  // situation que le prochain passage corrige de lui-même.
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
