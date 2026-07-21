/**
 * Product analytics — first-party, dependency-free PostHog HTTP capture.
 *
 * Why no SDK: adding npm dependencies is blocked (registry egress, issue #46),
 * and the capture API is a single POST. This util is a silent no-op when
 * VITE_POSTHOG_KEY is absent, so dev/preview environments send nothing.
 *
 * Privacy rules (non-negotiable):
 *   - NEVER send trading data (PnL, symbols, balances) or free-text content.
 *   - Respect the user's opt-out (localStorage flag) and Do Not Track.
 *   - The distinct id is the Supabase user id (already pseudonymous).
 */

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://eu.i.posthog.com";

const OPTOUT_KEY = "tv-analytics-optout";

export type AnalyticsEvent =
  | "session_start"
  | "signup"
  | "onboarding_step"
  | "onboarding_completed"
  | "first_trade_logged"
  | "trade_logged"
  | "coach_message_sent"
  | "checklist_completed"
  | "discipline_score_computed"
  | "streak_milestone"
  | "streak_broken";

let distinctId: string | null = null;

export function identifyAnalytics(userId: string | null): void {
  distinctId = userId;
}

export function analyticsOptedOut(): boolean {
  try {
    if (typeof navigator !== "undefined" && navigator.doNotTrack === "1") return true;
    return typeof localStorage !== "undefined" && localStorage.getItem(OPTOUT_KEY) === "1";
  } catch {
    return true;
  }
}

export function setAnalyticsOptOut(optOut: boolean): void {
  try {
    if (optOut) localStorage.setItem(OPTOUT_KEY, "1");
    else localStorage.removeItem(OPTOUT_KEY);
  } catch {
    // Storage unavailable — nothing to persist.
  }
}

/** Fire-and-forget capture. Never throws, never blocks the UI. */
export function track(
  event: AnalyticsEvent,
  properties?: Record<string, string | number | boolean>,
): void {
  if (!KEY || analyticsOptedOut() || typeof fetch === "undefined") return;
  try {
    void fetch(`${HOST.replace(/\/$/, "")}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        api_key: KEY,
        event,
        distinct_id: distinctId ?? "anonymous",
        properties: { ...properties, app: "tradevault" },
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {});
  } catch {
    // Analytics must never surface an error.
  }
}
