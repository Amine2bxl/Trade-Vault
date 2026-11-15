import { afterAll, beforeEach, describe, expect, test } from "bun:test";

/**
 * LES PARCOURS DE PAIEMENT, DE BOUT EN BOUT — sans réseau.
 *
 * Les autres tests de la facturation lisent la source (`checkoutInvariants`)
 * ou une fonction isolée (`billingOrchestration`). Celui-ci fait tourner les
 * VRAIS gestionnaires HTTP (`handleCheckout`, `handleStripeWebhook`) avec deux
 * doublures minimales : Supabase (une ligne d'abonnement en mémoire) et
 * l'API Stripe (un `fetch` qui enregistre chaque appel). On vérifie ce qui
 * compte pour l'argent :
 *
 *   • le mensuel ouvre une session `subscription` au prix 9 € marqué `offer` ;
 *   • la licence ouvre une session `payment` au prix 49 € ;
 *   • on ne vend pas deux fois la même chose (409) ;
 *   • un prix introuvable ne vend RIEN, plutôt qu'au mauvais montant ;
 *   • le webhook projette un mensuel tel quel, convertit un ancien abonnement
 *     en licence, et coupe le mensuel quand la licence est achetée.
 */

// ── La doublure Supabase ────────────────────────────────────────────────────
// PAS de `mock.module` : Bun le partage entre fichiers de test, et la doublure
// fuyait dans d'autres suites. Supabase est simulé au niveau HTTP, par le
// même `fetch` que Stripe — le vrai client `supabase-js` tourne, seules ses
// réponses sont fabriquées.
type Row = Record<string, unknown> | null;
const etat: { row: Row; rpc: { fn: string; args: Record<string, unknown> }[] } = {
  row: null,
  rpc: [],
};
const SUPABASE = "http://supabase.test";

function repondreSupabase(url: URL, init?: RequestInit): Response {
  const json = (body: unknown, status = 200) =>
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  const method = init?.method ?? "GET";
  const entetes = new Headers(init?.headers);
  if (url.pathname === "/auth/v1/user") {
    return entetes.get("authorization") === "Bearer bon-jeton"
      ? json({ id: "u1", email: "trader@example.com", aud: "authenticated", role: "authenticated" })
      : json({ code: 401, msg: "invalid JWT" }, 401);
  }
  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    etat.rpc.push({
      fn: url.pathname.slice("/rest/v1/rpc/".length),
      args: JSON.parse(String(init?.body ?? "{}")),
    });
    return json("applied");
  }
  if (url.pathname === "/rest/v1/subscriptions" && method === "GET") {
    const objet = (entetes.get("accept") ?? "").includes("vnd.pgrst.object");
    return objet ? json(etat.row) : json(etat.row ? [etat.row] : []);
  }
  if (method === "DELETE") return json(undefined, 204);
  return json([], 201);
}

// ── La doublure Stripe ──────────────────────────────────────────────────────
type Appel = { method: string; path: string; params: URLSearchParams };
const appels: Appel[] = [];
const PRIX: Record<string, { id: string; unit_amount: number }> = {
  tradevault_elite_monthly_eur_900: { id: "price_mensuel", unit_amount: 900 },
  tradevault_lifetime_eur_4900: { id: "price_licence", unit_amount: 4900 },
};
let prixDisponibles = true;
let refuserApparence = false;

const fetchOriginal = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input.toString());
  if (url.origin === SUPABASE) return repondreSupabase(url, init);
  const method = init?.method ?? "GET";
  const params =
    method === "GET" ? url.searchParams : new URLSearchParams(String(init?.body ?? ""));
  const path = url.pathname.replace(/^\/v1/, "");
  appels.push({ method, path, params });
  const repondre = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  if (path === "/prices" && method === "GET") {
    const cle = params.get("lookup_keys[]") ?? "";
    return repondre({ data: prixDisponibles && PRIX[cle] ? [PRIX[cle]] : [] });
  }
  if (path === "/customers") return repondre({ id: "cus_1" });
  if (path === "/checkout/sessions") {
    if (refuserApparence && params.has("branding_settings[button_color]"))
      return repondre({ error: { message: "Received unknown parameter: branding_settings" } }, 400);
    return repondre({ url: "https://checkout.stripe.com/c/x" });
  }
  if (path.startsWith("/subscriptions/")) return repondre({ id: path.split("/")[2] });
  return repondre({ error: { message: `route inconnue ${method} ${path}` } }, 404);
}) as typeof fetch;

afterAll(() => {
  globalThis.fetch = fetchOriginal;
});

process.env.SUPABASE_URL = SUPABASE;
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
process.env.STRIPE_SECRET_KEY = "sk_test_doublure";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_doublure";
process.env.PUBLIC_SITE_URL = "https://tradevault.test";
delete process.env.STRIPE_PRICE_ELITE_MONTHLY;
delete process.env.STRIPE_PRICE_LIFETIME;

const { handleCheckout, handleStripeWebhook, SUBSCRIPTION_OFFER } =
  await import("../src/backend/billing.server");

function checkout(plan: string) {
  return handleCheckout(
    new Request("https://tradevault.test/api/billing/checkout", {
      method: "POST",
      headers: { authorization: "Bearer bon-jeton", "content-type": "application/json" },
      body: JSON.stringify({ plan }),
    }),
  );
}

const session = () => appels.find((a) => a.path === "/checkout/sessions")?.params;

beforeEach(() => {
  etat.row = null;
  etat.rpc = [];
  appels.length = 0;
  prixDisponibles = true;
  refuserApparence = false;
});

// ── Checkout ────────────────────────────────────────────────────────────────

describe("checkout", () => {
  // EN PREMIER : les prix trouvés sont gardés en mémoire de l'instance, un
  // prix introuvable ne l'est jamais.
  test("un prix introuvable ne vend rien — jamais au mauvais montant", async () => {
    prixDisponibles = false;
    const res = await checkout("elite_monthly");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "price not configured" });
    expect(session()).toBeUndefined();
  });

  test("sans session valide : 401, aucun appel à Stripe", async () => {
    const res = await handleCheckout(
      new Request("https://tradevault.test/api/billing/checkout", {
        method: "POST",
        headers: { authorization: "Bearer faux", "content-type": "application/json" },
        body: JSON.stringify({ plan: "lifetime" }),
      }),
    );
    expect(res.status).toBe(401);
    expect(appels).toHaveLength(0);
  });

  test("le mensuel ouvre un ABONNEMENT à 9 €, marqué comme vendu aujourd'hui", async () => {
    const res = await checkout("elite_monthly");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://checkout.stripe.com/c/x" });
    const p = session()!;
    expect(p.get("mode")).toBe("subscription");
    expect(p.get("line_items[0][price]")).toBe("price_mensuel");
    expect(p.get("subscription_data[metadata][user_id]")).toBe("u1");
    expect(p.get("subscription_data[metadata][plan]")).toBe("elite_monthly");
    expect(p.get("subscription_data[metadata][offer]")).toBe(SUBSCRIPTION_OFFER);
    expect(p.get("allow_promotion_codes")).toBe("true");
  });

  test("la licence ouvre un PAIEMENT UNIQUE à 49 €, avec facture", async () => {
    const res = await checkout("lifetime");
    expect(res.status).toBe(200);
    const p = session()!;
    expect(p.get("mode")).toBe("payment");
    expect(p.get("line_items[0][price]")).toBe("price_licence");
    expect(p.get("metadata[plan]")).toBe("lifetime");
    expect(p.get("payment_intent_data[metadata][plan]")).toBe("lifetime");
    expect(p.get("invoice_creation[enabled]")).toBe("true");
  });

  test("la page de paiement porte l'apparence de TradeVault", async () => {
    await checkout("lifetime");
    const p = session()!;
    expect(p.get("branding_settings[background_color]")).toBe("#050607");
    expect(p.get("branding_settings[button_color]")).toBe("#31d68a");
    expect(p.get("branding_settings[font_family]")).toBe("inter");
    expect(p.get("branding_settings[display_name]")).toBe("TradeVault");
    expect(p.get("branding_settings[icon][url]")).toBe("https://tradevault.test/icon-512.png");
  });

  test("une apparence refusée par Stripe n'empêche jamais le paiement", async () => {
    refuserApparence = true;
    const res = await checkout("elite_monthly");
    expect(res.status).toBe(200);
    const tentatives = appels.filter((a) => a.path === "/checkout/sessions");
    expect(tentatives).toHaveLength(2);
    expect(tentatives[1].params.has("branding_settings[button_color]")).toBe(false);
    expect(tentatives[1].params.get("line_items[0][price]")).toBe("price_mensuel");
  });

  test("un plan retiré mène à l'offre en vente la plus proche", async () => {
    await checkout("pro_yearly");
    expect(session()!.get("line_items[0][price]")).toBe("price_licence");
    appels.length = 0;
    await checkout("pro_monthly");
    expect(session()!.get("line_items[0][price]")).toBe("price_mensuel");
  });

  test("une licence possédée : 409, rien à vendre", async () => {
    etat.row = { plan: "lifetime", status: "active", current_period_end: null };
    for (const plan of ["lifetime", "elite_monthly"]) {
      const res = await checkout(plan);
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: "already lifetime" });
    }
    expect(session()).toBeUndefined();
  });

  test("un mensuel actif : pas de second mensuel, mais la licence reste ouverte", async () => {
    etat.row = {
      plan: "elite_monthly",
      status: "active",
      current_period_end: new Date(Date.now() + 10 * 86_400_000).toISOString(),
    };
    const double = await checkout("elite_monthly");
    expect(double.status).toBe(409);
    expect(await double.json()).toEqual({ error: "already subscribed" });

    const licence = await checkout("lifetime");
    expect(licence.status).toBe(200);
    expect(session()!.get("mode")).toBe("payment");
  });

  test("un abonnement terminé peut repayer", async () => {
    etat.row = { plan: "elite_monthly", status: "expired", current_period_end: null };
    const res = await checkout("elite_monthly");
    expect(res.status).toBe(200);
  });
});

// ── Webhook ─────────────────────────────────────────────────────────────────

async function signer(payload: string): Promise<string> {
  const t = Math.floor(Date.now() / 1000);
  const cle = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("whsec_doublure"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cle, new TextEncoder().encode(`${t}.${payload}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `t=${t},v1=${hex}`;
}

let numero = 0;
async function webhook(type: string, object: Record<string, unknown>) {
  const payload = JSON.stringify({
    id: `evt_${++numero}`,
    type,
    created: Math.floor(Date.now() / 1000),
    data: { object },
  });
  return handleStripeWebhook(
    new Request("https://tradevault.test/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": await signer(payload) },
      body: payload,
    }),
  );
}

const projections = () => etat.rpc.filter((r) => r.fn === "apply_subscription_event");

describe("webhook Stripe", () => {
  test("une signature fausse est refusée", async () => {
    const res = await handleStripeWebhook(
      new Request("https://tradevault.test/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=00" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(400);
  });

  test("un mensuel vendu aujourd'hui est projeté tel quel — jamais converti en licence", async () => {
    const res = await webhook("customer.subscription.updated", {
      id: "sub_nouveau",
      customer: "cus_1",
      status: "active",
      cancel_at_period_end: false,
      metadata: { user_id: "u1", plan: "elite_monthly", offer: SUBSCRIPTION_OFFER },
      items: {
        data: [
          {
            price: { id: "price_mensuel", lookup_key: "tradevault_elite_monthly_eur_900" },
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 86_400,
          },
        ],
      },
    });
    expect(res.status).toBe(200);
    expect(projections()).toHaveLength(1);
    expect(projections()[0].args.p_plan).toBe("elite_monthly");
    expect(projections()[0].args.p_status).toBe("active");
    // Aucune coupure de renouvellement chez Stripe.
    expect(appels.filter((a) => a.path.startsWith("/subscriptions/"))).toHaveLength(0);
  });

  test("un ancien abonnement actif devient une licence, et son renouvellement est coupé", async () => {
    await webhook("customer.subscription.updated", {
      id: "sub_ancien",
      customer: "cus_1",
      status: "active",
      cancel_at_period_end: false,
      metadata: { user_id: "u1", plan: "pro_monthly" },
      items: { data: [{ price: { id: "price_ancien_pro" } }] },
    });
    expect(projections()[0].args.p_plan).toBe("lifetime");
    const coupure = appels.find((a) => a.path === "/subscriptions/sub_ancien");
    expect(coupure?.params.get("cancel_at_period_end")).toBe("true");
  });

  test("la licence payée est accordée, et un mensuel en cours cesse de se renouveler", async () => {
    etat.row = {
      stripe_subscription_id: "sub_mensuel",
      plan: "elite_monthly",
      cancel_at_period_end: false,
    };
    const res = await webhook("checkout.session.completed", {
      mode: "payment",
      payment_status: "paid",
      customer: "cus_1",
      metadata: { user_id: "u1", plan: "lifetime" },
    });
    expect(res.status).toBe(200);
    expect(projections()[0].args.p_plan).toBe("lifetime");
    expect(projections()[0].args.p_current_period_end).toBeNull();
    const coupure = appels.find((a) => a.path === "/subscriptions/sub_mensuel");
    expect(coupure?.params.get("cancel_at_period_end")).toBe("true");
  });

  test("un paiement pas encore réglé n'ouvre rien", async () => {
    await webhook("checkout.session.completed", {
      mode: "payment",
      payment_status: "unpaid",
      metadata: { user_id: "u1", plan: "lifetime" },
    });
    expect(projections()).toHaveLength(0);
  });

  test("la fin d'un mensuel le repasse au gratuit", async () => {
    await webhook("customer.subscription.deleted", {
      id: "sub_nouveau",
      customer: "cus_1",
      status: "canceled",
      metadata: { user_id: "u1", plan: "elite_monthly", offer: SUBSCRIPTION_OFFER },
      items: { data: [{ price: { id: "price_mensuel" } }] },
    });
    expect(projections()[0].args.p_plan).toBe("free");
    expect(projections()[0].args.p_status).toBe("expired");
  });
});
