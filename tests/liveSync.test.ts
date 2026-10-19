import { afterAll, afterEach, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";

/**
 * LE MOYEU LIVE — un canal par compte, redistribué par table.
 *
 * Ce qui compte, et qu'on vérifie ici sans réseau :
 *   • chaque table du compte est écoutée, avec le BON filtre (le profil se
 *     filtre sur `id`, tout le reste sur `user_id`) ;
 *   • un changement n'atteint que les abonnés de sa table, et un abonné qui
 *     lève n'empêche pas les autres d'être servis ;
 *   • après une coupure ou un long passage en arrière-plan, les écrans sont
 *     invités à tout relire — c'est ce qui rattrape les événements manqués ;
 *   • changer d'utilisateur dans le même onglet ferme l'ancien canal : rien
 *     de l'ancien compte n'atteint le nouveau.
 */

// ── Client Supabase substitué : un enregistreur de canaux ────────────────────
type Binding = { type: string; filter: Record<string, string>; cb: (p: unknown) => void };
interface FakeChannel {
  name: string;
  bindings: Binding[];
  statusCb: ((s: string) => void) | null;
  removed: boolean;
  on: (type: string, filter: Record<string, string>, cb: (p: unknown) => void) => FakeChannel;
  subscribe: (cb: (s: string) => void) => FakeChannel;
}
let channels: FakeChannel[] = [];

function makeChannel(name: string): FakeChannel {
  const ch: FakeChannel = {
    name,
    bindings: [],
    statusCb: null,
    removed: false,
    on(type, filter, cb) {
      ch.bindings.push({ type, filter, cb });
      return ch;
    },
    subscribe(cb) {
      ch.statusCb = cb;
      return ch;
    },
  };
  channels.push(ch);
  return ch;
}

mock.module("@/integrations/supabase/client", () => ({
  supabase: {
    channel: (name: string) => makeChannel(name),
    removeChannel: (ch: FakeChannel) => {
      ch.removed = true;
      return Promise.resolve("ok");
    },
  },
}));

// ── Navigateur minimal : fenêtre, document, réseau ───────────────────────────
const g = globalThis as Record<string, unknown>;
const fakeWindow = new EventTarget();
const fakeDocument = Object.assign(new EventTarget(), { visibilityState: "visible" });
g.window = fakeWindow;
g.document = fakeDocument;

const live = await import("../src/app/store/liveSync");

afterAll(() => {
  delete g.window;
  delete g.document;
  setSystemTime();
});

function current(): FakeChannel {
  return channels[channels.length - 1];
}
function emit(ch: FakeChannel, table: string, payload: Record<string, unknown>) {
  for (const b of ch.bindings) {
    if (b.type === "postgres_changes" && b.filter.table === table) b.cb({ table, ...payload });
  }
}
function setVisibility(v: "visible" | "hidden") {
  fakeDocument.visibilityState = v;
  fakeDocument.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  channels = [];
  setSystemTime(new Date("2026-10-19T10:00:00Z"));
  fakeDocument.visibilityState = "visible";
});
afterEach(() => {
  live.stopLiveSync();
});

describe("liveSync — abonnement", () => {
  test("relie chaque table de LIVE_TABLES avec son filtre", () => {
    live.startLiveSync("u1");
    expect(channels.length).toBe(1);
    const ch = current();
    expect(ch.name).toBe("db:u1");
    const pg = ch.bindings.filter((b) => b.type === "postgres_changes");
    expect(pg.length).toBe(live.LIVE_TABLES.length);
    expect(live.LIVE_TABLES.length).toBe(15);
    for (const table of live.LIVE_TABLES) {
      const b = pg.find((x) => x.filter.table === table);
      expect(b, `table non écoutée : ${table}`).toBeDefined();
      expect(b!.filter.schema).toBe("public");
      expect(b!.filter.event).toBe("*");
      expect(b!.filter.filter).toBe(table === "profiles" ? "id=eq.u1" : "user_id=eq.u1");
    }
  });

  test("démarrage idempotent pour le même utilisateur", () => {
    live.startLiveSync("u1");
    live.startLiveSync("u1");
    expect(channels.length).toBe(1);
  });

  test("changer d'utilisateur ferme l'ancien canal, sans fuite", () => {
    const seen: unknown[] = [];
    const off = live.onTable("goal_plans", (c) => seen.push(c.new));
    live.startLiveSync("u1");
    const old = current();
    live.startLiveSync("u2");
    expect(old.removed).toBe(true);
    expect(current().name).toBe("db:u2");
    emit(old, "goal_plans", { eventType: "UPDATE", new: { user_id: "u1" }, old: null });
    expect(seen).toEqual([]);
    emit(current(), "goal_plans", { eventType: "UPDATE", new: { user_id: "u2" }, old: null });
    expect(seen).toEqual([{ user_id: "u2" }]);
    off();
  });

  test("stopLiveSync retire le canal et garde les abonnés", () => {
    const seen: unknown[] = [];
    const off = live.onTable("accounts", (c) => seen.push(c.eventType));
    live.startLiveSync("u1");
    const ch = current();
    live.stopLiveSync();
    expect(ch.removed).toBe(true);
    expect(live.getLiveStatus()).toBe("offline");
    live.startLiveSync("u1");
    emit(current(), "accounts", { eventType: "DELETE", new: null, old: { id: "a" } });
    expect(seen).toEqual(["DELETE"]);
    off();
  });

  test("sans window (rendu serveur) : ne lève pas, n'ouvre rien", () => {
    delete g.window;
    try {
      expect(() => live.startLiveSync("u1")).not.toThrow();
      expect(channels.length).toBe(0);
    } finally {
      g.window = fakeWindow;
    }
  });
});

describe("liveSync — distribution", () => {
  test("un abonné ne reçoit que sa table, plus rien après désabonnement", () => {
    const seen: unknown[] = [];
    const off = live.onTable("goal_plans", (c) => seen.push(c));
    live.startLiveSync("u1");
    emit(current(), "notifications", { eventType: "INSERT", new: { id: "n" }, old: null });
    emit(current(), "goal_plans", { eventType: "UPDATE", new: { goals: [1] }, old: { goals: [] } });
    expect(seen).toEqual([
      { table: "goal_plans", eventType: "UPDATE", new: { goals: [1] }, old: { goals: [] } },
    ]);
    off();
    emit(current(), "goal_plans", { eventType: "UPDATE", new: { goals: [2] }, old: null });
    expect(seen.length).toBe(1);
  });

  test("un abonné qui lève n'empêche pas les suivants", () => {
    const errors = console.error;
    console.error = () => {};
    try {
      let reached = false;
      const a = live.onTable("ai_memory", () => {
        throw new Error("boom");
      });
      const b = live.onTable("ai_memory", () => {
        reached = true;
      });
      live.startLiveSync("u1");
      emit(current(), "ai_memory", { eventType: "INSERT", new: { id: "m" }, old: null });
      expect(reached).toBe(true);
      a();
      b();
    } finally {
      console.error = errors;
    }
  });
});

describe("liveSync — rattrapage", () => {
  test("pas de rattrapage au premier SUBSCRIBED, un après une coupure", () => {
    let resyncs = 0;
    const off = live.onResync(() => (resyncs += 1));
    live.startLiveSync("u1");
    current().statusCb!("SUBSCRIBED");
    expect(resyncs).toBe(0);
    current().statusCb!("CHANNEL_ERROR");
    current().statusCb!("SUBSCRIBED");
    expect(resyncs).toBe(1);
    off();
  });

  test("retour d'onglet après plus de 30 s cachée : rattrapage", () => {
    let resyncs = 0;
    const off = live.onResync(() => (resyncs += 1));
    live.startLiveSync("u1");
    current().statusCb!("SUBSCRIBED");
    setVisibility("hidden");
    setSystemTime(new Date("2026-10-19T10:00:31Z"));
    setVisibility("visible");
    expect(resyncs).toBe(1);
    off();
  });

  test("retour d'onglet après 5 s : pas de rattrapage", () => {
    let resyncs = 0;
    const off = live.onResync(() => (resyncs += 1));
    live.startLiveSync("u1");
    current().statusCb!("SUBSCRIBED");
    setVisibility("hidden");
    setSystemTime(new Date("2026-10-19T10:00:05Z"));
    setVisibility("visible");
    expect(resyncs).toBe(0);
    off();
  });
});

describe("liveSync — statut", () => {
  test("connecting → online → offline, notifié sans doublon", () => {
    const seen: string[] = [];
    const off = live.subscribeLiveStatus((s) => seen.push(s));
    live.startLiveSync("u1");
    expect(live.getLiveStatus()).toBe("connecting");
    current().statusCb!("SUBSCRIBED");
    current().statusCb!("SUBSCRIBED");
    expect(live.getLiveStatus()).toBe("online");
    current().statusCb!("TIMED_OUT");
    expect(live.getLiveStatus()).toBe("offline");
    expect(seen).toEqual(["connecting", "online", "offline"]);
    off();
  });

  test("le navigateur hors ligne passe le statut à offline", () => {
    live.startLiveSync("u1");
    current().statusCb!("SUBSCRIBED");
    fakeWindow.dispatchEvent(new Event("offline"));
    expect(live.getLiveStatus()).toBe("offline");
    fakeWindow.dispatchEvent(new Event("online"));
    expect(live.getLiveStatus()).toBe("connecting");
  });
});
