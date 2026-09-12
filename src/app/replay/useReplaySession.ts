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
import {
  closePosition,
  flattenPositions,
  moveWorkingOrder,
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

  const persist = useCallback(() => {
    if (!userId) return;
    const id = sessionIdRef.current;
    const state = stateRef.current;
    if (!id || !state) return;
    state.viewTimeframe = viewTfRef.current;
    void updateReplaySession(userId, id, { state, timeframe: viewTfRef.current }).catch(() => {});
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
      id: string,
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
      try {
        setError(null);
        const engine = new ReplayEngine({
          symbol: "NQ",
          date: cfg.date,
          startTime: cfg.startTime,
          timeframe: cfg.timeframe,
        });
        await engine.start();
        const state = createInitialState({
          symbol: "NQ",
          startingBalance: cfg.startingBalance,
          now: engine.now,
          commissionPerContract: 2.5,
          slippageTicks: 1,
        });
        state.viewTimeframe = cfg.timeframe;
        const id = await createReplaySession(userId, {
          accountId: cfg.accountId,
          symbol: "NQ",
          startDate: cfg.date,
          startTime: cfg.startTime,
          timeframe: cfg.timeframe,
          state,
        });
        mountSession(engine, state, cfg, id);
        return true;
      } catch (e) {
        console.error("[replay] start failed", e);
        setError("rt.errorData");
        return false;
      }
    },
    [userId, mountSession],
  );

  const resume = useCallback(
    async (dto: ReplaySessionDto) => {
      if (!dto.state) return false;
      try {
        const engine = new ReplayEngine({
          symbol: dto.symbol,
          date: dto.startDate,
          startTime: dto.startTime,
          timeframe: dto.timeframe,
        });
        await engine.start();
        engine.now = dto.state.now;
        const base = createInitialState({
          symbol: dto.symbol,
          startingBalance: dto.state.account?.startingBalance ?? 100_000,
          now: dto.state.now,
          commissionPerContract: dto.state.commissionPerContract ?? 2.5,
          slippageTicks: dto.state.slippageTicks ?? 1,
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
    persist();
    teardown();
    setActive(false);
    setFinished(false);
    setSessionId(null);
  }, [persist, teardown]);

  const createReplayAccount = useCallback(
    async (form: { name: string; startingBalance: number }) => {
      if (!userId) throw new Error("not authenticated");
      const acc = await addAccount({
        name: form.name || "NQ Backtest",
        type: "replay",
        icon: "history",
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
    if (!engine || !state || !userId || !sessionIdRef.current || !cfgRef.current) return null;
    flattenPositions(state, engine.data);
    refreshValuation(state, engine.data);
    const res = await pushReplayTradesToJournal(
      userId,
      sessionIdRef.current,
      cfgRef.current.accountId,
      state.closedTrades,
    );
    await updateReplaySession(userId, sessionIdRef.current, { state, status: "finished" }).catch(
      () => {},
    );
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
      : { ethStart: 0, ethEnd: 1, rthStart: 0, rthEnd: 0 },
    symbol: "NQ",
    date: cfgRef.current?.date ?? "",
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
    cancelOrder,
    closePositionOf,
    // Dessins
    addDrawing,
    updateDrawing,
    removeDrawing,
  };
}

export type ReplaySessionApi = ReturnType<typeof useReplaySession>;
