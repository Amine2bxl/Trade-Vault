import { describe, expect, test } from "bun:test";
import type { Trade } from "../src/domain/trade";
import { measuredR } from "../src/domain/trade";
import { easternClockOf, instantMs } from "../src/domain/easternClock";
import { easternEntryMinute, getSessionForTrade, statsByHour } from "../src/domain/quantStats";
import {
  hasVerifiedRealizedOrder,
  verifiedPriorClosedTrade,
  compareChronological,
} from "../src/domain/tradeOrder";

/**
 * PROVENANCE (lot 1) — ce qu'un instant UTC prouvé et une source de risque
 * enregistrée permettent d'établir, et rien de plus.
 */

function trade(id: string, over: Partial<Trade>): Trade {
  return {
    id,
    date: "2026-10-21",
    symbol: "NQ",
    direction: "long",
    pnl: 100,
    riskAmount: 50,
    rMultiple: 2,
    strategy: "ORB",
    mistakes: [],
    setupQuality: 3,
    notes: "",
    screenshots: [],
    entryTime: "",
    exitTime: "",
    confluences: [],
    confidence: 50,
    accountId: "acc",
    ...over,
  };
}

describe("horloge de New York d'un instant prouvé", () => {
  test("un instant sans décalage n'est pas un instant", () => {
    expect(instantMs("2026-10-21T14:00:00")).toBeNull();
    expect(instantMs("2026-10-21T14:00:00Z")).not.toBeNull();
    expect(instantMs("2026-10-21T16:00:00+02:00")).toBe(instantMs("2026-10-21T14:00:00Z"));
  });

  test("passage à l'heure d'été (8 mars 2026) : 14:30 UTC = 09:30 la veille, 10:30 le jour même", () => {
    expect(easternClockOf("2026-03-07T14:30:00Z")).toEqual({
      date: "2026-03-07",
      minute: 570,
      weekday: 6,
    });
    expect(easternClockOf("2026-03-08T14:30:00Z")).toEqual({
      date: "2026-03-08",
      minute: 630,
      weekday: 0,
    });
  });

  test("retour à l'heure d'hiver (1er novembre 2026)", () => {
    expect(easternClockOf("2026-10-31T14:30:00Z")?.minute).toBe(630);
    expect(easternClockOf("2026-11-01T14:30:00Z")?.minute).toBe(570);
  });

  test("le jour de New York peut différer du jour UTC", () => {
    // 02:00 UTC le 22 = 22:00 à New York le 21.
    expect(easternClockOf("2026-10-22T02:00:00Z")).toEqual({
      date: "2026-10-21",
      minute: 1320,
      weekday: 3,
    });
  });
});

describe("session d'un trade broker", () => {
  test("sans instant, l'heure d'un import broker n'est pas une heure Eastern", () => {
    expect(getSessionForTrade(trade("a", { broker: "tradovate", entryTime: "09:30" }))).toBeNull();
  });

  test("avec l'instant prouvé, la session se DÉDUIT — et ne lit jamais l'heure locale du trader", () => {
    // Trader à Paris : 08:30 locale = 06:30 UTC = 02:30 à New York → Londres.
    // Lire « 08:30 » comme une heure Eastern aurait dit New York.
    const paris = trade("p", {
      broker: "tradovate",
      entryTime: "08:30",
      entryAt: "2026-10-21T06:30:00Z",
      sourceTimezone: "Europe/Paris",
    });
    expect(easternEntryMinute(paris)).toBe(150);
    expect(getSessionForTrade(paris)).toBe("london");
    expect(statsByHour([paris])[2]?.count).toBe(1);
    expect(statsByHour([paris])[8]).toBeUndefined();
  });

  test("une saisie manuelle garde la convention du journal (heure Eastern)", () => {
    expect(getSessionForTrade(trade("m", { entryTime: "09:30" }))).toBe("newyork");
  });
});

describe("ordre et prédécesseur sur instants prouvés", () => {
  test("une position tenue la nuit est un prédécesseur prouvé quand ses instants le sont", () => {
    const night = trade("n", {
      broker: "tradovate",
      date: "2026-10-20",
      pnl: -100,
      entryTime: "18:00",
      exitTime: "21:00",
      entryAt: "2026-10-20T22:00:00Z",
      exitAt: "2026-10-21T01:00:00Z",
    });
    const next = trade("x", {
      broker: "tradovate",
      entryTime: "09:30",
      exitTime: "09:45",
      entryAt: "2026-10-21T13:30:00Z",
      exitAt: "2026-10-21T13:45:00Z",
    });
    const ordered = [night, next].sort(compareChronological);
    expect(verifiedPriorClosedTrade(ordered, 1)?.id).toBe("n");
    expect(hasVerifiedRealizedOrder(ordered)).toBe(true);
  });

  test("une perte encore ouverte à l'instant de l'entrée suivante n'est pas un prédécesseur", () => {
    const open = trade("o", {
      entryAt: "2026-10-21T13:30:00Z",
      exitAt: "2026-10-21T15:00:00Z",
      pnl: -100,
    });
    const next = trade("y", { entryAt: "2026-10-21T14:00:00Z", exitAt: "2026-10-21T14:10:00Z" });
    expect(verifiedPriorClosedTrade([open, next], 1)).toBeNull();
  });

  test("un trade du même compte SANS instant, le même jour, rend l'ordre inconnu", () => {
    const a = trade("a", { entryAt: "2026-10-21T13:30:00Z", exitAt: "2026-10-21T13:40:00Z" });
    const manual = trade("m", { entryTime: "09:50", exitTime: "09:55" });
    const b = trade("b", { entryAt: "2026-10-21T14:00:00Z", exitAt: "2026-10-21T14:10:00Z" });
    const ordered = [a, b, manual];
    expect(verifiedPriorClosedTrade(ordered, 1)).toBeNull();
  });

  test("deux sorties au même instant ne s'ordonnent pas", () => {
    const a = trade("a", { entryAt: "2026-10-21T13:30:00Z", exitAt: "2026-10-21T13:40:00Z" });
    const b = trade("b", { entryAt: "2026-10-21T13:31:00Z", exitAt: "2026-10-21T13:40:00Z" });
    expect(hasVerifiedRealizedOrder([a, b])).toBe(false);
  });
});

describe("R mesuré selon la source du risque", () => {
  test("broker : seul un stop observé ou un risque ressaisi par le trader compte", () => {
    const base = { broker: "tradovate", pnl: 100, riskAmount: 50 } as const;
    expect(measuredR(trade("s", { ...base, riskSource: "broker_stop" }))).toBe(2);
    expect(measuredR(trade("u", { ...base, riskSource: "user" }))).toBe(2);
    expect(measuredR(trade("d", { ...base, riskSource: "broker_default" }))).toBeNull();
    // Antérieur au lot 1 : la provenance n'a pas été enregistrée.
    expect(measuredR(trade("l", { ...base, riskSource: null }))).toBeNull();
  });

  test("un import à relire n'a pas de R, quelle que soit la source", () => {
    expect(measuredR(trade("p", { reviewPending: true, riskSource: "csv" }))).toBeNull();
  });

  test("une saisie manuelle historique (source inconnue) garde son R déclaré", () => {
    expect(measuredR(trade("m", { riskSource: null }))).toBe(2);
    expect(measuredR(trade("c", { riskSource: "csv" }))).toBe(2);
  });
});
