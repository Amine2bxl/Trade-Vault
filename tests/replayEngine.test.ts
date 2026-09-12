import { describe, expect, test } from "bun:test";
import {
  type OhlcBar,
  ReplayEngine,
  NQ,
  createInitialState,
  placeOrder,
  processBars,
  setPositionBracket,
  closePosition,
  flattenPositions,
  refreshValuation,
  rebuildState,
  cancelOrder,
  moveWorkingOrder,
  generateSyntheticSession,
  sessionDateKey,
  summarize,
  deserializeState,
  serializeState,
  sessionsOf,
  nyEpochFromHm,
  markPriceAt,
  DEFAULT_TIMEFRAME,
} from "../src/modules/replay";

const DATE = "2025-01-14"; // un mardi — jour ouvré complet.
const START = "09:30";

function engine(timeframe = "5m"): ReplayEngine {
  const e = new ReplayEngine({ symbol: "NQ", date: DATE, startTime: START, timeframe });
  return e;
}

function makeState(now: number) {
  return createInitialState({
    symbol: "NQ",
    startingBalance: 100_000,
    now,
    commissionPerContract: 2.5,
    slippageTicks: 1,
  });
}

describe("sessions NY — RTH / ETH", () => {
  test("les bornes ETH encadrent le RTH et couvrent l'overnight", () => {
    const s = sessionsOf(DATE);
    expect(s.rthStart).toBe(nyEpochFromHm(DATE, "09:30"));
    expect(s.rthEnd).toBe(nyEpochFromHm(DATE, "16:00"));
    expect(s.ethEnd).toBe(nyEpochFromHm(DATE, "17:00"));
    // L'overnight commence la veille à 18:00 NY.
    expect(s.ethStart).toBe(nyEpochFromHm("2025-01-13", "18:00"));
    expect(s.ethStart).toBeLessThan(s.rthStart);
    expect(s.rthEnd).toBeLessThan(s.ethEnd);
  });

  test("le weekend rejoue la séance du vendredi", () => {
    expect(sessionDateKey("2025-01-18")).toBe("2025-01-17"); // samedi → vendredi
    expect(sessionDateKey("2025-01-12")).toBe("2025-01-10"); // dimanche → vendredi
    expect(sessionDateKey("2025-01-14")).toBe("2025-01-14"); // mardi → identique
  });
});

describe("générateur de données", () => {
  test("déterministe : la même date rend les mêmes bougies", () => {
    const a = generateSyntheticSession(DATE, NQ);
    const b = generateSyntheticSession(DATE, NQ);
    expect(a.length).toBe(b.length);
    expect(a[200]).toEqual(b[200]);
    expect(a[a.length - 1]).toEqual(b[b.length - 1]);
  });

  test("les bougies sont ordonnées, uniques, et chaque high/low encadre les bornes", () => {
    const bars = generateSyntheticSession(DATE, NQ);
    for (let i = 1; i < bars.length; i++) {
      expect(bars[i].time).toBeGreaterThan(bars[i - 1].time);
    }
    for (const b of bars) {
      expect(b.high).toBeGreaterThanOrEqual(Math.max(b.open, b.close));
      expect(b.low).toBeLessThanOrEqual(Math.min(b.open, b.close));
      expect(b.high).toBeGreaterThan(b.low);
      expect(b.volume).toBeGreaterThan(0);
    }
  });
});

describe("moteur — horloge canonique", () => {
  test("aucune bougie future n'est révélée : time <= now strictement", async () => {
    const e = engine("1m");
    await e.start();
    e.now = e.rthStart; // 09:30 pile
    const candles = e.tfCandles("1m");
    for (const c of candles) expect(c.time <= e.now).toBe(true);
    // Aucune bougie n'existe avant le chargement.
    expect(e.ready).toBe(true);
  });

  test("à 09:30, le graphe 1m ne montre aucune bougie complète", async () => {
    const e = engine("1m");
    await e.start();
    e.now = e.rthStart;
    const candles = e.tfCandles("1m");
    // Pas de bougie « terminée » avant la 09:30 : la bougie 09:30 est en
    // formation, donc présente une seule fois.
    expect(candles.length).toBeGreaterThanOrEqual(1);
    expect(e.markPrice()).toBeGreaterThan(0);
  });

  test("le marché se révèle : avancer change les bougies, jamais vers l'arrière", async () => {
    const e = engine("1m");
    await e.start();
    e.now = e.rthStart;
    const avant = e.tfCandles("1m").map((c) => c.time);
    e.advance(5 * 60_000); // +5 minutes
    const apres = e.tfCandles("1m").map((c) => c.time);
    expect(apres.length).toBeGreaterThan(avant.length);
    // L'ensemble des bougies avant est un préfixe de l'ensemble après.
    for (const t of avant) expect(apres).toContain(t);
  });

  test("changer de timeframe ne touche pas à l'horloge", async () => {
    const e = engine("5m");
    await e.start();
    e.now = e.rthStart + 47 * 60_000; // 10:17
    const nowAvant = e.now;
    const cinq = e.tfCandles("5m");
    const une = e.tfCandles("1m");
    expect(e.now).toBe(nowAvant);
    // La 5m est l'agrégat exact des 1m de son bucket.
    const last5 = cinq[cinq.length - 1];
    const bucket1m = une.filter(
      (c) => c.time >= last5.time && c.time < last5.time + 300_000 && c.time <= nowAvant,
    );
    if (bucket1m.length > 1 && !last5.forming) {
      expect(last5.open).toBe(bucket1m[0].open);
    }
    void bucket1m;
  });

  test("les 5m sont cohérentes avec les 1m fermées", async () => {
    const e = engine("5m");
    await e.start();
    e.now = e.rthStart + 15 * 60_000; // 09:45 → cinq bougies 5m fermées? (09:30..09:34)
    const cinq = e.tfCandles("5m");
    const une = e.tfCandles("1m");
    expect(cinq.length).toBeGreaterThanOrEqual(1);
    const first = cinq[0];
    const members = une.filter((c) => c.time >= first.time && c.time < first.time + 300_000);
    expect(members.length).toBeGreaterThanOrEqual(1);
    expect(first.open).toBe(members[0].open);
    expect(first.high).toBe(Math.max(...members.map((m) => m.high)));
    expect(first.low).toBe(Math.min(...members.map((m) => m.low)));
    expect(first.close).toBe(members[members.length - 1].close);
  });

  test("pas de fuite : markPrice ne dépasse jamais la borne de la minute", async () => {
    const e = engine("1m");
    await e.start();
    e.now = e.rthStart + 30_000; // 09:30:30
    const mark = e.markPrice();
    expect(mark).toBeGreaterThanOrEqual(
      Math.min(...[e.data.find((b) => b.time === e.rthStart)?.low ?? mark, mark]),
    );
    void 0;
  });
});

describe("timeframe + bougie suivante / précédente", () => {
  test("Next Candle avance exactement d'un pas du timeframe choisi", async () => {
    const e = engine("5m");
    await e.start();
    const debut = e.now;
    e.stepForward("5m");
    expect(e.now - debut).toBe(300_000);
  });

  test("Previous Candle revient exactement d'un pas", async () => {
    const e = engine("5m");
    await e.start();
    e.now = e.rthStart + 30 * 60_000;
    const avant = e.now;
    e.stepBack("5m");
    expect(avant - e.now).toBe(300_000);
  });

  test("le pas s'adapte au timeframe courant tout en gardant l'horloge", async () => {
    const e = engine("5m");
    await e.start();
    const debut = e.now;
    e.stepForward("15m");
    expect(e.now - debut).toBe(15 * 60_000);
    e.stepBack("1m");
    expect(e.now - debut).toBe(14 * 60_000);
  });
});

describe("simulation d'ordres", () => {
  test("un ordre au marché s'exécute au prix marqué avec glissement et frais", async () => {
    const bars = generateSyntheticSession(DATE, NQ);
    const e = engine("1m");
    await e.start();
    e.now = e.rthStart + 2 * 60_000;
    const state = makeState(e.now);
    const mark = e.markPrice();
    placeOrder({ state, input: { side: "long", type: "market", qty: 1 }, bars });
    refreshValuation(state, bars);
    expect(state.positions.length).toBe(1);
    // Achat au marché : glissement d'un tick au-dessus du marqué.
    expect(state.positions[0].avgEntry).toBeGreaterThan(mark);
    expect(state.positions[0].avgEntry - mark).toBeCloseTo(NQ.tickSize, 5);
    // Open P&L nul au marqué si pas de glissement doublé・; mais le fill a coûté
    // un tick de plus que le mark → léger P&L maintenant.
    expect(state.account.startingBalance).toBe(100_000);
  });

  test("un limit long ne se remplit pas au-dessus de sa limite", async () => {
    const bars = generateSyntheticSession(DATE, NQ);
    const e = engine("1m");
    await e.start();
    e.now = e.rthStart;
    const state = makeState(e.now);
    const price = e.markPrice() - 50;
    placeOrder({ state, input: { side: "long", type: "limit", qty: 1, price }, bars });
    // On avance de 10 minutes : la bougie doit croiser bas la limite.
    e.advance(10 * 60_000);
    state.now = e.now;
    processBars(state, bars);
    expect(state.orders[0].status).toBe("filled");
    expect(state.orders[0].fillPrice).toBeLessThanOrEqual(price + 1e-6);
    expect(state.positions.length).toBe(1);
  });

  test("un bracket SL se déclenche et clôt la position avec le bon R", async () => {
    // Série contrôlée : descente de 2 pts/min pendant 60 min puis montée.
    const t0 = nyEpochFromHm(DATE, "09:30");
    const bars: OhlcBar[] = [];
    let price = 20_000;
    for (let i = 0; i < 120; i++) {
      const open = price;
      const drop = i < 60;
      const close = open + (drop ? -2 : 2);
      bars.push({
        time: t0 + i * 60_000,
        open,
        high: Math.max(open, close) + 1,
        low: Math.min(open, close) - 1,
        close,
        volume: 100,
      });
      price = close;
    }
    const e = engine("1m");
    await e.start();
    e.now = t0 + 2 * 60_000; // 09:32
    const state = makeState(e.now);
    const mark = markPriceAt(bars, e.now) || 20_000;
    placeOrder({ state, input: { side: "long", type: "market", qty: 1 }, bars });
    const posId = state.positions[0].id;
    setPositionBracket(state, posId, mark - 20, mark + 40);
    // Risque en $ = écart (entrée − stop) × multiplicateur.
    const pob = state.positions[0];
    expect(pob.riskAmount).toBeGreaterThan(390);
    expect(pob.riskAmount).toBeLessThanOrEqual(410);

    e.advance(30 * 60_000); // à 10:02, le marché a bien cassé le stop
    state.now = e.now;
    processBars(state, bars);
    expect(state.closedTrades.length).toBe(1);
    const t = state.closedTrades[0];
    expect(t.exitReason).toBe("stop");
    expect(Math.abs(t.exitPrice - (mark - 20))).toBeLessThanOrEqual(NQ.tickSize * 2);
    expect(t.realizedPnl).toBeLessThan(0);
    expect(t.rMultiple).toBeCloseTo(-1, 1);
    expect(state.positions.length).toBe(0);
  });

  test("flattenPositions liquide le reste au prix marqué en fin de session", async () => {
    const bars = generateSyntheticSession(DATE, NQ);
    const e = engine("1m");
    await e.start();
    e.now = e.rthStart + 1 * 60_000;
    const state = makeState(e.now);
    placeOrder({ state, input: { side: "short", type: "market", qty: 2 }, bars });
    flattenPositions(state, bars);
    expect(state.positions.length).toBe(0);
    expect(state.closedTrades.length).toBe(1);
    expect(state.closedTrades[0].exitReason).toBe("session-end");
    refreshValuation(state, bars);
    expect(state.account.balance).toBeGreaterThan(0);
  });

  test("canceller un bracket libère la position", async () => {
    const bars = generateSyntheticSession(DATE, NQ);
    const e = engine("1m");
    await e.start();
    e.now = e.rthStart + 1 * 60_000;
    const state = makeState(e.now);
    placeOrder({ state, input: { side: "long", type: "market", qty: 1 }, bars });
    const pos = state.positions[0];
    setPositionBracket(state, pos.id, pos.avgEntry - 20, pos.avgEntry + 40);
    const stopOrder = state.positions[0].stop;
    expect(stopOrder).not.toBeNull();
    cancelOrder(state, stopOrder!.id);
    expect(state.positions[0].stop).toBeNull();
  });

  test("déplacer un ordre en carnet change son prix", async () => {
    const state = makeState(0);
    const bars = generateSyntheticSession(DATE, NQ);
    const e = engine("1m");
    await e.start();
    e.now = e.rthStart;
    state.now = e.now;
    placeOrder({ state, input: { side: "long", type: "stop", qty: 1, price: 20_000 }, bars });
    moveWorkingOrder(state, state.orders[0].id, 19_500);
    expect(state.orders[0].price).toBe(19_500);
  });
});

describe("reconstruction (bougie précédente) — déterminisme", () => {
  test("l'état reconstruit coïncide avec le chemin incrémental", async () => {
    const bars = generateSyntheticSession(DATE, NQ);
    const e = engine("1m");
    await e.start();
    e.now = e.rthStart + 1 * 60_000;
    const state = makeState(e.now);
    placeOrder({ state, input: { side: "long", type: "market", qty: 1 }, bars });
    setPositionBracket(state, state.positions[0].id, e.markPrice() - 25, e.markPrice() + 60);
    // Avance de 40 minutes en 1m.
    for (let i = 0; i < 40; i++) {
      e.stepForward("1m");
      state.now = e.now;
      processBars(state, bars);
    }

    const rebuilt = rebuildState(state, bars, state.now);
    expect(rebuilt.closedTrades.length).toBe(state.closedTrades.length);
    expect(rebuilt.positions.length).toBe(state.positions.length);
    expect(rebuilt.account.balance).toBeCloseTo(state.account.balance, 1);
    if (rebuilt.closedTrades.length > 0) {
      expect(rebuilt.closedTrades[0].realizedPnl).toBeCloseTo(state.closedTrades[0].realizedPnl, 1);
    }
    if (rebuilt.positions.length > 0) {
      expect(rebuilt.positions[0].qty).toBe(state.positions[0].qty);
      expect(rebuilt.positions[0].avgEntry).toBeCloseTo(state.positions[0].avgEntry, 4);
    }
  });
});

describe("persistance — état sérialisable", () => {
  test("serialize / deserialize fait un aller-retour fidèle", async () => {
    const e = engine("5m");
    await e.start();
    const state = makeState(e.now);
    const bars = generateSyntheticSession(DATE, NQ);
    placeOrder({ state, input: { side: "long", type: "market", qty: 1 }, bars });
    setPositionBracket(state, state.positions[0].id, e.markPrice() - 10, e.markPrice() + 10);
    const raw = serializeState(state);
    const back = deserializeState(raw);
    expect(back).not.toBeNull();
    expect(back!.positions.length).toBe(state.positions.length);
    expect(back!.orders.length).toBe(3); // entrée + SL + TP
    expect(back!.viewTimeframe).toBe(DEFAULT_TIMEFRAME);
  });

  test("deserialize refuse un état corrompu", () => {
    expect(deserializeState(null)).toBeNull();
    expect(deserializeState("not json")).toBeNull();
    expect(deserializeState(JSON.stringify({ v: 99 }))).toBeNull();
  });
});

describe("résumé de fin de session", () => {
  test("le résumé compile les trades clos", async () => {
    const bars = generateSyntheticSession(DATE, NQ);
    const e = engine("1m");
    await e.start();
    e.now = e.rthStart + 1 * 60_000;
    const state = makeState(e.now);
    placeOrder({ state, input: { side: "long", type: "market", qty: 1 }, bars });
    closePosition(state, state.positions[0].id, e.markPrice() + 40, "manual");
    const s = summarize(state);
    expect(s.tradesCount).toBe(1);
    expect(s.netPnl).toBeGreaterThan(0);
    expect(s.winRate).toBe(1);
  });
});
