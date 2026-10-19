import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

/**
 * LE PROFIL : UNE LIGNE, UN CACHE, ZÉRO REQUÊTE EN PLUS.
 *
 * Une vingtaine d'écrans lisent chacun leur morceau de `profiles` (règles,
 * plan, devise, solde, config de checklist, profil Jarvis…). Pour qu'ils
 * suivent un changement fait sur un autre appareil sans multiplier les
 * requêtes, ils dérivent tous d'une seule ligne en cache, que le moyeu live
 * remplace quand Realtime en apporte une nouvelle.
 *
 * Le piège vérifié ici : l'ÉCHO. Le trader tape dans le plan de trading, une
 * première sauvegarde part, il continue à taper ; l'écho Realtime de la
 * première sauvegarde arrive — il ne doit pas effacer ce qui a été tapé depuis.
 */

// ── Client Supabase substitué : compte les lectures, rend la ligne voulue ────
let row: Record<string, unknown> | null = null;
let selects = 0;
let failNextSelect = false;
let updates: Record<string, unknown>[] = [];

function profilesQuery() {
  const q = {
    select: () => {
      selects += 1;
      return q;
    },
    eq: () => q,
    maybeSingle: () => {
      if (failNextSelect) {
        failNextSelect = false;
        return Promise.resolve({ data: null, error: { message: "network down" } });
      }
      return Promise.resolve({ data: row, error: null });
    },
    update: (patch: Record<string, unknown>) => {
      updates.push(patch);
      const done = {
        eq: () => done,
        then: (r: (v: { error: null }) => void) => r({ error: null }),
      };
      return done;
    },
  };
  return q;
}

// Canal Realtime substitué : le VRAI moyeu tourne, on pilote ses événements.
type Binding = { filter: Record<string, string>; cb: (p: unknown) => void };
let bindings: Binding[] = [];
let statusCb: ((s: string) => void) | null = null;
const fakeChannel = {
  on: (_t: string, filter: Record<string, string>, cb: (p: unknown) => void) => {
    bindings.push({ filter, cb });
    return fakeChannel;
  },
  subscribe: (cb: (s: string) => void) => {
    statusCb = cb;
    return fakeChannel;
  },
};

mock.module("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => profilesQuery(),
    channel: () => {
      bindings = [];
      return fakeChannel;
    },
    removeChannel: () => Promise.resolve("ok"),
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
  },
}));

const g = globalThis as Record<string, unknown>;
const fakeWindow = new EventTarget();
g.window = fakeWindow;
g.document = Object.assign(new EventTarget(), { visibilityState: "visible" });

function emitProfile(next: Record<string, unknown>) {
  for (const b of bindings) {
    if (b.filter.table === "profiles") b.cb({ eventType: "UPDATE", new: next, old: null });
  }
}

const live = await import("../src/app/store/liveSync");
const profileRow = await import("../src/app/store/profileRow");
const profile = await import("../src/app/store/profile");
const { loadTradingRules } = await import("../src/app/trading/tradingRules");
const { loadTradingPlan, saveTradingPlan } = await import("../src/app/trading/tradingPlan");

const BASE = {
  id: "u1",
  confluences: ["FVG"],
  account_balance: 1000,
  language: "fr",
  currency: "EUR",
  trading_rules: [{ id: "r1", kind: "max_trades", value: 3, enabled: true }],
  trading_plan: { mission: "A" },
  checklist_config: { items: [1] },
  onboarding_goal: "g",
  onboarding_monthly_target: 5,
  jarvis_first_name: "Sam",
  jarvis_completed_at: "2026-10-01T00:00:00Z",
};

afterAll(() => {
  live.stopLiveSync();
  delete g.window;
  delete g.document;
});

beforeEach(() => {
  live.stopLiveSync();
  row = { ...BASE };
  selects = 0;
  failNextSelect = false;
  updates = [];
  profileRow.invalidateProfileRow();
});

/** Le direct est connecté : le cache n'est servi qu'à cette condition. */
function goOnline() {
  live.startLiveSync("u1");
  statusCb!("SUBSCRIBED");
}

describe("profileRow — lecture", () => {
  test("une seule requête pour tous les lecteurs du profil", async () => {
    const [conf, bal, onb, chk, cur, rules, plan, lang, jarvis] = await Promise.all([
      profile.loadConfluences("u1"),
      profile.loadAccountBalance("u1"),
      profile.loadOnboarding("u1"),
      profile.loadChecklistConfig("u1"),
      profile.loadCurrency("u1"),
      loadTradingRules("u1"),
      loadTradingPlan("u1"),
      profile.loadLanguage("u1"),
      profile.loadJarvisProfile("u1"),
    ]);
    expect(selects).toBe(1);
    expect(conf).toEqual(["FVG"]);
    expect(bal).toBe(1000);
    expect(onb.goal).toBe("g");
    expect(chk).toEqual({ items: [1] });
    expect(cur).toBe("EUR");
    expect(rules.length).toBe(1);
    expect(plan.mission).toBe("A");
    expect(lang).toBe("fr");
    expect(jarvis.firstName).toBe("Sam");
  });

  test("un changement distant remplace la ligne, sans nouvelle requête", async () => {
    goOnline();
    await profile.loadCurrency("u1");
    profileRow.replaceProfileRow("u1", { ...BASE, currency: "USD" });
    expect(await profile.loadCurrency("u1")).toBe("USD");
    expect(selects).toBe(1);
  });

  test("un échec de lecture n'est pas mémorisé", async () => {
    failNextSelect = true;
    await expect(profile.loadCurrency("u1")).rejects.toBeDefined();
    expect(await profile.loadCurrency("u1")).toBe("EUR");
    expect(selects).toBe(2);
  });

  test("les utilisateurs sont isolés, invalidate vide tout", async () => {
    goOnline();
    await profile.loadCurrency("u1");
    row = { id: "u2", currency: "GBP" };
    expect(await profile.loadCurrency("u2")).toBe("GBP");
    profileRow.replaceProfileRow("u2", { id: "u2", currency: "JPY" });
    expect(await profile.loadCurrency("u1")).toBe("EUR");
    profileRow.invalidateProfileRow();
    row = { id: "u1", currency: "CHF" };
    expect(await profile.loadCurrency("u1")).toBe("CHF");
  });
});

describe("profileRow — direct muet", () => {
  test("direct pas en ligne : chaque lecture repart de la base", async () => {
    await profile.loadCurrency("u1");
    row = { ...BASE, currency: "USD" };
    expect(await profile.loadCurrency("u1")).toBe("USD");
    expect(selects).toBe(2);
  });

  test("lue avant l'abonnement : relue une fois en ligne, puis servie du cache", async () => {
    await profile.loadCurrency("u1");
    goOnline();
    row = { ...BASE, currency: "USD" };
    expect(await profile.loadCurrency("u1")).toBe("USD");
    expect(await profile.loadCurrency("u1")).toBe("USD");
    expect(selects).toBe(2);
  });

  test("une écriture en attente reste visible même hors direct", async () => {
    await loadTradingPlan("u1");
    const settle = profileRow.beginProfileWrite("u1", { trading_plan: { mission: "B" } });
    expect((await loadTradingPlan("u1")).mission).toBe("B");
    settle();
  });
});

describe("profileRow — écho de ses propres écritures", () => {
  test("une écriture en cours n'est pas écrasée par l'écho d'une plus ancienne", async () => {
    await loadTradingPlan("u1");
    const settle = profileRow.beginProfileWrite("u1", { trading_plan: { mission: "B" } });
    profileRow.replaceProfileRow("u1", { ...BASE, trading_plan: { mission: "A" } });
    expect((await loadTradingPlan("u1")).mission).toBe("B");
    settle();
    profileRow.replaceProfileRow("u1", { ...BASE, trading_plan: { mission: "A" } });
    expect((await loadTradingPlan("u1")).mission).toBe("A");
  });

  test("un enregistrement applique la valeur au cache tout de suite", async () => {
    goOnline();
    await loadTradingPlan("u1");
    await saveTradingPlan("u1", { ...(await loadTradingPlan("u1")), mission: "C" });
    expect(updates.length).toBe(1);
    expect((await loadTradingPlan("u1")).mission).toBe("C");
    expect(selects).toBe(1);
  });
});

describe("profileRow — branchement live", () => {
  const unwire = profileRow.wireProfileRowLive();
  afterAll(() => unwire());

  test("nouvelles règles : tv-rules-updated est diffusé avec les règles", async () => {
    goOnline();
    await loadTradingRules("u1");
    const received: unknown[] = [];
    const on = (e: Event) => received.push((e as CustomEvent).detail);
    fakeWindow.addEventListener("tv-rules-updated", on);
    const next = [{ id: "r2", kind: "max_loss", value: 100, enabled: true }];
    emitProfile({ ...BASE, trading_rules: next });
    expect(received).toEqual([next]);
    // Mêmes règles, autre colonne : aucun événement, mais la ligne suit.
    emitProfile({ ...BASE, trading_rules: next, currency: "USD" });
    expect(received.length).toBe(1);
    fakeWindow.removeEventListener("tv-rules-updated", on);
    expect(await profile.loadCurrency("u1")).toBe("USD");
  });

  test("rattrapage : la ligne est relue", async () => {
    live.startLiveSync("u1");
    statusCb!("SUBSCRIBED");
    await profile.loadCurrency("u1");
    row = { ...BASE, currency: "USD" };
    statusCb!("CHANNEL_ERROR");
    statusCb!("SUBSCRIBED");
    expect(await profile.loadCurrency("u1")).toBe("USD");
    expect(selects).toBe(2);
  });
});
