// ============================================================
//  Forex Factory calendar — server-side fetch, normalise, cache.
// ------------------------------------------------------------
//  Source: the JSON calendar export Forex Factory publishes for syndication
//  (nfs.faireconomy.media). It is the feed FF provides *for* third-party use —
//  we never scrape the HTML site, so there is no ToS problem here.
//
//  What the feed actually is, verified against it on 2026-07-29:
//    - Only `ff_calendar_thisweek.json` exists. The old `_lastweek` and
//      `_nextweek` companions now return 404, so live coverage is exactly one
//      week: the current Sunday→Saturday window in US Eastern.
//    - It carries title, country, ET timestamp, impact, forecast and previous.
//      It does NOT publish `actual` — not even for releases two days past. The
//      field is still parsed (harmless, and a future source may supply it) but
//      the UI must treat "no actual" as the normal case, not an error.
//    - It is rate-limited behind Cloudflare and answers 429 with `Retry-After`
//      (observed: ~271s). Every caching decision below exists because of that:
//      hammering this endpoint gets the whole deployment throttled.
//
//  Anything outside the current week falls back to the offline rules-based
//  schedule, so the page is never empty and never blocks on the network. The
//  response reports which source it used and the UI credits it accordingly.
//
//  Caching is two-tier:
//    1. In-process memo — survives across requests on a warm serverless
//       instance, so most requests never touch the network.
//    2. CDN, via Cache-Control on the response — this is what actually keeps us
//       under the rate limit, since every edge hit is an origin fetch avoided.
// ============================================================

import {
  addDays,
  asCurrency,
  getEventsForWeek,
  isoDate,
  noteForEvent,
  startOfWeek,
  type EconomicEvent,
  type EconomicWeek,
  type ImpactLevel,
} from "@/tradevault/utils/economicEvents";

const FEED_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

/** How long a successful fetch is trusted. The feed itself only moves a few
 *  times a day; anything shorter just burns rate-limit budget. */
const TTL_MS = 30 * 60 * 1000;
/** Fallback wait after a failure that carried no usable `Retry-After`. */
const DEFAULT_BACKOFF_MS = 5 * 60 * 1000;
/** A slow feed must never hold the page hostage — fall back instead. */
const FETCH_TIMEOUT_MS = 6000;

/** Raw shape of a feed entry. Every field but `title`/`date` can be absent or "". */
interface FeedEntry {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  forecast?: string;
  previous?: string;
  actual?: string;
}

interface CacheSlot {
  events: EconomicEvent[];
  /** Epoch ms of the last *successful* fetch. 0 = never succeeded. */
  fetchedAt: number;
  /** Epoch ms before which we must not retry (rate limit / backoff). */
  retryAfter: number;
}

let slot: CacheSlot = { events: [], fetchedAt: 0, retryAfter: 0 };
/** De-dupes concurrent fetches within one instance. */
let inflight: Promise<CacheSlot> | null = null;

function mapImpact(raw: string | undefined): ImpactLevel {
  switch ((raw ?? "").toLowerCase()) {
    case "high":
      return "high";
    case "medium":
      return "medium";
    // "Holiday" and anything unrecognised are day-long markers, not releases.
    default:
      return "low";
  }
}

/** Stable id so React keys and the expanded-row state survive a refetch. */
function eventId(iso: string, currency: string, title: string): string {
  return `ff-${iso}-${currency}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-");
}

/** Feed value fields use "" for "not published" — normalise those away. */
function value(raw: string | undefined): string | undefined {
  const v = (raw ?? "").trim();
  return v === "" ? undefined : v;
}

function normalise(entries: FeedEntry[]): EconomicEvent[] {
  const out: EconomicEvent[] = [];
  for (const e of entries) {
    const title = (e.title ?? "").trim();
    const currency = asCurrency(e.country ?? "");
    if (!title || !currency || !e.date) continue;

    const at = new Date(e.date);
    if (Number.isNaN(at.getTime())) continue;

    // Feed timestamps are US Eastern with an explicit offset. Derive the ET
    // wall-clock parts from that offset so the fallback formatter still works
    // for any client that ignores `at`.
    const offsetMatch = /([+-])(\d{2}):(\d{2})$/.exec(e.date);
    const offsetMin = offsetMatch
      ? (offsetMatch[1] === "-" ? -1 : 1) * (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3]))
      : -5 * 60;
    const et = new Date(at.getTime() + offsetMin * 60_000);
    const etDateIso = `${et.getUTCFullYear()}-${String(et.getUTCMonth() + 1).padStart(2, "0")}-${String(et.getUTCDate()).padStart(2, "0")}`;
    const etHour = et.getUTCHours();
    const etMinute = et.getUTCMinutes();

    const impact = mapImpact(e.impact);
    // Day-long entries (holidays, all-day windows) land exactly on midnight ET.
    const allDay = etHour === 0 && etMinute === 0;

    out.push({
      id: eventId(etDateIso, currency, title),
      date: etDateIso,
      etHour,
      etMinute,
      currency,
      name: title,
      impact,
      // Feed times are the publisher's confirmed schedule, not our heuristic.
      approximate: false,
      note: noteForEvent(title, impact),
      at: at.toISOString(),
      actual: value(e.actual),
      forecast: value(e.forecast),
      previous: value(e.previous),
      ...(allDay ? { allDay: true } : {}),
    });
  }
  return out.sort(
    (a, b) => a.date.localeCompare(b.date) || a.etHour - b.etHour || a.etMinute - b.etMinute,
  );
}

async function fetchFeed(): Promise<EconomicEvent[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(FEED_URL, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "TradeVault/1.0 (+https://tradevault.be)",
      },
    });

    if (res.status === 429) {
      // Honour the publisher's own backoff rather than guessing.
      const retry = Number(res.headers.get("retry-after"));
      const wait = Number.isFinite(retry) && retry > 0 ? retry * 1000 : DEFAULT_BACKOFF_MS;
      const err = new Error(`rate limited, retry in ${Math.round(wait / 1000)}s`);
      (err as Error & { retryAfterMs?: number }).retryAfterMs = wait;
      throw err;
    }
    if (!res.ok) throw new Error(`feed responded ${res.status}`);

    const json: unknown = await res.json();
    if (!Array.isArray(json)) throw new Error("feed returned a non-array payload");
    return normalise(json as FeedEntry[]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Current cache slot, refreshing it when stale and allowed.
 * Never throws: a failed refresh keeps serving whatever we already hold.
 */
async function loadFeed(force = false): Promise<CacheSlot> {
  const now = Date.now();
  const fresh = slot.fetchedAt > 0 && now - slot.fetchedAt < TTL_MS;
  const blocked = now < slot.retryAfter;

  if ((fresh && !force) || blocked) return slot;
  if (inflight) return inflight;

  inflight = fetchFeed()
    .then((events) => {
      slot = { events, fetchedAt: Date.now(), retryAfter: 0 };
      return slot;
    })
    .catch((err: Error & { retryAfterMs?: number }) => {
      console.error("[economic-calendar] feed fetch failed:", err.message);
      // Keep the previous events (stale beats empty) and stop retrying for a while.
      slot = {
        ...slot,
        retryAfter: Date.now() + (err.retryAfterMs ?? DEFAULT_BACKOFF_MS),
      };
      return slot;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/**
 * Events for the 7 days starting at `weekStartIso` (a Monday).
 * Returns the feed when it covers the range, the offline schedule otherwise.
 */
export async function getEconomicWeek(
  weekStartIso: string,
  options: { force?: boolean } = {},
): Promise<EconomicWeek> {
  const [y, m, d] = weekStartIso.split("-").map(Number);
  const weekStart = new Date(y, m - 1, d);
  const endIso = isoDate(addDays(weekStart, 6));

  const current = await loadFeed(options.force);
  const inRange = current.events.filter((e) => e.date >= weekStartIso && e.date <= endIso);

  // The feed only covers the current Sunday→Saturday window. An empty slice
  // means the user navigated outside it (or the feed is down) — either way the
  // offline schedule is the right answer, and the UI says so.
  if (inRange.length > 0) {
    return {
      events: inRange,
      source: "forexfactory",
      fetchedAt: new Date(current.fetchedAt || Date.now()).toISOString(),
    };
  }

  return {
    events: await getEventsForWeek(weekStart),
    source: "builtin",
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * GET /api/economic-calendar?week=YYYY-MM-DD
 *
 * Public, unauthenticated and identical for every viewer, so it is cached at
 * the edge. That CDN layer is load-bearing: it is what keeps origin fetches
 * rare enough to stay under Forex Factory's rate limit.
 */
export async function handleEconomicCalendar(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const requested = url.searchParams.get("week");
  const weekStartIso =
    requested && /^\d{4}-\d{2}-\d{2}$/.test(requested)
      ? requested
      : isoDate(startOfWeek(new Date()));

  const week = await getEconomicWeek(weekStartIso);

  return new Response(JSON.stringify({ weekStart: weekStartIso, ...week }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Feed-backed weeks refresh on the CDN every 15 min; the offline schedule
      // is deterministic, so it can be cached for far longer.
      "cache-control":
        week.source === "forexfactory"
          ? "public, max-age=300, s-maxage=900, stale-while-revalidate=86400"
          : "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}

/**
 * GET /api/cron/economic-calendar — daily freshness check (Vercel cron).
 *
 * Forces one refresh (bypassing the TTL but still respecting an active
 * rate-limit backoff — clearing the cache outright would be the fastest way to
 * get throttled) and asserts the feed still covers the current week. A non-200
 * surfaces in the Vercel cron log the day the feed changes shape or moves,
 * instead of the calendar quietly degrading to the offline schedule.
 */
export async function handleEconomicCalendarCron(_request: Request): Promise<Response> {
  const weekStartIso = isoDate(startOfWeek(new Date()));
  const week = await getEconomicWeek(weekStartIso, { force: true });

  const ok = week.source === "forexfactory" && week.events.length > 0;
  const body = {
    ok,
    weekStart: weekStartIso,
    source: week.source,
    events: week.events.length,
    highImpact: week.events.filter((e) => e.impact === "high").length,
    fetchedAt: week.fetchedAt,
    ...(ok ? {} : { error: "Forex Factory feed unavailable — serving the offline schedule" }),
  };
  if (!ok) console.error("[economic-calendar] daily check failed", body);

  return new Response(JSON.stringify(body), {
    status: ok ? 200 : 503,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
