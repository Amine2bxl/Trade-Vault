import { describe, expect, test } from "bun:test";
import {
  redemptionGrantsAccess,
  releasePromoRedemption,
  reservePromoRedemption,
  type RedemptionOutcome,
} from "../src/backend/promo.server";
import { applySubscriptionEvent, timingSafeEqualHex } from "../src/backend/billing.server";

/**
 * L'ORCHESTRATION côté serveur : ce que le TypeScript envoie à Postgres, et ce
 * qu'il fait de la réponse.
 *
 * Le comportement de Postgres lui-même (verrou de ligne, `max_uses`, ordre des
 * événements) est vérifié pour de vrai dans `tests/sql/` — contre un vrai
 * serveur, avec deux sessions simultanées. Ici on vérifie l'autre moitié du
 * contrat : le bon nom de fonction, les bons paramètres, et surtout que le
 * verdict de la base n'est pas perdu en chemin.
 *
 * Le client est un double MINIMAL qui enregistre l'appel : il ne simule pas
 * Postgres, il observe ce qu'on lui demande.
 */

type RpcCall = { fn: string; args: Record<string, unknown> };

function fakeClient(reply: { data?: unknown; error?: unknown } | (() => never)) {
  const calls: RpcCall[] = [];
  return {
    calls,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rpc(fn: string, args: Record<string, unknown>): any {
      calls.push({ fn, args });
      if (typeof reply === "function") reply();
      return Promise.resolve(reply);
    },
  };
}

const USER = { id: "user-1", email: "trader@example.com" };

describe("reservePromoRedemption", () => {
  test("appelle la fonction SQL atomique, jamais une lecture-puis-écriture", async () => {
    const sb = fakeClient({ data: "redeemed" });
    await reservePromoRedemption(sb, "VAULT20", USER, "pro_yearly", "discount");

    expect(sb.calls).toHaveLength(1);
    expect(sb.calls[0].fn).toBe("redeem_promo_code");
    expect(sb.calls[0].args).toEqual({
      p_code: "VAULT20",
      p_user_id: "user-1",
      p_email: "trader@example.com",
      p_plan: "pro_yearly",
      p_kind: "discount",
    });
  });

  test("transmet le verdict de la base tel quel", async () => {
    const outcomes: RedemptionOutcome[] = [
      "redeemed",
      "already_redeemed",
      "exhausted",
      "inactive",
      "expired",
      "unknown",
    ];
    for (const outcome of outcomes) {
      const sb = fakeClient({ data: outcome });
      expect(await reservePromoRedemption(sb, "C", USER, "pro_yearly", "free")).toBe(outcome);
    }
  });

  test("une erreur de base devient `error`, pas un succès silencieux", async () => {
    const sb = fakeClient({ error: { message: "connection lost" } });
    expect(await reservePromoRedemption(sb, "C", USER, "pro_yearly", "free")).toBe("error");
  });

  test("une exception est attrapée — un échec de journalisation ne casse pas un paiement", async () => {
    // C'est LE bug d'origine : `.onConflict().ignore()` levait un TypeError qui
    // remontait jusqu'au gestionnaire global et transformait un checkout réussi
    // en page d'erreur 500.
    const sb = fakeClient(() => {
      throw new TypeError("sb.from(...).insert(...).select(...).onConflict is not a function");
    });
    expect(await reservePromoRedemption(sb, "C", USER, "pro_yearly", "free")).toBe("error");
  });

  test("une réponse vide n'est pas confondue avec un succès", async () => {
    const sb = fakeClient({ data: null });
    expect(await reservePromoRedemption(sb, "C", USER, "pro_yearly", "free")).toBe("error");
  });
});

describe("redemptionGrantsAccess — quelles issues laissent passer", () => {
  test("une rédemption neuve et une rédemption déjà faite ouvrent toutes deux l'accès", () => {
    // Reprendre un checkout abandonné n'est pas un abus : la place est déjà
    // payée par cette personne, la lui refuser serait un bug.
    expect(redemptionGrantsAccess("redeemed")).toBe(true);
    expect(redemptionGrantsAccess("already_redeemed")).toBe(true);
  });

  test("tout refus de la base ferme le parcours", () => {
    for (const outcome of ["exhausted", "inactive", "expired", "unknown", "error"] as const) {
      expect(redemptionGrantsAccess(outcome)).toBe(false);
    }
  });
});

describe("releasePromoRedemption", () => {
  test("rend l'usage par la fonction SQL, qui décrémente le compteur", async () => {
    const sb = fakeClient({ data: true });
    await releasePromoRedemption(sb, "VAULT20", "user-1");
    expect(sb.calls[0].fn).toBe("release_promo_redemption");
    expect(sb.calls[0].args).toEqual({ p_code: "VAULT20", p_user_id: "user-1" });
  });

  test("n'explose jamais : c'est un chemin de rattrapage, pas un chemin critique", async () => {
    const sb = fakeClient(() => {
      throw new Error("boom");
    });
    await expect(releasePromoRedemption(sb, "C", "user-1")).resolves.toBeUndefined();
  });
});

describe("applySubscriptionEvent", () => {
  test("envoie les dix paramètres de l'événement, horodatage compris", async () => {
    const sb = fakeClient({ data: "applied" });
    await applySubscriptionEvent(sb as never, {
      userId: "user-1",
      plan: "pro_monthly",
      status: "active",
      source: "stripe",
      stripeSubscriptionId: "sub_1",
      stripeCustomerId: "cus_1",
      currentPeriodEnd: "2026-09-30T00:00:00.000Z",
      cancelAtPeriodEnd: false,
      eventAt: "2026-08-29T10:00:00.000Z",
    });

    expect(sb.calls[0].fn).toBe("apply_subscription_event");
    expect(sb.calls[0].args).toEqual({
      p_user_id: "user-1",
      p_plan: "pro_monthly",
      p_status: "active",
      p_source: "stripe",
      p_stripe_subscription_id: "sub_1",
      p_stripe_customer_id: "cus_1",
      // Absent de l'entrée → `null` explicite, jamais `undefined` : PostgREST
      // omettrait un paramètre `undefined` et l'appel échouerait.
      p_crypto_charge_id: null,
      p_current_period_end: "2026-09-30T00:00:00.000Z",
      p_cancel_at_period_end: false,
      // Sans cet horodatage, une livraison hors ordre écraserait un état plus
      // récent.
      p_event_at: "2026-08-29T10:00:00.000Z",
    });
  });

  test("remonte `stale` quand la base refuse un événement périmé", async () => {
    const sb = fakeClient({ data: "stale" });
    const result = await applySubscriptionEvent(sb as never, {
      userId: "u",
      plan: "free",
      status: "expired",
      source: "stripe",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      eventAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result).toBe("stale");
  });

  test("LÈVE en cas d'échec réel — pour que le webhook réponde 500 et soit rejoué", async () => {
    // Avaler l'erreur ici, c'est répondre 200 à Stripe sur un paiement non
    // enregistré : l'événement ne serait jamais renvoyé.
    const sb = fakeClient({ error: { message: "deadlock detected" } });
    await expect(
      applySubscriptionEvent(sb as never, {
        userId: "u",
        plan: "pro_monthly",
        status: "active",
        source: "stripe",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        eventAt: "2026-08-29T10:00:00.000Z",
      }),
    ).rejects.toThrow(/apply_subscription_event failed/);
  });
});

describe("timingSafeEqualHex", () => {
  test("compare sans court-circuit sur la première différence", () => {
    expect(timingSafeEqualHex("abcd", "abcd")).toBe(true);
    expect(timingSafeEqualHex("abcd", "abce")).toBe(false);
    expect(timingSafeEqualHex("abcd", "zbcd")).toBe(false);
    expect(timingSafeEqualHex("abcd", "abc")).toBe(false);
    expect(timingSafeEqualHex("", "")).toBe(true);
  });
});
