import { describe, expect, test } from "bun:test";
import {
  badgeLabel,
  noteTradeAction,
  planArchive,
  shouldInterrupt,
  LIVE_WINDOW_MS,
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

describe("le popup se mérite par le contexte", () => {
  test("une alerte grave n'interrompt que juste après un trade enregistré", () => {
    const t0 = 1_000_000;
    expect(shouldInterrupt({ severity: "error" }, t0)).toBe(false);
    noteTradeAction(t0);
    expect(shouldInterrupt({ severity: "error" }, t0 + 30_000)).toBe(true);
    expect(shouldInterrupt({ severity: "warning" }, t0 + 30_000)).toBe(false);
    expect(shouldInterrupt({ severity: "error" }, t0 + LIVE_WINDOW_MS + 1)).toBe(false);
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
