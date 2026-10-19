import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

/**
 * LES PRÉFÉRENCES DU COMPTE, EN DIRECT.
 *
 * `user_preferences` porte un objet `prefs` par compte (calculateur de lots,
 * catégories de notifications…). Un réglage changé sur le téléphone doit
 * apparaître sur l'ordinateur sans rafraîchir — sans que l'écho d'un
 * enregistrement plus ancien n'efface ce que le trader est en train de saisir.
 */

let dbPrefs: Record<string, unknown> = {};
let upserts: Record<string, unknown>[] = [];
let upsertError: { message: string } | null = null;

function prefsQuery() {
  const q = {
    select: () => q,
    eq: () => q,
    maybeSingle: () => Promise.resolve({ data: { prefs: dbPrefs }, error: null }),
    upsert: (row: Record<string, unknown>) => {
      upserts.push(row);
      if (upsertError) return Promise.resolve({ error: upsertError });
      dbPrefs = row.prefs as Record<string, unknown>;
      return Promise.resolve({ error: null });
    },
  };
  return q;
}

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
    from: () => prefsQuery(),
    channel: () => {
      bindings = [];
      return fakeChannel;
    },
    removeChannel: () => Promise.resolve("ok"),
  },
}));

const g = globalThis as Record<string, unknown>;
const fakeWindow = new EventTarget();
g.window = fakeWindow;
g.document = Object.assign(new EventTarget(), { visibilityState: "visible" });

const live = await import("../src/app/store/liveSync");
const prefs = await import("../src/app/utils/userPrefs");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

afterAll(() => {
  live.stopLiveSync();
  delete g.window;
  delete g.document;
});

beforeEach(() => {
  dbPrefs = {};
  upserts = [];
  upsertError = null;
  prefs.invalidateUserPrefs();
});

describe("userPrefs — en direct", () => {
  test("un changement distant devient visible et prévient les écrans", async () => {
    const seen: unknown[] = [];
    const on = (e: Event) => seen.push((e as CustomEvent).detail);
    fakeWindow.addEventListener(prefs.USER_PREFS_EVENT, on);
    await prefs.loadUserPrefs("u1");
    prefs.replaceUserPrefs("u1", { lotCalc: { pair: "XAUUSD" } });
    expect(await prefs.loadUserPref("u1", "lotCalc")).toEqual({ pair: "XAUUSD" });
    expect(seen).toEqual([{ userId: "u1" }]);
    fakeWindow.removeEventListener(prefs.USER_PREFS_EVENT, on);
  });

  test("une clé en attente d'envoi n'est pas écrasée par l'écho", async () => {
    await prefs.loadUserPrefs("u1");
    prefs.saveUserPref("u1", "lotCalc", { pair: "B" });
    prefs.replaceUserPrefs("u1", { lotCalc: { pair: "A" } });
    expect(await prefs.loadUserPref("u1", "lotCalc")).toEqual({ pair: "B" });
    await sleep(600);
    expect(upserts.length).toBe(1);
    prefs.replaceUserPrefs("u1", { lotCalc: { pair: "A" } });
    expect(await prefs.loadUserPref("u1", "lotCalc")).toEqual({ pair: "A" });
  });

  test("une clé écrite ailleurs n'est pas perdue à l'envoi", async () => {
    dbPrefs = { notifications: { push: true } };
    prefs.saveUserPref("u1", "lotCalc", { pair: "B" });
    await sleep(600);
    expect(upserts[0].prefs).toEqual({ notifications: { push: true }, lotCalc: { pair: "B" } });
  });

  test("le moyeu live remplace les préférences du compte", async () => {
    const unwire = prefs.wireUserPrefsLive();
    live.startLiveSync("u1");
    await prefs.loadUserPrefs("u1");
    for (const b of bindings) {
      if (b.filter.table === "user_preferences") {
        b.cb({
          eventType: "UPDATE",
          new: { user_id: "u1", prefs: { lotCalc: { pair: "NQ" } } },
          old: null,
        });
      }
    }
    expect(await prefs.loadUserPref("u1", "lotCalc")).toEqual({ pair: "NQ" });
    unwire();
  });

  test("un envoi échoué garde la saisie, et elle repart au retour du réseau", async () => {
    const unwire = prefs.wireUserPrefsLive();
    live.startLiveSync("u1");
    statusCb!("SUBSCRIBED");
    await prefs.loadUserPrefs("u1");
    upsertError = { message: "network down" };
    prefs.saveUserPref("u1", "lotCalc", { pair: "B" });
    await sleep(600);
    expect(upserts.length).toBe(1);
    // La version serveur (ancienne) ne remplace pas ce qui n'est jamais parti.
    prefs.replaceUserPrefs("u1", { lotCalc: { pair: "A" } });
    expect(await prefs.loadUserPref("u1", "lotCalc")).toEqual({ pair: "B" });
    // Le réseau revient : la saisie est renvoyée.
    upsertError = null;
    statusCb!("CHANNEL_ERROR");
    statusCb!("SUBSCRIBED");
    await sleep(600);
    expect(upserts.length).toBe(2);
    expect((upserts[1].prefs as Record<string, unknown>).lotCalc).toEqual({ pair: "B" });
    unwire();
  });
});
