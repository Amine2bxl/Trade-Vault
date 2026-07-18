import { createMiddleware } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Server-side entitlement gate for the expensive AI endpoints. Chains after
// `requireSupabaseAuth`, so the request is already authenticated and the
// per-request `context.supabase` (RLS-scoped to the caller) + `userId` are
// available. It enforces two things:
//
//   1. an active entitlement — a paid plan, or a signup trial still running;
//   2. a per-user hourly rate limit on AI calls (atomic fixed-window in SQL).
//
// Both checks FAIL OPEN on infrastructure errors: a transient DB problem, or a
// migration not yet applied, must never lock a paying user out of the product.
// They deny only on a definitively-read "no entitlement" / "quota exceeded"
// outcome. The matching migration adds `ai_rate_limits` + `consume_ai_quota`.

const RATE_LIMIT_PER_HOUR = Number(process.env.AI_RATE_LIMIT_PER_HOUR ?? "60");

/** Thrown when the caller has no active plan or trial. Surfaces to the client
 *  so the UI can prompt an upgrade. */
export class ProRequiredError extends Error {
  constructor() {
    super("PRO_REQUIRED: an active TradeVault Pro plan or trial is required to use AI features.");
    this.name = "ProRequiredError";
  }
}

/** Thrown when the caller exceeds their hourly AI quota. */
export class RateLimitError extends Error {
  constructor() {
    super("RATE_LIMITED: too many AI requests in a short window — please wait a moment.");
    this.name = "RateLimitError";
  }
}

type EntitlementRow = { status?: string | null; trial_ends_at?: string | null } | null;

/** Pure predicate: is this subscription row an active entitlement right now?
 *  Deterministic and side-effect-free so it is trivially testable. */
export function isEntitled(row: EntitlementRow): boolean {
  if (!row) return false;
  if (row.status === "active") return true;
  if (row.status === "trialing") {
    return !!row.trial_ends_at && new Date(row.trial_ends_at).getTime() > Date.now();
  }
  return false;
}

export const requireProAccess = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { supabase, userId } = context;

    // 1) Entitlement — the caller reads their own row under RLS.
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("status, trial_ends_at")
        .eq("user_id", userId)
        .maybeSingle();
      // On a read error we fail open (transient infra); we deny only when the
      // row was read successfully and is not an active entitlement.
      if (!error && !isEntitled(data)) throw new ProRequiredError();
    } catch (e) {
      if (e instanceof ProRequiredError) throw e;
      // Unexpected failure → fail open rather than block a legitimate user.
    }

    // 2) Rate limit — atomic fixed-window counter in Postgres.
    try {
      const { data: allowed, error } = await (supabase as unknown as SupabaseClient).rpc(
        "consume_ai_quota",
        { p_limit: RATE_LIMIT_PER_HOUR, p_window_seconds: 3600 },
      );
      // `allowed === false` is a definitive deny; an error (e.g. the function
      // isn't deployed yet) fails open.
      if (!error && allowed === false) throw new RateLimitError();
    } catch (e) {
      if (e instanceof RateLimitError) throw e;
      // Unexpected failure → fail open.
    }

    return next();
  });
