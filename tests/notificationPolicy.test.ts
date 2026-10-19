import { describe, expect, test } from "bun:test";
import {
  badgeLabel,
  createPersistAdapter,
  notificationDedupKey,
  planArchive,
  shouldClosePopup,
  shouldInterrupt,
} from "../src/modules/notifications/policy";
import { evaluateNotificationRules } from "../src/modules/notifications/rules";

const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();
const n = (id: string, kind: string, createdAt: string, title = "t", body = "b") => ({
  id,
  kind: kind as never,
  title,
  body,
  createdAt,
  readAt: null,
});

describe("la boîte s'entretient : expiration et doublons", () => {
  test("une annonce économique expire en un jour, une alerte ordinaire en deux semaines", () => {
    const out = planArchive([
      n("eco-old", "economic_event", at(2)),
      n("eco-new", "economic_event", at(0.2)),
      n("leak-10", "risk_max_loss", at(10)),
      n("leak-20", "risk_max_loss", at(20), "autre"),
    ]);
    expect(out.sort()).toEqual(["eco-old", "leak-20"]);
  });

  test("les répétitions identiques ne laissent que la plus récente à lire", () => {
    const out = planArchive([
      n("a", "discipline_success", at(0.1), "Armed", "3 rules"),
      n("b", "discipline_success", at(1), "Armed", "3 rules"),
      n("c", "discipline_success", at(2), "Armed", "3 rules"),
      n("d", "discipline_success", at(1), "Armed", "4 rules"),
    ]);
    expect(out.sort()).toEqual(["b", "c"]);
  });
});

describe("un seul popup : l'annonce majeure, une heure avant", () => {
  test("seule l'alerte économique marquée popup interrompt", () => {
    expect(shouldInterrupt({ kind: "economic_event", data: { popup: true } })).toBe(true);
    expect(shouldInterrupt({ kind: "economic_event", data: {} })).toBe(false);
    // Une alerte grave du journal attend dans la boîte de réception.
    expect(shouldInterrupt({ kind: "risk_loss_streak", data: { popup: true } })).toBe(false);
    expect(shouldInterrupt({ kind: "discipline_limit" })).toBe(false);
  });
});

describe("le compteur dit le vrai nombre", () => {
  test("pas de plafond à 99", () => {
    expect(badgeLabel(7)).toBe("7");
    expect(badgeLabel(100)).toBe("100");
    expect(badgeLabel(640)).toBe("640");
    expect(badgeLabel(1200)).toBe("999+");
  });
});

describe("la cadence des règles : un événement, pas un jour", () => {
  const ctx = {
    trades: [
      { date: "2026-01-02", pnl: -50, mistakes: ["FOMO"] },
      { date: "2026-01-03", pnl: -80, mistakes: ["FOMO"] },
    ],
    stats: {
      totalPnl: -130,
      winRate: 0,
      tradeCount: 2,
      mistakeStats: { FOMO: { count: 2, totalPnl: -130 } },
    },
    rulesEnabled: 3,
  };
  test("« discipline armée » ne dépend plus de la date, seulement du nombre de règles", () => {
    const armed = evaluateNotificationRules(ctx).find((r) => r.key.startsWith("discipline_armed"));
    expect(armed?.key).toBe("discipline_armed:3");
    expect(armed?.once).toBe(true);
  });
  test("la fuite la plus coûteuse est rappelée par semaine, pas par jour", () => {
    const leak = evaluateNotificationRules(ctx).find((r) => r.key.startsWith("risk_leak"));
    expect(leak?.key).toMatch(/^risk_leak:FOMO:\d{4}-\d{2}-\d{2}$/);
    const monday = leak!.key.split(":")[2];
    expect(new Date(monday + "T12:00:00").getDay()).toBe(1);
  });
  test("l'inactivité est signalée une fois par période, pas chaque jour", () => {
    const lull = evaluateNotificationRules(ctx).find((r) => r.key.startsWith("activity_lull"));
    expect(lull?.key).toBe("activity_lull:2026-01-03");
    expect(lull?.once).toBe(true);
  });
});

// ── Plusieurs appareils, une seule alerte ────────────────────────────────────
const notif = (data?: Record<string, unknown>, kind = "discipline_warning") =>
  ({
    id: "n1",
    userId: "u1",
    kind,
    title: "t",
    body: "b",
    severity: "info",
    channels: ["dashboard"],
    category: "discipline",
    createdAt: "2026-10-19T10:00:00Z",
    readAt: null,
    data,
  }) as never;

describe("clé anti-doublon en base", () => {
  test("sans clé : aucune contrainte", () => {
    expect(notificationDedupKey(notif(), "2026-10-19")).toBeNull();
  });

  test("règle codée : la clé telle quelle (elle porte déjà sa période)", () => {
    expect(
      notificationDedupKey(
        notif({ codedRule: true, dedupKey: "weekly_review:2026-10-12" }),
        "2026-10-19",
      ),
    ).toBe("weekly_review:2026-10-12");
  });

  test("alerte de l'engine : une par jour", () => {
    expect(
      notificationDedupKey(notif({ dedupKey: "discipline_warning:max_trades" }), "2026-10-19"),
    ).toBe("2026-10-19:discipline_warning:max_trades");
  });
});

describe("le popup ne s'ouvre que sur l'appareil qui a créé la ligne", () => {
  const popup = () => notif({ popup: true }, "economic_event");

  test("doublon refusé par la base : pas de popup ici", async () => {
    const opened: unknown[] = [];
    const persist = createPersistAdapter({
      persist: async () => false,
      open: (n) => opened.push(n),
    });
    await persist(popup());
    expect(opened).toEqual([]);
  });

  test("ligne créée et annonce majeure : un popup", async () => {
    const opened: unknown[] = [];
    const persist = createPersistAdapter({
      persist: async () => true,
      open: (n) => opened.push(n),
    });
    await persist(popup());
    expect(opened.length).toBe(1);
  });

  test("ligne créée sans interruption : jamais de popup", async () => {
    const opened: unknown[] = [];
    const persist = createPersistAdapter({
      persist: async () => true,
      open: (n) => opened.push(n),
    });
    await persist(notif({ dedupKey: "x" }));
    expect(opened).toEqual([]);
  });
});

describe("un popup fermé sur un appareil se ferme sur les autres", () => {
  test("fermé ailleurs (dismissedAt) : se ferme", () => {
    expect(
      shouldClosePopup("n1", {
        id: "n1",
        data: { popup: true, dismissedAt: "2026-10-19T10:01:00Z" },
      }),
    ).toBe(true);
  });

  test("simplement lu (l'ouverture marque lu) : reste ouvert", () => {
    expect(
      shouldClosePopup("n1", { id: "n1", read_at: "2026-10-19T10:00:01Z", data: { popup: true } }),
    ).toBe(false);
  });

  test("une autre notification : sans effet", () => {
    expect(shouldClosePopup("n1", { id: "n2", data: { dismissedAt: "x" } })).toBe(false);
    expect(shouldClosePopup(null, { id: "n1", data: { dismissedAt: "x" } })).toBe(false);
  });
});

describe("un push par alerte, pas un par appareil", () => {
  test("ligne déjà créée par un autre appareil : pas de push ici", async () => {
    const { NotificationEngine } = await import("../src/modules/notifications/engine");
    const pushes: unknown[] = [];
    NotificationEngine.configure("u1", {
      persist: async () => false,
      push: async (p) => pushes.push(p),
    });
    await NotificationEngine.notify("u1", {
      kind: "risk_max_loss",
      title: "t",
      body: "b",
      channels: ["dashboard", "push"],
      dedupKey: "risk:x",
    } as never);
    expect(pushes).toEqual([]);
  });

  test("ligne créée ici : le push part", async () => {
    const { NotificationEngine } = await import("../src/modules/notifications/engine");
    const pushes: unknown[] = [];
    NotificationEngine.configure("u1", {
      persist: async () => true,
      push: async (p) => pushes.push(p),
    });
    await NotificationEngine.notify("u1", {
      kind: "risk_max_loss",
      title: "t",
      body: "b",
      channels: ["dashboard", "push"],
      dedupKey: "risk:y",
    } as never);
    expect(pushes.length).toBe(1);
  });

  test("push seul (sans boîte) : il part", async () => {
    const { NotificationEngine } = await import("../src/modules/notifications/engine");
    const pushes: unknown[] = [];
    NotificationEngine.configure("u1", {
      persist: async () => false,
      push: async (p) => pushes.push(p),
    });
    await NotificationEngine.notify("u1", {
      kind: "risk_max_loss",
      title: "t",
      body: "b",
      channels: ["push"],
    } as never);
    expect(pushes.length).toBe(1);
  });
});
