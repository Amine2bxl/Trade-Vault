import { createMiddleware } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { effectiveTier, isEntitled, type EntitlementRow } from "@/domain/entitlement";
import { LIMITS } from "@/domain/plans";

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

/** Levée quand le quota QUOTIDIEN du palier est épuisé. Distincte de
 *  `RateLimitError` : celle-ci est un moment de vente (« passe au palier
 *  supérieur »), l'autre est un « reviens dans un instant ». */
class DailyQuotaError extends Error {
  constructor() {
    super("DAILY_QUOTA_REACHED: today's Jarvis allowance for this plan is used up.");
    this.name = "DailyQuotaError";
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

    // ── 1) La ligne d'abonnement ────────────────────────────────────────────
    //
    // Lue SYSTÉMATIQUEMENT, et plus seulement quand le paywall est actif : le
    // quota quotidien de Jarvis dépend du PALIER, et le palier vient de cette
    // ligne. Une lecture sur clé primaire indexée, une par appel IA — négligeable
    // devant l'appel modèle qui suit.
    const { data: row, error: rowError } = await supabase
      .from("subscriptions")
      .select(ENTITLEMENT_COLS)
      .eq("user_id", userId)
      .maybeSingle();

    // ── 2) Entitlement ──────────────────────────────────────────────────────
    //
    // Appliqué uniquement quand la monétisation est activée. Pendant l'accès
    // anticipé gratuit, ce bloc est sauté et tout compte connecté a l'IA.
    // ÉCHOUE FERMÉ sur erreur de lecture : un paywall qui s'ouvre pendant une
    // panne n'est pas un paywall.
    if (REQUIRE_PRO) {
      if (rowError || !isEntitled(row)) throw new ProRequiredError();
    }

    // ── 3) Quota QUOTIDIEN par palier ───────────────────────────────────────
    //
    // 3 requêtes/jour en gratuit, 20 en Pro, aucune limite en Elite — les
    // chiffres viennent du catalogue (`domain/plans.ts`), donc changer l'offre
    // ne demande aucune modification ici.
    //
    // Ce quota était compté dans `localStorage` et nulle part ailleurs : un
    // `localStorage.clear()` le remettait à zéro, et le serveur autorisait de
    // toute façon 60 appels PAR HEURE quel que soit le palier — soit 1 440 par
    // jour pour un compte gratuit censé en avoir 3.
    //
    // POURQUOI IL SUIT `REQUIRE_PRO`. Ce quota fait partie de l'OFFRE, pas de
    // la protection anti-abus : c'est lui qui différencie le gratuit du Pro.
    // Pendant l'accès anticipé gratuit — la décision produit en vigueur, que
    // ce travail ne remet pas en cause — l'offre n'est pas vendue, donc elle
    // n'est pas appliquée. Le plafond horaire ci-dessous, lui, tourne toujours.
    // Basculer `AI_REQUIRE_PRO` active les deux d'un coup, ce qui est
    // exactement ce que le README promet.
    if (REQUIRE_PRO) {
      const dailyLimit = LIMITS[effectiveTier(row)].jarvisPerDay;
      if (Number.isFinite(dailyLimit)) {
        const allowed = await consumeQuota(supabase, "daily", dailyLimit, 86_400);
        // ÉCHOUE FERMÉ ici aussi : quand le quota EST le produit vendu, ne pas
        // savoir où en est quelqu'un ne doit pas valoir « laisse passer ».
        if (allowed !== true) throw new DailyQuotaError();
      }
    }

    // ── 4) Plafond horaire anti-abus ────────────────────────────────────────
    //
    // Toujours actif, indépendant de l'offre : il protège le coût, pas le
    // revenu. Échoue OUVERT — un incident sur le compteur ne doit pas priver
    // d'IA un utilisateur qui n'a rien demandé.
    const withinHourly = await consumeQuota(supabase, "hourly", RATE_LIMIT_PER_HOUR, 3_600);
    if (withinHourly === false) throw new RateLimitError();

    return next();
  });

/**
 * Consomme un jeton de quota dans une fenêtre fixe.
 *
 * Rend `true` (autorisé), `false` (refusé) ou `null` (INDÉTERMINÉ — le
 * compteur n'a pas pu être interrogé). Les trois cas sont distincts à dessein :
 * c'est l'appelant qui décide si l'indétermination vaut « laisse passer » ou
 * « refuse », et cette décision n'est pas la même pour un quota commercial et
 * pour un garde-fou de coût.
 *
 * La portée (`scope`) sépare les compteurs : sans elle, la fenêtre quotidienne
 * et la fenêtre horaire tombent sur le même `window_start` à minuit UTC et
 * partagent une ligne — chacune épuisant l'autre.
 */
async function consumeQuota(
  supabase: unknown,
  scope: "daily" | "hourly",
  limit: number,
  windowSeconds: number,
): Promise<boolean | null> {
  try {
    const { data, error } = await (supabase as SupabaseClient).rpc("consume_ai_quota_scoped", {
      p_scope: scope,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) return null;
    return data === false ? false : true;
  } catch {
    return null;
  }
}
