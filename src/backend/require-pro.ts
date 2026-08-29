import { createMiddleware } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isEntitled, type EntitlementRow } from "@/domain/entitlement";

// Réexporté pour que le point d'entrée serveur reste le seul import des
// appelants historiques ; la DÉFINITION, elle, vit dans `domain/entitlement`.
export { isEntitled };
export type { EntitlementRow };

// Server-side entitlement gate for the expensive AI endpoints. Chains after
// `requireSupabaseAuth`, so the request is already authenticated and the
// per-request `context.supabase` (RLS-scoped to the caller) + `userId` are
// available. It enforces two things:
//
//   1. an active entitlement — a paid plan, or a signup trial still running;
//   2. a per-user hourly rate limit on AI calls (atomic fixed-window in SQL).
//
// The entitlement check FAILS CLOSED: if the DB cannot be read, the user is
// denied access rather than silently let through. This is a hard business
// requirement — the paywall must never be bypassable during an outage.
// The rate-limit check (cost/abuse protection, not a paywall) still fails
// open: a transient RPC failure lets the request through.
// The matching migration adds `ai_rate_limits` + `consume_ai_quota`.

const RATE_LIMIT_PER_HOUR = Number(process.env.AI_RATE_LIMIT_PER_HOUR ?? "60");

// Monetization switch. While the product is in free early access, entitlement
// enforcement stays OFF: every authenticated user gets full AI access. The
// rate limit below still runs (it is abuse/cost protection, not a paywall).
// Flip AI_REQUIRE_PRO="true" — one env var, zero code change — to turn on paid
// gating when subscriptions launch.
const REQUIRE_PRO = process.env.AI_REQUIRE_PRO === "true";

/** Thrown when the caller has no active plan or trial. Surfaces to the client
 *  so the UI can prompt an upgrade. */
class ProRequiredError extends Error {
  constructor() {
    super("PRO_REQUIRED: an active TradeVault Pro plan or trial is required to use AI features.");
    this.name = "ProRequiredError";
  }
}

/** Thrown when the caller exceeds their hourly AI quota. */
class RateLimitError extends Error {
  constructor() {
    super("RATE_LIMITED: too many AI requests in a short window — please wait a moment.");
    this.name = "RateLimitError";
  }
}

/**
 * Les colonnes dont dépend la décision d'accès.
 *
 * `plan`, `source` et `current_period_end` ont été AJOUTÉES : sans elles,
 * `isEntitled` ne pouvait pas voir qu'une période payée était écoulée, et un
 * abonnement crypto d'un mois ouvrait l'accès pour toujours (audit P0-2).
 */
const ENTITLEMENT_COLS = "plan, status, source, trial_ends_at, current_period_end";

export const requireProAccess = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { supabase, userId } = context;

    // 1) Entitlement — enforced only when monetization is switched on. During
    //    free early access this whole block is skipped, so every signed-in
    //    user has full AI access.
    //    Fail-closed on DB error: if we can't read subscriptions, deny access.
    if (REQUIRE_PRO) {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(ENTITLEMENT_COLS)
        .eq("user_id", userId)
        .maybeSingle();
      if (error || !isEntitled(data)) throw new ProRequiredError();
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
