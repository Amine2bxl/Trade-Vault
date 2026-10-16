import { describe, expect, it } from "bun:test";
import { buildRoundTrips, positionKey } from "../roundTrips";
import { initialRisk, localDateTime, roundTripToTrade } from "../toTrade";
import {
  accountLabel,
  normalizeFills,
  parseAuthResponse,
  rootSymbol,
  stopOrders,
  totalFee,
  type ContractInfo,
  type TvFill,
  type TvOrder,
} from "../tradovate";
import type { BrokerFill } from "../types";

let seq = 0;
function fill(over: Partial<BrokerFill> & Pick<BrokerFill, "side" | "qty" | "price">): BrokerFill {
  seq++;
  return {
    id: over.id ?? `f${seq}`,
    accountId: "acc",
    contractId: "nq",
    symbol: "NQ",
    pointValue: 20,
    time: over.time ?? `2026-10-08T13:${String(30 + seq).padStart(2, "0")}:00.000Z`,
    fee: 0,
    ...over,
  };
}

describe("l'appariement plat → plat", () => {
  it("un long simple : entrée, sortie, P&L = Δprix × contrats × valeur du point", () => {
    const { trips, openKeys } = buildRoundTrips("tradovate", [
      fill({ id: "a", side: "buy", qty: 2, price: 18000, time: "2026-10-08T13:30:00Z", fee: 2.5 }),
      fill({ id: "b", side: "sell", qty: 2, price: 18010, time: "2026-10-08T13:45:00Z", fee: 2.5 }),
    ]);
    expect(openKeys).toEqual([]);
    expect(trips).toHaveLength(1);
    const t = trips[0];
    expect(t.direction).toBe("long");
    expect(t.quantity).toBe(2);
    expect(t.grossPnl).toBe(400); // 10 points × 2 × 20 $
    expect(t.fees).toBe(5);
    expect(t.netPnl).toBe(395);
    expect(t.externalId).toBe("tradovate:acc:a");
    expect(t.entryTime).toBe("2026-10-08T13:30:00Z");
    expect(t.exitTime).toBe("2026-10-08T13:45:00Z");
    expect(t.fillIds).toEqual(["a", "b"]);
  });

  it("renforts et sorties partielles forment UN seul trade, prix moyens pondérés", () => {
    const { trips } = buildRoundTrips("tradovate", [
      fill({ side: "sell", qty: 1, price: 100, time: "2026-10-08T14:00:00Z" }),
      fill({ side: "sell", qty: 1, price: 102, time: "2026-10-08T14:01:00Z" }),
      fill({ side: "buy", qty: 1, price: 99, time: "2026-10-08T14:05:00Z" }),
      fill({ side: "buy", qty: 1, price: 97, time: "2026-10-08T14:09:00Z" }),
    ]);
    expect(trips).toHaveLength(1);
    const t = trips[0];
    expect(t.direction).toBe("short");
    expect(t.quantity).toBe(2);
    expect(t.entryPrice).toBe(101);
    expect(t.exitPrice).toBe(98);
    expect(t.grossPnl).toBe(120); // (101 − 98) × 2 × 20
  });

  it("un retournement ferme le trade ET ouvre l'inverse, frais au prorata", () => {
    const { trips, openKeys } = buildRoundTrips("tradovate", [
      fill({ id: "x", side: "buy", qty: 2, price: 50, time: "2026-10-08T15:00:00Z" }),
      fill({ id: "y", side: "sell", qty: 3, price: 52, time: "2026-10-08T15:10:00Z", fee: 3 }),
      fill({ id: "z", side: "buy", qty: 1, price: 51, time: "2026-10-08T15:20:00Z" }),
    ]);
    expect(trips).toHaveLength(2);
    expect(trips[0].direction).toBe("long");
    expect(trips[0].grossPnl).toBe(80); // 2 points × 2 × 20
    expect(trips[0].fees).toBe(2); // 2/3 des 3 $
    expect(trips[1].direction).toBe("short");
    expect(trips[1].externalId).toBe("tradovate:acc:y");
    expect(trips[1].fees).toBe(1);
    expect(trips[1].grossPnl).toBe(20);
    expect(openKeys).toEqual([]);
  });

  it("une position encore ouverte ne produit AUCUN trade", () => {
    const { trips, openKeys } = buildRoundTrips("tradovate", [
      fill({ side: "buy", qty: 1, price: 10 }),
    ]);
    expect(trips).toEqual([]);
    expect(openKeys).toEqual([positionKey("acc", "nq")]);
  });

  it("une position ouverte AVANT la fenêtre est absorbée, jamais inventée", () => {
    const { trips } = buildRoundTrips(
      "tradovate",
      [
        fill({ side: "sell", qty: 1, price: 10, time: "2026-10-08T13:00:00Z" }),
        fill({ id: "n", side: "buy", qty: 1, price: 9, time: "2026-10-08T13:10:00Z" }),
        fill({ side: "sell", qty: 1, price: 12, time: "2026-10-08T13:20:00Z" }),
      ],
      { openingPositions: new Map([[positionKey("acc", "nq"), 1]]) },
    );
    expect(trips).toHaveLength(1);
    expect(trips[0].externalId).toBe("tradovate:acc:n");
    expect(trips[0].grossPnl).toBe(60);
  });

  it("deux comptes, deux contrats : des positions indépendantes", () => {
    const { trips } = buildRoundTrips("tradovate", [
      fill({ accountId: "A", side: "buy", qty: 1, price: 1, time: "2026-10-08T13:00:00Z" }),
      fill({ accountId: "B", side: "sell", qty: 1, price: 1, time: "2026-10-08T13:01:00Z" }),
      fill({ accountId: "A", side: "sell", qty: 1, price: 2, time: "2026-10-08T13:02:00Z" }),
      fill({ accountId: "B", side: "buy", qty: 1, price: 2, time: "2026-10-08T13:03:00Z" }),
    ]);
    expect(trips.map((t) => [t.accountId, t.grossPnl])).toEqual([
      ["A", 20],
      ["B", -20],
    ]);
  });

  it("déterministe : l'ordre d'arrivée des exécutions ne change rien", () => {
    const fills = [
      fill({ id: "p", side: "buy", qty: 1, price: 1, time: "2026-10-08T13:00:00Z" }),
      fill({ id: "q", side: "sell", qty: 1, price: 3, time: "2026-10-08T13:05:00Z" }),
    ];
    const a = buildRoundTrips("tradovate", fills).trips;
    const b = buildRoundTrips("tradovate", [...fills].reverse()).trips;
    expect(b).toEqual(a);
  });
});

describe("le risque initial — d'après le premier stop", () => {
  const trip = buildRoundTrips("tradovate", [
    fill({ side: "buy", qty: 2, price: 100, time: "2026-10-08T13:00:00Z" }),
    fill({ side: "sell", qty: 2, price: 110, time: "2026-10-08T13:30:00Z" }),
  ]).trips[0];

  it("|entrée − stop| × contrats × valeur du point", () => {
    const risk = initialRisk(trip, [
      {
        accountId: "acc",
        contractId: "nq",
        side: "sell",
        stopPrice: 95,
        time: "2026-10-08T12:59:58Z",
      },
    ]);
    expect(risk).toBe(200); // 5 × 2 × 20
  });

  it("ignore un stop du mauvais côté, d'un autre compte ou hors du trade", () => {
    expect(
      initialRisk(trip, [
        {
          accountId: "acc",
          contractId: "nq",
          side: "sell",
          stopPrice: 105,
          time: "2026-10-08T13:01:00Z",
        },
        {
          accountId: "other",
          contractId: "nq",
          side: "sell",
          stopPrice: 95,
          time: "2026-10-08T13:01:00Z",
        },
        {
          accountId: "acc",
          contractId: "nq",
          side: "sell",
          stopPrice: 95,
          time: "2026-10-08T14:00:00Z",
        },
      ]),
    ).toBeNull();
  });
});

describe("la ligne de journal", () => {
  const trip = buildRoundTrips("tradovate", [
    fill({ id: "e", side: "buy", qty: 1, price: 100, time: "2026-10-09T02:30:00Z", fee: 1 }),
    fill({ side: "sell", qty: 1, price: 104, time: "2026-10-09T02:50:00Z", fee: 1 }),
  ]).trips[0];

  it("date et heures dans le fuseau du trader, structure remplie, jugement laissé vide", () => {
    const t = roundTripToTrade(trip, {
      broker: "tradovate",
      id: "id-1",
      accountId: "tv-account",
      brokerAccountName: "APEX-1",
      timeZone: "America/New_York",
      defaultRisk: null,
      stops: [],
    });
    // 02:30 UTC le 9 = 22:30 le 8 à New York (heure d'été).
    expect(t.date).toBe("2026-10-08");
    expect(t.entryTime).toBe("22:30");
    expect(t.exitTime).toBe("22:50");
    expect(t.pnl).toBe(78); // 4 × 20 − 2 $ de frais
    expect(t.fees).toBe(2);
    expect(t.quantity).toBe(1);
    expect(t.reviewPending).toBe(true);
    expect(t.externalId).toBe("tradovate:acc:e");
    // Sans stop ni risque par défaut : rien d'inventé.
    expect(t.riskAmount).toBe(0);
    expect(t.rMultiple).toBe(0);
    expect(t.notes).toBe("");
    expect(t.mistakes).toEqual([]);
  });

  it("le risque par défaut déclaré donne le R quand aucun stop n'est retrouvé", () => {
    const t = roundTripToTrade(trip, {
      broker: "tradovate",
      id: "id-2",
      accountId: null,
      brokerAccountName: "APEX-1",
      timeZone: "UTC",
      defaultRisk: 52,
      stops: [],
    });
    expect(t.riskAmount).toBe(52);
    expect(t.rMultiple).toBe(1.5);
  });

  it("un fuseau invalide retombe sur UTC", () => {
    expect(localDateTime("2026-10-09T02:30:00Z", "Pas/Un_Fuseau")).toEqual({
      date: "2026-10-09",
      time: "02:30",
    });
  });
});

describe("l'adaptateur Tradovate", () => {
  const contracts = new Map<number, ContractInfo>([[7, { symbol: "MNQ", pointValue: 2 }]]);
  const orders = new Map<number, TvOrder>([
    [11, { id: 11, accountId: 900, timestamp: "2026-10-08T13:00:00Z" }],
  ]);
  const raw: TvFill[] = [
    {
      id: 1,
      orderId: 11,
      contractId: 7,
      timestamp: "2026-10-08T13:00:00Z",
      action: "Buy",
      qty: 3,
      price: 20000,
    },
    {
      id: 2,
      orderId: 99,
      contractId: 7,
      timestamp: "2026-10-08T13:01:00Z",
      action: "Sell",
      qty: 3,
      price: 20001,
    },
    {
      id: 3,
      orderId: 11,
      contractId: 8,
      timestamp: "2026-10-08T13:02:00Z",
      action: "Sell",
      qty: 3,
      price: 1,
    },
    {
      id: 4,
      orderId: 11,
      contractId: 7,
      timestamp: "2026-10-08T13:03:00Z",
      action: "Sell",
      qty: 3,
      price: 1,
      active: false,
    },
  ];

  it("écarte ce qu'il ne sait pas rattacher (ordre ou contrat inconnu), ignore un fill annulé", () => {
    const { fills, skipped } = normalizeFills(
      raw,
      orders,
      contracts,
      new Map([[1, { id: 1, commission: 1.2, exchangeFee: 0.3 }]]),
    );
    expect(fills).toHaveLength(1);
    expect(skipped).toBe(2);
    expect(fills[0]).toMatchObject({
      id: "1",
      accountId: "900",
      symbol: "MNQ",
      pointValue: 2,
      side: "buy",
      qty: 3,
      fee: 1.5,
    });
  });

  it("frais : total positif", () => {
    expect(totalFee({ id: 1, commission: -0.5, nfaFee: 0.02 })).toBe(0.52);
    expect(totalFee(undefined)).toBe(0);
  });

  it("racine d'un contrat", () => {
    expect(rootSymbol("MNQZ5")).toBe("MNQ");
    expect(rootSymbol("ESH26")).toBe("ES");
    expect(rootSymbol("CL")).toBe("CL");
  });

  it("le stop retenu est la PREMIÈRE version de l'ordre", () => {
    const stops = stopOrders(
      [{ id: 5, accountId: 900, contractId: 7, timestamp: "2026-10-08T13:00:01Z", action: "Sell" }],
      [
        { id: 51, orderId: 5, orderType: "Stop", stopPrice: 19990 },
        { id: 52, orderId: 5, orderType: "Stop", stopPrice: 19999 },
      ],
    );
    expect(stops).toEqual([
      {
        accountId: "900",
        contractId: "7",
        side: "sell",
        stopPrice: 19990,
        time: "2026-10-08T13:00:01.000Z",
      },
    ]);
  });

  it("un ordre limite n'est pas un stop", () => {
    expect(
      stopOrders(
        [
          {
            id: 6,
            accountId: 900,
            contractId: 7,
            timestamp: "2026-10-08T13:00:01Z",
            action: "Sell",
          },
        ],
        [{ id: 61, orderId: 6, orderType: "Limit", price: 20010 }],
      ),
    ).toEqual([]);
  });

  it("libellé de compte : le surnom d'abord", () => {
    expect(accountLabel({ id: 1, name: "APEX-123", nickname: "Eval 50K" })).toBe("Eval 50K");
    expect(accountLabel({ id: 1, name: "APEX-123", nickname: "  " })).toBe("APEX-123");
  });

  it("les trois réponses d'authentification", () => {
    expect(
      parseAuthResponse({ accessToken: "tok", expirationTime: "2026-10-08T15:00:00Z", userId: 4 }),
    ).toEqual({
      ok: true,
      accessToken: "tok",
      expiresAt: "2026-10-08T15:00:00.000Z",
      userId: "4",
    });
    expect(parseAuthResponse({ errorText: "Incorrect username or password" })).toEqual({
      ok: false,
      reason: "invalid",
      message: "Incorrect username or password",
    });
    expect(parseAuthResponse({ "p-ticket": "t", "p-time": 15 })).toMatchObject({
      ok: false,
      reason: "penalty",
      retryInSec: 15,
    });
    expect(parseAuthResponse({ "p-ticket": "t", "p-captcha": true })).toMatchObject({
      ok: false,
      reason: "captcha",
    });
  });
});
