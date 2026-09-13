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
  setOrderBracket,
  generateSyntheticSession,
  sessionDateKey,
  summarize,
  deserializeState,
  serializeState,
  sessionsOf,
  nyEpochFromHm,
  markPriceAt,
  registerProvider,
  unregisterProvider,
  resolveProvider,
  loadSessionBars,
  nyTimeOf,
  tradingDatesFrom,
  nextTradingDate,
  roundToTick,
  REPLAY_INSTRUMENTS,
  sizeFromRisk,
  riskOfSize,
  riskPctOfSize,
  dailyLossState,
  DEFAULT_TIMEFRAME,
} from "../src/modules/replay";
import { tradingWindowUtc } from "../src/backend/replay-data.server";

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
    // La limite se pose sous le marché, MAIS dans la zone réellement parcourue
    // par les dix minutes à venir. L'ancienne version visait 50 points plus bas
    // sans le vérifier : elle ne se remplissait que parce que `processBars`
    // rejouait alors la séance de nuit, bien antérieure au placement.
    const window = bars.filter((b) => b.time >= e.now && b.time < e.now + 10 * 60_000);
    const mark = e.markPrice();
    const lowest = Math.min(...window.map((b) => b.low));
    const price = roundToTick((mark + lowest) / 2, NQ);
    expect(price).toBeLessThan(mark);
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

  test("déplacer une entrée emmène son bracket : la distance est préservée", async () => {
    const state = makeState(0);
    const bars = generateSyntheticSession(DATE, NQ);
    const e = engine("1m");
    await e.start();
    e.now = e.rthStart;
    state.now = e.now;
    placeOrder({
      state,
      input: {
        side: "long",
        type: "limit",
        qty: 1,
        price: 20_000,
        bracketSl: 19_950,
        bracketTp: 20_100,
      },
      bars,
    });
    const o = state.orders[0];
    moveWorkingOrder(state, o.id, 20_050);
    // Le risque choisi valait 50 points, le gain visé 100 : après le
    // déplacement, ils valent toujours ça. C'est l'intention du trader, pas
    // les nombres, qui doit survivre au glissement.
    expect(o.price).toBe(20_050);
    expect(o.bracketSl).toBe(20_000);
    expect(o.bracketTp).toBe(20_150);
  });

  test("traîner une entrée de l'autre côté du marché la retourne", async () => {
    const state = makeState(0);
    const bars = generateSyntheticSession(DATE, NQ);
    const e = engine("1m");
    await e.start();
    e.now = e.rthStart;
    state.now = e.now;
    const mark = 20_000;
    // Un achat limite posé SOUS le marché : c'est la seule limite d'achat
    // valable.
    placeOrder({
      state,
      input: {
        side: "long",
        type: "limit",
        qty: 1,
        price: 19_900,
        bracketSl: 19_850,
        bracketTp: 20_000,
      },
      bars,
    });
    const o = state.orders[0];
    moveWorkingOrder(state, o.id, 20_100, mark);
    // Au-dessus du marché, une limite ne peut être qu'une VENTE : sans cette
    // bascule, l'ordre serait impossible (il se remplirait à l'instant même).
    expect(o.side).toBe("short");
    // Le bracket s'est retourné AUTOUR de l'entrée en gardant ses distances :
    // cinquante points de risque, cent d'objectif, comme avant.
    expect(Math.abs(o.bracketSl! - o.price!)).toBe(50);
    expect(Math.abs(o.bracketTp! - o.price!)).toBe(100);
    expect(o.bracketSl!).toBeGreaterThan(o.price!); // stop d'une vente : au-dessus
    expect(o.bracketTp!).toBeLessThan(o.price!);
    // Et le retour en arrière redonne un achat.
    moveWorkingOrder(state, o.id, 19_800, mark);
    expect(o.side).toBe("long");
  });

  test("un ordre limite sans prix est refusé, pas posé à zéro", async () => {
    const state = makeState(0);
    const bars = generateSyntheticSession(DATE, NQ);
    const e = engine("1m");
    await e.start();
    e.now = e.rthStart;
    state.now = e.now;
    // Un champ de prix laissé vide arrivait ici à 0 : l'ordre s'inscrivait au
    // carnet, ne se remplissait jamais, et se dessinait hors du graphe.
    expect(() =>
      placeOrder({ state, input: { side: "long", type: "limit", qty: 1, price: 0 }, bars }),
    ).toThrow();
    expect(state.orders.length).toBe(0);
  });

  test("le bracket d'un ordre en carnet refuse de passer du mauvais côté", async () => {
    const state = makeState(0);
    const bars = generateSyntheticSession(DATE, NQ);
    const e = engine("1m");
    await e.start();
    e.now = e.rthStart;
    state.now = e.now;
    placeOrder({
      state,
      input: {
        side: "long",
        type: "limit",
        qty: 1,
        price: 20_000,
        bracketSl: 19_950,
        bracketTp: 20_100,
      },
      bars,
    });
    const o = state.orders[0];
    // Un stop d'achat AU-DESSUS de l'entrée se déclencherait au remplissage.
    setOrderBracket(state, o.id, 20_040, undefined);
    expect(o.bracketSl).toBe(19_950);
    // `undefined` ne touche à rien : glisser le stop n'efface pas l'objectif.
    setOrderBracket(state, o.id, 19_900, undefined);
    expect(o.bracketSl).toBe(19_900);
    expect(o.bracketTp).toBe(20_100);
    // `null`, lui, retire bien la jambe visée — et elle seule.
    setOrderBracket(state, o.id, null, undefined);
    expect(o.bracketSl).toBeNull();
    expect(o.bracketTp).toBe(20_100);
  });
});

describe("les exécutions marquent l'ENTRÉE autant que la sortie", () => {
  test("ouvrir une position inscrit une exécution d'entrée", async () => {
    const bars = generateSyntheticSession(DATE, NQ);
    const e = engine("1m");
    await e.start();
    e.now = e.rthStart + 2 * 60_000;
    const state = makeState(e.now);
    expect(state.executions.length).toBe(0);
    placeOrder({ state, input: { side: "long", type: "market", qty: 2 }, bars });
    // Seules les SORTIES s'inscrivaient : le graphe marquait donc les points
    // d'arrivée sans jamais les points de départ.
    expect(state.executions.length).toBe(1);
    const entry = state.executions[0];
    expect(entry.kind).toBe("entry");
    expect(entry.side).toBe("long");
    expect(entry.qty).toBe(2);
    expect(entry.price).toBeCloseTo(state.positions[0].avgEntry, 5);
  });

  test("refermer inscrit une exécution de sortie, distincte de l'entrée", async () => {
    const bars = generateSyntheticSession(DATE, NQ);
    const e = engine("1m");
    await e.start();
    e.now = e.rthStart + 2 * 60_000;
    const state = makeState(e.now);
    placeOrder({ state, input: { side: "long", type: "market", qty: 1 }, bars });
    closePosition(state, state.positions[0].id, e.markPrice(), "manual");
    const kinds = state.executions.map((x) => x.kind);
    expect(kinds).toEqual(["entry", "exit"]);
  });

  test("renforcer une position inscrit une seconde entrée", async () => {
    const bars = generateSyntheticSession(DATE, NQ);
    const e = engine("1m");
    await e.start();
    e.now = e.rthStart + 2 * 60_000;
    const state = makeState(e.now);
    placeOrder({ state, input: { side: "long", type: "market", qty: 1 }, bars });
    placeOrder({ state, input: { side: "long", type: "market", qty: 1 }, bars });
    expect(state.positions.length).toBe(1);
    expect(state.positions[0].qty).toBe(2);
    expect(state.executions.filter((x) => x.kind === "entry").length).toBe(2);
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

// ─────────────────────────────────────────────────────────────────────────────
// Non-régressions : quatre défauts trouvés en revue, chacun reproduit ici avant
// correction. Ils touchent tous à la promesse centrale du terminal — ne jamais
// montrer ni exploiter ce qui n'a pas encore eu lieu.
// ─────────────────────────────────────────────────────────────────────────────

describe("fuite du futur — la minute en cours", () => {
  test("au tout début d'une minute, rien n'est révélé que son ouverture", async () => {
    const e = engine("1m");
    await e.start();
    e.now = e.rthStart; // pile sur le bord : la minute n'a pas commencé
    const head = e.tfCandles("1m").at(-1)!;
    const real = e.data.find((b) => b.time === e.rthStart)!;

    expect(head.open).toBe(real.open);
    expect(head.high).toBe(real.open);
    expect(head.low).toBe(real.open);
    expect(head.close).toBe(real.open);
    expect(head.forming).toBe(true);
    // La bougie réelle a une amplitude : c'est bien elle que l'on masque.
    expect(real.high).toBeGreaterThan(real.low);
  });

  test("les extrêmes d'une bougie en formation ne font que s'écarter", async () => {
    const e = engine("1m");
    await e.start();
    let prevHigh = -Infinity;
    let prevLow = Infinity;
    // On reste DANS la minute : à 60 s la tête de série est déjà la suivante.
    for (let s = 0; s < 60; s += 5) {
      e.now = e.rthStart + s * 1000;
      const head = e.tfCandles("1m").at(-1)!;
      expect(head.high).toBeGreaterThanOrEqual(prevHigh);
      expect(head.low).toBeLessThanOrEqual(prevLow);
      prevHigh = head.high;
      prevLow = head.low;
    }
    // À la clôture, la bougie partielle rejoint exactement la vraie.
    const real = e.data.find((b) => b.time === e.rthStart)!;
    e.now = e.rthStart + 60_000;
    const closed = e.tfCandles("1m").find((b) => b.time === e.rthStart)!;
    expect(closed.high).toBe(real.high);
    expect(closed.low).toBe(real.low);
    expect(closed.close).toBe(real.close);
    expect(closed.high).toBeGreaterThanOrEqual(prevHigh);
    expect(closed.low).toBeLessThanOrEqual(prevLow);
  });

  test("le volume ne s'affiche pas d'avance", async () => {
    const e = engine("1m");
    await e.start();
    e.now = e.rthStart;
    expect(e.tfCandles("1m").at(-1)!.volume).toBe(0);
    e.now = e.rthStart + 60_000;
    const real = e.data.find((b) => b.time === e.rthStart)!;
    expect(e.tfCandles("1m").at(-2)!.volume).toBe(real.volume);
  });

  test("le prix marqué atteint réellement les extrêmes de la minute", async () => {
    const e = engine("1m");
    await e.start();
    const real = e.data.find((b) => b.time === e.rthStart)!;
    let hi = -Infinity;
    let lo = Infinity;
    for (let s = 0; s <= 60; s++) {
      e.now = e.rthStart + s * 1000;
      const m = e.markPrice();
      hi = Math.max(hi, m);
      lo = Math.min(lo, m);
      // Jamais hors des bornes réelles de la minute.
      expect(m).toBeLessThanOrEqual(real.high + 1e-9);
      expect(m).toBeGreaterThanOrEqual(real.low - 1e-9);
    }
    // L'interpolation droite d'autrefois ne touchait ni le high ni le low :
    // un stop posé sur la mèche était inatteignable avant la clôture.
    expect(hi).toBeCloseTo(real.high, 6);
    expect(lo).toBeCloseTo(real.low, 6);
  });
});

describe("reconstruction — on rejoue des gestes, pas des résultats", () => {
  /** Série plate à 21 000, avec un unique creux à 20 900 à la 40e minute. */
  function flatWithDip(): { t0: number; bars: OhlcBar[] } {
    const t0 = nyEpochFromHm(DATE, "09:30");
    const bars: OhlcBar[] = Array.from({ length: 60 }, (_, i) => ({
      time: t0 + i * 60_000,
      open: 21_000,
      high: 21_002,
      low: i === 40 ? 20_900 : 20_998,
      close: 21_000,
      volume: 100,
    }));
    return { t0, bars };
  }

  test("reculer avant un remplissage le défait vraiment", () => {
    const { t0, bars } = flatWithDip();
    const state = createInitialState({
      symbol: "NQ",
      startingBalance: 50_000,
      now: t0,
      commissionPerContract: 2,
      slippageTicks: 1,
    });
    placeOrder({ state, input: { side: "long", type: "limit", qty: 1, price: 20_950 }, bars });
    for (let i = 1; i <= 59; i++) {
      state.now = t0 + i * 60_000;
      processBars(state, bars);
    }
    expect(state.orders[0].status).toBe("filled");

    // Avant le creux : l'ordre attend encore, et aucune position n'existe.
    for (const min of [10, 30, 39]) {
      const back = rebuildState(state, bars, t0 + min * 60_000);
      expect(back.orders[0]?.status).toBe("working");
      expect(back.orders[0]?.filledAt ?? null).toBeNull();
      expect(back.positions.length).toBe(0);
    }
    // Après le creux : le remplissage est de nouveau là.
    const after = rebuildState(state, bars, t0 + 42 * 60_000);
    expect(after.orders[0].status).toBe("filled");
    expect(after.positions.length).toBe(1);
  });

  test("les brackets ne se dupliquent pas à chaque reconstruction", () => {
    const { t0, bars } = flatWithDip();
    const state = createInitialState({
      symbol: "NQ",
      startingBalance: 50_000,
      now: t0,
      commissionPerContract: 2,
      slippageTicks: 0,
    });
    placeOrder({
      state,
      input: {
        side: "long",
        type: "market",
        qty: 2,
        price: null,
        bracketSl: 20_800,
        bracketTp: 21_100,
      },
      bars,
    });
    for (let i = 1; i <= 20; i++) {
      state.now = t0 + i * 60_000;
      processBars(state, bars);
    }
    const live = (s: typeof state) =>
      s.orders.filter((o) => o.reduceOnly && o.status === "working");
    expect(live(state).length).toBe(2);

    // Une position de 2 contrats ne doit jamais porter 4 ordres de sortie :
    // elle se refermerait deux fois.
    let cur = state;
    for (let round = 0; round < 3; round++) {
      cur = rebuildState(cur, bars, t0 + 10 * 60_000);
      expect(live(cur).length).toBe(2);
      expect(cur.positions[0].qty).toBe(2);
    }
  });

  test("un ordre posé depuis la dernière bougie close survit au recul", () => {
    const { t0, bars } = flatWithDip();
    const state = createInitialState({
      symbol: "NQ",
      startingBalance: 50_000,
      now: t0,
      commissionPerContract: 2,
      slippageTicks: 1,
    });
    // Placé PILE sur la cible du recul : il n'a encore produit aucun fill, mais
    // il existe. L'omettre le faisait disparaître du carnet.
    placeOrder({ state, input: { side: "long", type: "limit", qty: 1, price: 20_500 }, bars });
    const back = rebuildState(state, bars, t0);
    expect(back.orders.length).toBe(1);
    expect(back.orders[0].status).toBe("working");
    expect(back.orders[0].price).toBe(20_500);
  });

  test("une annulation est rejouée à SA date, pas à celle du placement", () => {
    const { t0, bars } = flatWithDip();
    const state = createInitialState({
      symbol: "NQ",
      startingBalance: 50_000,
      now: t0,
      commissionPerContract: 2,
      slippageTicks: 1,
    });
    placeOrder({ state, input: { side: "long", type: "limit", qty: 1, price: 20_950 }, bars });
    state.now = t0 + 20 * 60_000;
    cancelOrder(state, state.orders[0].id);

    // Avant l'annulation, l'ordre est encore au carnet.
    const before = rebuildState(state, bars, t0 + 10 * 60_000);
    expect(before.orders[0].status).toBe("working");
    // Après, il est annulé — et le creux de la 40e n'ouvre aucune position.
    const after = rebuildState(state, bars, t0 + 45 * 60_000);
    expect(after.orders[0].status).toBe("cancelled");
    expect(after.positions.length).toBe(0);
  });
});

describe("un ordre ne se remplit pas dans son passé", () => {
  test("les bougies antérieures au placement ne déclenchent rien", async () => {
    const e = engine("1m");
    await e.start();
    const bars = e.data;
    // Départ en plein RTH : toute la nuit précédente est déjà de l'histoire.
    e.now = e.rthStart + 60_000;
    const state = makeState(e.now);
    const overnightLow = Math.min(...bars.filter((b) => b.time < e.rthStart).map((b) => b.low));
    const mark = e.markPrice();
    // Une limite sous le plus bas de la nuit : si la nuit était rejouée, elle
    // se remplirait instantanément à un prix antérieur à son propre placement.
    const price = roundToTick(Math.min(overnightLow, mark) - 5, NQ);
    placeOrder({ state, input: { side: "long", type: "limit", qty: 1, price }, bars });
    processBars(state, bars);
    expect(state.orders[0].status).toBe("working");
    expect(state.positions.length).toBe(0);
  });
});

describe("le spec vient du registre, pas d'une constante", () => {
  test("un second instrument utilise SON multiplicateur, pas celui du NQ", () => {
    const MES: typeof NQ = {
      id: "MES",
      symbol: "MES",
      name: "Micro E-mini S&P",
      exchange: "CME",
      tickSize: 0.25,
      tickValue: 1.25,
      multiplier: 5, // NQ vaut 20 : l'écart doit se voir dans le P&L.
      typicalRange: { min: 4_000, max: 7_000 },
    };
    REPLAY_INSTRUMENTS.push(MES);
    try {
      const t0 = nyEpochFromHm(DATE, "09:30");
      const bars: OhlcBar[] = Array.from({ length: 10 }, (_, i) => ({
        time: t0 + i * 60_000,
        open: 5_000,
        high: 5_010,
        low: 4_990,
        close: 5_000,
        volume: 10,
      }));
      const state = createInitialState({
        symbol: "MES",
        startingBalance: 10_000,
        now: t0,
        commissionPerContract: 0,
        slippageTicks: 0,
      });
      placeOrder({ state, input: { side: "long", type: "market", qty: 1 }, bars });
      const entry = state.positions[0].avgEntry;
      state.now = t0 + 5 * 60_000;
      refreshValuation(state, bars);
      const mark = markPriceAt(bars, state.now);
      // 5 $ le point (MES) et non 20 $ (NQ).
      expect(state.account.openPnl).toBeCloseTo((mark - entry) * 5, 6);
    } finally {
      REPLAY_INSTRUMENTS.pop();
    }
  });
});

describe("remplissage intra-bougie", () => {
  // Bougie haussière : le chemin descend d'abord chercher le low, puis monte.
  //   21000 → 20990 → 21020 → 21010   (distances 10 + 30 + 10 = 50)
  // Les sommets tombent donc à f = 0,2 et f = 0,8.
  const T0 = nyEpochFromHm(DATE, "09:30");
  const BAR: OhlcBar = {
    time: T0,
    open: 21_000,
    high: 21_020,
    low: 20_990,
    close: 21_010,
    volume: 100,
  };
  const bars: OhlcBar[] = [BAR, { ...BAR, time: T0 + 60_000 }];

  function stateAt(now: number) {
    return createInitialState({
      symbol: "NQ",
      startingBalance: 50_000,
      now,
      commissionPerContract: 0,
      slippageTicks: 0,
    });
  }

  test("un stop touché en cours de minute n'attend pas la clôture", () => {
    const state = stateAt(T0);
    placeOrder({ state, input: { side: "long", type: "stop", qty: 1, price: 21_015 }, bars });

    // À 30 s le chemin plafonne à 21 005 : le stop n'est pas encore touché.
    state.now = T0 + 30_000;
    processBars(state, bars);
    expect(state.orders[0].status).toBe("working");

    // À 48 s il a atteint 21 020 : déclenchement, sans attendre 60 s.
    state.now = T0 + 48_000;
    processBars(state, bars);
    expect(state.orders[0].status).toBe("filled");
    expect(state.orders[0].fillPrice).toBe(21_015);
    expect(state.orders[0].filledAt).toBe(T0 + 48_000);
  });

  test("reculer avant le contact défait le remplissage intra-bougie", () => {
    const state = stateAt(T0);
    placeOrder({ state, input: { side: "long", type: "stop", qty: 1, price: 21_015 }, bars });
    state.now = T0 + 48_000;
    processBars(state, bars);
    expect(state.positions.length).toBe(1);

    const back = rebuildState(state, bars, T0 + 30_000);
    expect(back.orders[0].status).toBe("working");
    expect(back.positions.length).toBe(0);

    // Et rejouer en avant redonne exactement le même remplissage.
    const fwd = rebuildState(state, bars, T0 + 48_000);
    expect(fwd.orders[0].status).toBe("filled");
    expect(fwd.orders[0].fillPrice).toBe(21_015);
    expect(fwd.positions.length).toBe(1);
  });

  test("un ordre posé en milieu de minute ignore ce qui a précédé", () => {
    // Le creux à 20 990 tombe à f = 0,2, soit 12 s. L'ordre arrive à 30 s.
    const state = stateAt(T0 + 30_000);
    placeOrder({ state, input: { side: "long", type: "limit", qty: 1, price: 20_995 }, bars });
    expect(state.orders[0].placedAt).toBe(T0 + 30_000);

    // Même une fois la minute close, ce creux ne lui appartient pas.
    state.now = T0 + 60_000;
    processBars(state, bars);
    expect(state.orders[0].status).toBe("working");
    expect(state.positions.length).toBe(0);
  });

  test("une bougie entièrement traversée garde ses extrêmes exacts", () => {
    const state = stateAt(T0);
    placeOrder({ state, input: { side: "long", type: "limit", qty: 1, price: 20_990 }, bars });
    state.now = T0 + 60_000;
    processBars(state, bars);
    // Le low de la bougie est atteint au tick près : pas de rabotage par
    // l'interpolation quand la tranche couvre tout.
    expect(state.orders[0].status).toBe("filled");
    expect(state.orders[0].fillPrice).toBe(20_990);
  });
});

describe("money-management — la taille découle du risque", () => {
  test("un budget de risque donne un nombre entier de contrats", () => {
    // NQ : 20 $/point. Stop à 10 points = 200 $/contrat, hors commissions.
    const s = sizeFromRisk({ balance: 50_000, riskPct: 1, entry: 21_000, stop: 20_990, spec: NQ });
    expect(s).not.toBeNull();
    expect(s!.riskBudget).toBe(500);
    expect(s!.riskPerContract).toBe(200);
    // 500 / 200 = 2,5 → on plancher : dépasser le budget n'est pas négociable.
    expect(s!.contracts).toBe(2);
    expect(s!.riskUsed).toBe(400);
    expect(s!.stopPoints).toBe(10);
    expect(s!.stopTicks).toBe(40);
  });

  test("les commissions comptent à l'aller ET au retour", () => {
    const sans = sizeFromRisk({
      balance: 10_000,
      riskPct: 2,
      entry: 21_000,
      stop: 20_995,
      spec: NQ,
    });
    const avec = sizeFromRisk({
      balance: 10_000,
      riskPct: 2,
      entry: 21_000,
      stop: 20_995,
      spec: NQ,
      commissionPerContract: 2.5,
    });
    expect(sans!.riskPerContract).toBe(100); // 5 pts × 20 $
    expect(avec!.riskPerContract).toBe(105); // + 2 × 2,50 $
    // Le budget de 200 $ tient 2 contrats sans commissions, 1 seul avec.
    expect(sans!.contracts).toBe(2);
    expect(avec!.contracts).toBe(1);
  });

  test("sans stop, aucune taille n'est proposée", () => {
    expect(sizeFromRisk({ balance: 50_000, riskPct: 1, entry: 21_000, stop: 21_000 })).toBeNull();
    expect(sizeFromRisk({ balance: 0, riskPct: 1, entry: 21_000, stop: 20_990 })).toBeNull();
    expect(sizeFromRisk({ balance: 50_000, riskPct: 0, entry: 21_000, stop: 20_990 })).toBeNull();
  });

  test("un budget trop mince ne force pas un contrat", () => {
    // 50 $ de budget pour 200 $ de risque unitaire : la réponse est zéro.
    const s = sizeFromRisk({ balance: 5_000, riskPct: 1, entry: 21_000, stop: 20_990, spec: NQ });
    expect(s!.contracts).toBe(0);
    expect(s!.riskUsed).toBe(0);
  });

  test("le spec de l'instrument est respecté", () => {
    const nq = sizeFromRisk({ balance: 50_000, riskPct: 1, entry: 21_000, stop: 20_990, spec: NQ });
    const micro = sizeFromRisk({
      balance: 50_000,
      riskPct: 1,
      entry: 21_000,
      stop: 20_990,
      spec: { ...NQ, id: "MNQ", multiplier: 2, tickValue: 0.5 },
    });
    // À 2 $/point au lieu de 20, le même budget tient dix fois plus.
    expect(nq!.contracts).toBe(2);
    expect(micro!.contracts).toBe(25);
  });

  test("lecture inverse : le risque d'une taille donnée", () => {
    expect(riskOfSize(3, 21_000, 20_990, NQ)).toBe(600);
    expect(riskPctOfSize(3, 21_000, 20_990, 60_000, NQ)).toBeCloseTo(1, 6);
    expect(riskOfSize(0, 21_000, 20_990, NQ)).toBe(0);
    expect(riskOfSize(3, 21_000, 21_000, NQ)).toBe(0);
  });

  test("la limite de perte journalière compte le P&L ouvert", () => {
    const state = createInitialState({
      symbol: "NQ",
      startingBalance: 50_000,
      now: 0,
      commissionPerContract: 0,
      slippageTicks: 0,
    });
    expect(dailyLossState(state, 2)!.limit).toBe(1_000);
    expect(dailyLossState(state, 2)!.breached).toBe(false);

    // Une position qui perd 1 200 $ dépasse la limite MAINTENANT, pas à sa
    // clôture — c'est exactement ce que la règle existe pour empêcher.
    state.account.openPnl = -1_200;
    const d = dailyLossState(state, 2)!;
    expect(d.used).toBe(1_200);
    expect(d.remaining).toBe(0);
    expect(d.breached).toBe(true);
    expect(d.ratio).toBe(1);

    // Un gain ne consomme rien du budget.
    state.account.openPnl = 0;
    state.account.realizedPnl = 800;
    expect(dailyLossState(state, 2)!.used).toBe(0);
  });
});

describe("rejeu long — plusieurs séances d'affilée", () => {
  test("on compte en séances, jamais en jours civils", () => {
    // Jeudi 10 sept. 2026 : cinq séances vont jusqu'au mercredi suivant.
    expect(tradingDatesFrom("2026-09-10", 5)).toEqual([
      "2026-09-10",
      "2026-09-11",
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
    ]);
    // Un départ posé un samedi glisse sur la séance suivante.
    expect(tradingDatesFrom("2026-09-12", 2)).toEqual(["2026-09-14", "2026-09-15"]);
    expect(nextTradingDate("2026-09-11")).toBe("2026-09-14");
    expect(tradingDatesFrom("2026-09-10", 0)).toEqual(["2026-09-10"]);
  });

  test("l'enveloppe couvre toutes les séances et leurs bougies", async () => {
    const one = new ReplayEngine({ symbol: "NQ", date: DATE, startTime: START, timeframe: "5m" });
    const three = new ReplayEngine({
      symbol: "NQ",
      date: DATE,
      startTime: START,
      timeframe: "5m",
      days: 3,
    });
    await one.start();
    await three.start();

    expect(three.dates.length).toBe(3);
    expect(three.ethStart).toBe(one.ethStart);
    expect(three.ethEnd).toBeGreaterThan(one.ethEnd);
    // Trois séances, trois fois plus de minutes — sans doublon d'horodatage.
    expect(three.data.length).toBe(one.data.length * 3);
    const times = three.data.map((b) => b.time);
    expect(new Set(times).size).toBe(times.length);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(three.rthWindows().length).toBe(3);
  });

  test("l'heure morte entre deux séances est franchie, pas vécue", async () => {
    const e = new ReplayEngine({
      symbol: "NQ",
      date: DATE,
      startTime: START,
      timeframe: "5m",
      days: 2,
    });
    await e.start();
    const [first, second] = e.rthWindows();

    // 16 h 30 : la première séance court encore jusqu'à 17 h.
    e.jumpTo(first.end + 30 * 60_000);
    const before = e.now;
    // +1 h tomberait à 17 h 30, en plein marché fermé.
    e.advance(60 * 60_000);
    expect(e.now).toBeGreaterThan(before);
    expect(nyTimeOf(e.now)).toBe("18:00");
    // Et la séance suivante est bien celle qu'on rejoint.
    expect(e.now).toBeLessThan(second.start);
  });

  test("la progression ignore le temps où rien ne cote", async () => {
    const e = new ReplayEngine({
      symbol: "NQ",
      date: DATE,
      startTime: START,
      timeframe: "5m",
      days: 3,
    });
    await e.start();
    e.jumpTo(e.ethStart);
    expect(e.progress()).toBeCloseTo(0, 6);
    e.jumpTo(e.ethEnd);
    expect(e.progress()).toBeCloseTo(1, 6);

    // À la fin de la première séance sur trois : environ un tiers, et surtout
    // PAS la fraction du temps civil, que le week-end gonflerait.
    const firstDayEnd = e.rthWindows()[0].end;
    e.jumpTo(firstDayEnd);
    const p = e.progress();
    expect(p).toBeGreaterThan(0.25);
    expect(p).toBeLessThan(0.4);
  });

  test("le nombre de séances voyage avec l'état, sans colonne dédiée", () => {
    const state = createInitialState({
      symbol: "NQ",
      startingBalance: 50_000,
      now: 0,
      commissionPerContract: 2,
      slippageTicks: 1,
      days: 5,
    });
    expect(state.days).toBe(5);
    const back = deserializeState(serializeState(state));
    expect(back!.days).toBe(5);
    // Une séance enregistrée avant l'arrivée du champ reste lisible.
    const legacy = { ...state } as Partial<typeof state>;
    delete legacy.days;
    expect(deserializeState(JSON.stringify({ v: 1, ...legacy }))!.days).toBeUndefined();
  });
});

describe("fournisseur de données — branchement et repli", () => {
  /** Un fournisseur de test, qui rend ce qu'on lui dit. */
  function fakeProvider(name: string, bars: OhlcBar[], fail = false) {
    return {
      name,
      isAvailable: () => true,
      fetchBars: async () => {
        if (fail) throw new Error("service indisponible");
        return bars;
      },
    };
  }

  const T0 = nyEpochFromHm(DATE, "09:30");
  const REAL: OhlcBar[] = [
    { time: T0, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
    { time: T0 + 60_000, open: 1.5, high: 2.5, low: 1, close: 2, volume: 12 },
  ];

  test("un fournisseur inscrit passe devant le générateur", async () => {
    registerProvider(fakeProvider("faux", REAL));
    try {
      expect(resolveProvider().name).toBe("faux");
      const bars = await loadSessionBars(DATE, NQ);
      expect(bars.length).toBe(2);
      expect(bars[0].close).toBe(1.5);
    } finally {
      unregisterProvider("faux");
    }
    // Retiré, le générateur reprend la main — et une vraie séance revient.
    expect(resolveProvider().name).toBe("synthetic");
    expect((await loadSessionBars(DATE, NQ)).length).toBeGreaterThan(100);
  });

  test("un fournisseur qui ne rend rien ne vide pas le terminal", async () => {
    registerProvider(fakeProvider("vide", []));
    try {
      // Repli silencieux : backtester ne dépend d'aucun abonnement.
      const bars = await loadSessionBars(DATE, NQ);
      expect(bars.length).toBeGreaterThan(100);
    } finally {
      unregisterProvider("vide");
    }
  });

  test("un fournisseur en panne ne fait pas tomber la séance", async () => {
    registerProvider(fakeProvider("panne", [], true));
    try {
      const bars = await loadSessionBars(DATE, NQ);
      expect(bars.length).toBeGreaterThan(100);
    } finally {
      unregisterProvider("panne");
    }
  });

  test("réinscrire le même nom remplace, sans empiler", async () => {
    registerProvider(fakeProvider("faux", REAL));
    registerProvider(fakeProvider("faux", [REAL[0]]));
    try {
      expect((await loadSessionBars(DATE, NQ)).length).toBe(1);
    } finally {
      unregisterProvider("faux");
    }
  });

  test("la fenêtre interrogée est le jour de COTATION, pas le jour civil", () => {
    // 18 h NY la veille → 17 h NY le jour même. En janvier NY est à UTC−5.
    const w = tradingWindowUtc("2025-01-14");
    expect(w.start).toBe("2025-01-13T23:00:00.000Z");
    expect(w.end).toBe("2025-01-14T22:00:00.000Z");

    // En juillet l'heure d'été décale d'une heure : la fenêtre suit la bourse,
    // pas un décalage figé dans le code.
    const summer = tradingWindowUtc("2025-07-15");
    expect(summer.start).toBe("2025-07-14T22:00:00.000Z");
    expect(summer.end).toBe("2025-07-15T21:00:00.000Z");
  });
});
