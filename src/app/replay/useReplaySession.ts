/**
 * useReplaySession — l'état vivant du rejeu, indépendant des pages.
 *
 * Le terminal n'est PAS une page isolée : il vit dans un provider monté avec le
 * shell, donc changer d'onglet (Journal, Dashboard…) ne détruit ni l'horloge, ni
 * les ordres, ni les dessins. C'est ce qui fait du rejeu une « app dans l'app ».
 *
 * Le moteur (horloge, bougies) vit dans une ref, l'état du compte dans une autre.
 * Deux signaux pilotent les re-rendus : `quote` (prix marqué, P&L) et `version`
 * (barres traversées, ordres, timeframe). La lecture s'arrête dès que le terminal
 * n'est plus à l'écran — sinon chaque frame repeindrait tout le shell.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccounts } from "../contexts/AccountContext";
import type { Account } from "../store";
import {
  ReplayEngine,
  type OhlcBar,
  type SimulatedCandle,
  type Drawing,
  TIMEFRAMES,
  isTimeframeId,
} from "@/modules/replay";
import { createInitialState, processBars, rebuildState, refreshValuation } from "@/modules/replay";
import { installRemoteProvider, lastDataProvider } from "./remoteProvider";
import {
  closePosition,
  flattenPositions,
  moveWorkingOrder,
  setOrderBracket,
  setPositionBracket,
  placeOrder as simPlaceOrder,
  cancelOrder as simCancelOrder,
  type PlaceOrderInput,
} from "@/modules/replay/orders";
import {
  loadReplaySessions,
  createReplaySession,
  updateReplaySession,
  abandonReplaySession,
  pushReplayTradesToJournal,
  type ReplaySessionDto,
  type JournalPushResult,
} from "../store/replay";

export interface ReplayQuote {
  mark: number;
  balance: number;
  equity: number;
  openPnl: number;
  realizedPnl: number;
  commissions: number;
  activeRisk: number;
  progress: number;
}

export interface ReplayStartConfig {
  accountId: string;
  date: string;
  startTime: string;
  timeframe: string;
  startingBalance: number;
  /** Nombre de séances rejouées d'affilée (1 par défaut). */
  days?: number;
  /** Perte maximale tolérée sur la séance, en % du capital. */
  maxDailyLossPct?: number;
}

export function useReplaySession({ userId }: { userId: string | null }) {
  const { accounts, addAccount } = useAccounts();
  const replayAccounts = useMemo(() => accounts.filter((a) => a.type === "replay"), [accounts]);

  const [active, setActive] = useState(false);
  const [finished, setFinished] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [sessions, setSessions] = useState<ReplaySessionDto[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * D'OÙ VIENNENT LES BOUGIES. `null` = générateur déterministe.
   *
   * Le repli sur la synthèse est silencieux par conception — le terminal doit
   * fonctionner sans abonnement. Mais silencieux ne veut pas dire caché : un
   * trader qui croit rejouer le vrai NQ alors qu'il regarde une simulation
   * tire de fausses conclusions de sa séance. L'interface doit pouvoir le dire.
   */
  const [dataSource, setDataSource] = useState<string | null>(null);

  const engineRef = useRef<ReplayEngine | null>(null);
  const stateRef = useRef<ReturnType<typeof createInitialState> | null>(null);
  const cfgRef = useRef<ReplayStartConfig | null>(null);
  const drawingRef = useRef<Drawing[]>([]);

  const [version, setVersion] = useState(0);
  const [quote, setQuote] = useState<ReplayQuote | null>(null);
  const [playing, setPlaying] = useState(false);
  const [viewTf, setViewTfState] = useState("5m");
  const [speed, setSpeed] = useState(1);

  const playingRef = useRef(false);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const visibleRef = useRef(true);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const readQuote = useCallback((engine: ReplayEngine): ReplayQuote | null => {
    const state = stateRef.current;
    if (!state) return null;
    refreshValuation(state, engine.data);
    return {
      mark: engine.markPrice(),
      balance: state.account.balance,
      equity: state.account.equity,
      openPnl: state.account.openPnl,
      realizedPnl: state.account.realizedPnl,
      commissions: state.account.commissions,
      activeRisk: state.account.activeRisk,
      progress: engine.progress(),
    };
  }, []);

  // ── Persistance différée ─────────────────────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  sessionIdRef.current = sessionId;
  const viewTfRef = useRef(viewTf);
  viewTfRef.current = viewTf;

  /**
   * Écrit l'état de la séance, et DIT si l'écriture a eu lieu.
   *
   * Elle ne rendait rien : impossible, depuis l'appelant, de distinguer une
   * sauvegarde réussie d'une séance purement locale (table absente, réseau
   * coupé). On promettait donc « sauvegardé là où tu t'es arrêté » sans le
   * savoir. Le booléen permet à l'interface d'être honnête.
   */
  const persist = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    const id = sessionIdRef.current;
    const state = stateRef.current;
    if (!id || !state) return false;
    state.viewTimeframe = viewTfRef.current;
    try {
      await updateReplaySession(userId, id, { state, timeframe: viewTfRef.current });
      return true;
    } catch (e) {
      console.warn("[replay] enregistrement de séance impossible", e);
      return false;
    }
  }, [userId]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(persist, 1500);
  }, [persist]);

  // ── Boucle de lecture ────────────────────────────────────────────────────
  const lastFrame = useRef(0);
  const frameId = useRef(0);
  const tick = useCallback(
    (nowMs: number) => {
      frameId.current = requestAnimationFrame(tick);
      const engine = engineRef.current;
      if (!engine || !playingRef.current || !visibleRef.current) return;
      const dt = Math.min(500, nowMs - lastFrame.current);
      lastFrame.current = nowMs;
      const before = engine.now;
      engine.advance(dt * speedRef.current);
      if (engine.now !== before) {
        processBars(stateRef.current!, engine.data);
        setQuote(readQuote(engine));
        bump();
      }
      if (engine.atEnd) {
        playingRef.current = false;
        setPlaying(false);
      }
    },
    [bump, readQuote],
  );

  useEffect(() => () => cancelAnimationFrame(frameId.current), []);

  // ── Entrée / sortie / reprise ────────────────────────────────────────────
  const teardown = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    cancelAnimationFrame(frameId.current);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    engineRef.current = null;
    stateRef.current = null;
    drawingRef.current = [];
    setQuote(null);
  }, []);

  const loadSessionsOf = useCallback(
    async (accountId: string) => {
      if (!userId) return [];
      const list = await loadReplaySessions(userId, accountId).catch(() => []);
      setSessions(list);
      return list;
    },
    [userId],
  );

  const mountSession = useCallback(
    (
      engine: ReplayEngine,
      state: ReturnType<typeof createInitialState>,
      cfg: ReplayStartConfig,
      id: string | null,
    ) => {
      engineRef.current = engine;
      stateRef.current = state;
      cfgRef.current = cfg;
      drawingRef.current = state.drawings ?? [];
      sessionIdRef.current = id;
      setSessionId(id);
      setViewTfState(state.viewTimeframe);
      setAccount(accounts.find((a) => a.id === cfg.accountId) ?? null);
      setQuote(readQuote(engine));
      setFinished(false);
      setActive(true);
      setError(null);
    },
    [accounts, readQuote],
  );

  const startNew = useCallback(
    async (cfg: ReplayStartConfig) => {
      if (!userId) return false;
      setError(null);
      // Les vraies données passent par le serveur ; sans clé configurée, la
      // requête rend vide et le générateur reprend la main sans que rien ne
      // change pour le trader.
      installRemoteProvider();
      const engine = new ReplayEngine({
        symbol: "NQ",
        date: cfg.date,
        startTime: cfg.startTime,
        timeframe: cfg.timeframe,
        days: cfg.days ?? 1,
      });
      try {
        await engine.start();
      } catch (e) {
        console.error("[replay] data load failed", e);
        setError("rt.errorData");
        return false;
      }
      setDataSource(lastDataProvider());
      const state = createInitialState({
        symbol: "NQ",
        startingBalance: cfg.startingBalance,
        now: engine.now,
        commissionPerContract: 2.5,
        slippageTicks: 1,
        days: cfg.days ?? 1,
        maxDailyLossPct: cfg.maxDailyLossPct,
      });
      state.viewTimeframe = cfg.timeframe;
      // La persistance est BEST-EFFORT : si la table `replay_sessions` n'est
      // pas encore migrée, on entre quand même dans le terminal en session
      // locale — rien n'empêche de backtester, seule la reprise est perdue.
      const id = await createReplaySession(userId, {
        accountId: cfg.accountId,
        symbol: "NQ",
        startDate: cfg.date,
        startTime: cfg.startTime,
        timeframe: cfg.timeframe,
        state,
      }).catch((e) => {
        console.warn("[replay] persistance indisponible — session locale", e);
        return null;
      });
      mountSession(engine, state, cfg, id);
      return true;
    },
    [userId, mountSession],
  );

  const resume = useCallback(
    async (dto: ReplaySessionDto) => {
      if (!dto.state) return false;
      installRemoteProvider();
      try {
        const engine = new ReplayEngine({
          symbol: dto.symbol,
          date: dto.startDate,
          startTime: dto.startTime,
          timeframe: dto.timeframe,
          days: dto.state.days ?? 1,
        });
        await engine.start();
        setDataSource(lastDataProvider());
        engine.now = dto.state.now;
        const base = createInitialState({
          symbol: dto.symbol,
          startingBalance: dto.state.account?.startingBalance ?? 100_000,
          now: dto.state.now,
          commissionPerContract: dto.state.commissionPerContract ?? 2.5,
          slippageTicks: dto.state.slippageTicks ?? 1,
          days: dto.state.days ?? 1,
          maxDailyLossPct: dto.state.maxDailyLossPct,
        });
        base.orders = dto.state.orders ?? [];
        base.closedTrades = dto.state.closedTrades ?? [];
        base.executions = dto.state.executions ?? [];
        base.drawings = dto.state.drawings ?? [];
        base.appliedUpTo = dto.state.appliedUpTo ?? null;
        base.viewTimeframe = isTimeframeId(dto.timeframe) ? dto.timeframe : "5m";
        const rebuilt = rebuildState(base, engine.data, dto.state.now);
        rebuilt.drawings = base.drawings;
        mountSession(
          engine,
          rebuilt,
          {
            accountId: dto.accountId,
            date: dto.startDate,
            startTime: dto.startTime,
            timeframe: dto.timeframe,
            startingBalance: rebuilt.account.startingBalance,
            days: dto.state.days ?? 1,
            maxDailyLossPct: dto.state.maxDailyLossPct,
          },
          dto.id,
        );
        return true;
      } catch (e) {
        console.error("[replay] restore failed", e);
        setError("rt.errorData");
        return false;
      }
    },
    [mountSession],
  );

  /** Sortie : on sauvegarde, puis on remet l'état à zéro (le provider restaure
   *  le compte réel). */
  const leave = useCallback(async () => {
    // ATTENDU, pas lancé puis oublié. L'écriture partait sans être attendue et
    // le démontage suivait aussitôt : fermer l'onglet dans la foulée pouvait
    // emporter la séance avec. Quitter, c'est d'abord enregistrer.
    const saved = await persist();
    teardown();
    setActive(false);
    setFinished(false);
    setSessionId(null);
    return saved;
  }, [persist, teardown]);

  const createReplayAccount = useCallback(
    async (form: { name: string; startingBalance: number }) => {
      if (!userId) throw new Error("not authenticated");
      // PAS D'ICÔNE ICI. `createAccount` prend soin de n'envoyer `icon` que
      // s'il est fourni, précisément parce que la colonne peut manquer en base
      // (elle arrive avec `billing_and_quota_hardening`, qui n'est pas appliquée
      // partout). Passer « history » défaisait cette précaution : PostgREST
      // refusait l'insert avec un PGRST204, le compte de rejeu n'était jamais
      // créé, et le terminal ne démarrait pas.
      const acc = await addAccount({
        name: form.name || "NQ Backtest",
        type: "replay",
        startingBalance: form.startingBalance,
      });
      setSessions([]);
      return acc;
    },
    [userId, addAccount],
  );

  const selectAccount = useCallback(
    (accountId: string) => {
      const acc = replayAccounts.find((a) => a.id === accountId) ?? null;
      setAccount(acc);
      if (acc) void loadSessionsOf(acc.id);
    },
    [replayAccounts, loadSessionsOf],
  );

  // ── Contrôles ────────────────────────────────────────────────────────────
  const play = useCallback(() => {
    if (!engineRef.current) return;
    playingRef.current = true;
    setPlaying(true);
    lastFrame.current = performance.now();
    frameId.current = requestAnimationFrame(tick);
  }, [tick]);

  const pause = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    cancelAnimationFrame(frameId.current);
    persist();
  }, [persist]);

  const togglePlay = useCallback(() => (playingRef.current ? pause() : play()), [pause, play]);

  const nextCandle = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.stepForward(viewTfRef.current);
    processBars(stateRef.current!, engine.data);
    setQuote(readQuote(engine));
    bump();
  }, [bump, readQuote]);

  const prevCandle = useCallback(() => {
    const engine = engineRef.current;
    const state = stateRef.current;
    if (!engine || !state) return;
    engine.stepBack(viewTfRef.current);
    const rebuilt = rebuildState(state, engine.data, engine.now);
    rebuilt.drawings = drawingRef.current;
    stateRef.current = rebuilt;
    setQuote(readQuote(engine));
    bump();
  }, [bump, readQuote]);

  const setViewTf = useCallback(
    (tf: string) => {
      setViewTfState(tf);
      if (stateRef.current) {
        stateRef.current.viewTimeframe = tf;
        scheduleSave();
      }
      bump();
    },
    [bump, scheduleSave],
  );

  const setReplaySpeed = useCallback((s: number) => {
    setSpeed(s);
    if (stateRef.current) stateRef.current.playbackSpeed = s;
  }, []);

  /** Le terminal signale sa présence : la lecture reprend/s'arrête. */
  const setVisible = useCallback(
    (v: boolean) => {
      visibleRef.current = v;
      if (!v) pause();
    },
    [pause],
  );

  // ── Ordres ───────────────────────────────────────────────────────────────
  const placeOrderTicket = useCallback(
    (input: PlaceOrderInput) => {
      const engine = engineRef.current;
      const state = stateRef.current;
      if (!engine || !state) return;
      simPlaceOrder({ state, input, bars: engine.data });
      refreshValuation(state, engine.data);
      scheduleSave();
      bump();
    },
    [bump, scheduleSave],
  );

  const bracketOf = useCallback(
    (posId: string, sl: number | null, tp: number | null) => {
      if (!stateRef.current) return;
      setPositionBracket(stateRef.current, posId, sl, tp);
      scheduleSave();
      bump();
    },
    [bump, scheduleSave],
  );

  const moveOrder = useCallback(
    (orderId: string, price: number) => {
      if (!stateRef.current) return;
      moveWorkingOrder(stateRef.current, orderId, price);
      scheduleSave();
      bump();
    },
    [bump, scheduleSave],
  );

  /** Le bracket d'un ordre ENCORE EN CARNET — glissé depuis le graphe. */
  const moveOrderBracket = useCallback(
    (orderId: string, sl: number | null | undefined, tp: number | null | undefined) => {
      if (!stateRef.current) return;
      setOrderBracket(stateRef.current, orderId, sl, tp);
      scheduleSave();
      bump();
    },
    [bump, scheduleSave],
  );

  const cancelOrder = useCallback(
    (orderId: string) => {
      if (!stateRef.current) return;
      simCancelOrder(stateRef.current, orderId);
      scheduleSave();
      bump();
    },
    [bump, scheduleSave],
  );

  const closePositionOf = useCallback(
    (posId: string) => {
      const engine = engineRef.current;
      const state = stateRef.current;
      if (!engine || !state) return;
      closePosition(state, posId, engine.markPrice(), "manual");
      refreshValuation(state, engine.data);
      scheduleSave();
      bump();
    },
    [bump, scheduleSave],
  );

  // ── Dessins ─────────────────────────────────────────────────────────────
  const addDrawing = useCallback(
    (d: Drawing) => {
      if (!stateRef.current) return;
      drawingRef.current = [...drawingRef.current, d];
      stateRef.current.drawings = drawingRef.current;
      scheduleSave();
      bump();
    },
    [bump, scheduleSave],
  );

  const updateDrawing = useCallback(
    (d: Drawing) => {
      drawingRef.current = drawingRef.current.map((x) => (x.id === d.id ? d : x));
      if (stateRef.current) stateRef.current.drawings = drawingRef.current;
      scheduleSave();
      bump();
    },
    [bump, scheduleSave],
  );

  const removeDrawing = useCallback(
    (id: string) => {
      drawingRef.current = drawingRef.current.filter((d) => d.id !== id);
      if (stateRef.current) stateRef.current.drawings = drawingRef.current;
      scheduleSave();
      bump();
    },
    [bump, scheduleSave],
  );

  // ── Fin de session ──────────────────────────────────────────────────────
  const finish = useCallback(async () => {
    const engine = engineRef.current;
    const state = stateRef.current;
    if (!engine || !state || !userId || !cfgRef.current) return null;
    flattenPositions(state, engine.data);
    refreshValuation(state, engine.data);
    // Best-effort : le journal est poussé même si `replay_sessions` n'existe pas.
    let res: JournalPushResult | null = null;
    if (sessionIdRef.current) {
      try {
        res = await pushReplayTradesToJournal(
          userId,
          sessionIdRef.current,
          cfgRef.current.accountId,
          state.closedTrades,
        );
      } catch (e) {
        console.warn("[replay] journal push failed", e);
        res = { saved: 0, failed: state.closedTrades.length, planLimitReached: false };
      }
      await updateReplaySession(userId, sessionIdRef.current, { state, status: "finished" }).catch(
        () => {},
      );
    } else {
      res = { saved: state.closedTrades.length, failed: 0, planLimitReached: false };
    }
    pause();
    setFinished(true);
    setQuote(readQuote(engine));
    return res;
  }, [userId, pause, readQuote]);

  const abandon = useCallback(async () => {
    if (userId && sessionIdRef.current)
      await abandonReplaySession(userId, sessionIdRef.current).catch(() => {});
    teardown();
    setActive(false);
    setFinished(false);
    setSessionId(null);
  }, [userId, teardown]);

  // ── Dérivés pour la vue ─────────────────────────────────────────────────
  const candles: SimulatedCandle[] = useMemo(() => {
    const engine = engineRef.current;
    if (!engine) return [];
    return engine.tfCandles(viewTf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewTf, version]);

  const bars: OhlcBar[] = useMemo(() => engineRef.current?.data ?? [], [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const clockLabel = engineRef.current ? engineRef.current.clockLabel() : "";

  return {
    active,
    finished,
    error,
    dataSource,
    account,
    sessions,
    replayAccounts,
    sessionId,
    state: stateRef.current,
    candles,
    bars,
    quote,
    clockLabel,
    playing,
    speed,
    viewTf,
    TIMEFRAMES,
    drawings: drawingRef.current,
    atStart: engineRef.current?.atStart ?? true,
    atEnd: engineRef.current?.atEnd ?? false,
    bounds: engineRef.current
      ? engineRef.current.sessionBounds()
      : { ethStart: 0, ethEnd: 1, rthStart: 0, rthEnd: 0, rthWindows: [] },
    symbol: "NQ",
    date: cfgRef.current?.date ?? "",
    days: cfgRef.current?.days ?? 1,
    startTime: cfgRef.current?.startTime ?? "",
    // Cycle
    startNew,
    resume,
    leave,
    finish,
    abandon,
    createReplayAccount,
    selectAccount,
    loadSessionsOf,
    // Contrôles
    play,
    pause,
    togglePlay,
    nextCandle,
    prevCandle,
    setViewTf,
    setSpeed: setReplaySpeed,
    setVisible,
    // Ordres
    placeOrderTicket,
    bracketOf,
    moveOrder,
    moveOrderBracket,
    cancelOrder,
    closePositionOf,
    // Dessins
    addDrawing,
    updateDrawing,
    removeDrawing,
  };
}

export type ReplaySessionApi = ReturnType<typeof useReplaySession>;
