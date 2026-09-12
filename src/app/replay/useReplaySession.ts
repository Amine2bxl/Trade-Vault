/**
 * useReplaySession — le terminal côté React.
 *
 * Le moteur (horloge, bougies) vit dans une ref ; l'état du compte (ordres,
 * positions, P&L) dans une autre. Les re-rendus sont pilotés par deux signaux :
 *   • `quote` — prix marqué, P&L ouverts, tické ~10 fois/s pendant la lecture ;
 *   • `version` — l'état du compte (bars traversées, ordres, timeframes).
 * Le terminal reste fluide, le graphe ne se redessine pas 60×/s sur des données
 * inchangées.
 *
 * La persistance est différée : on écrit la session toutes les ~2 secondes et
 * à chaque action structurante (pause, ordre, changement de timeframe, fin).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccounts } from "../contexts/AccountContext";
import type { Account } from "../store";
import { useT } from "../i18n/LanguageContext";
import { ReplayEngine, type OhlcBar, type SimulatedCandle, type Drawing } from "@/modules/replay";
import { TIMEFRAMES, isTimeframeId } from "@/modules/replay";
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

export type ReplayPhase = "loading" | "setup" | "running" | "finished";

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

export const REPLAY_SPEEDS = [0.25, 0.5, 1, 2, 5, 10] as const;

interface StartConfig {
  accountId: string;
  date: string;
  startTime: string;
  timeframe: string;
  startingBalance: number;
}

export function useReplaySession({
  userId,
  onExit,
}: {
  userId: string | null;
  onExit?: () => void;
}) {
  const { accounts, addAccount } = useAccounts();
  const { t } = useT();

  const replayAccounts = useMemo(() => accounts.filter((a) => a.type === "replay"), [accounts]);

  const [phase, setPhase] = useState<ReplayPhase>("loading");
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [sessions, setSessions] = useState<ReplaySessionDto[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Moteur + état : mutations dans des refs, signaux dans des states.
  const engineRef = useRef<ReplayEngine | null>(null);
  const stateRef = useRef<ReturnType<typeof createInitialState> | null>(null);
  const cfgRef = useRef<StartConfig | null>(null);
  const [version, setVersion] = useState(0);
  const [quote, setQuote] = useState<ReplayQuote | null>(null);
  const playingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [viewTf, setViewTfState] = useState("5m");
  const [speed, setSpeed] = useState(1);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  /** Calcule le « quote » économique courant depuis le moteur. */
  const readQuote = useCallback((engine: ReplayEngine) => {
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
  const scheduleSave = useCallback(() => {
    if (!stateRef.current || !sessionId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const state = stateRef.current;
      const id = sessionId;
      if (!state || !id || !userId) return;
      state.viewTimeframe = viewTfRef.current;
      void updateReplaySession(userId, id, { state, timeframe: viewTfRef.current }).catch((e) =>
        console.error("[replay] save failed", e),
      );
    }, 1500);
  }, [sessionId, userId]);

  const viewTfRef = useRef(viewTf);
  viewTfRef.current = viewTf;

  const persistNow = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (!stateRef.current || !sessionId || !userId) return;
    const state = stateRef.current;
    state.viewTimeframe = viewTf;
    void updateReplaySession(userId, sessionId, {
      state,
      status: phase === "finished" ? "finished" : "active",
      timeframe: viewTf,
    }).catch(() => {});
  }, [sessionId, userId, viewTf, phase]);

  // ── Boucle de lecture ────────────────────────────────────────────────────
  const lastFrame = useRef(0);
  const frameId = useRef<number>(0);

  const tick = useCallback(
    (nowMs: number) => {
      frameId.current = requestAnimationFrame(tick);
      const engine = engineRef.current;
      if (!engine || !playingRef.current) return;
      const dt = Math.min(500, nowMs - lastFrame.current);
      lastFrame.current = nowMs;
      const simMs = dt * speedRef.current;
      const before = engine.now;
      engine.advance(simMs);
      if (engine.now !== before) {
        processBars(stateRef.current!, engine.data);
        setQuote(readQuote(engine));
        bump();
      }
      if (engine.atEnd) setPlaying(false);
    },
    [bump, readQuote],
  );

  const speedRef = useRef(speed);
  speedRef.current = speed;

  // ── Entrée dans le terminal ─────────────────────────────────────────────
  const loadSessionsOf = useCallback(
    async (accountId: string) => {
      if (!userId) return;
      const list = await loadReplaySessions(userId, accountId).catch(() => []);
      setSessions(list);
      return list;
    },
    [userId],
  );

  useEffect(() => {
    let active = true;
    async function boot() {
      if (!userId) return;
      setPhase("loading");
      setError(null);
      const account = replayAccounts[0] ?? null;
      if (!account) {
        if (active) setPhase("setup");
        return;
      }
      setActiveAccount(account);
      const list = await loadSessionsOf(account.id);
      const resumable = (list ?? []).find((s) => s.status === "active" && s.state);
      if (resumable && resumable.state) {
        if (active) await resumeInternal(resumable);
      } else if (active) {
        setPhase("setup");
      }
    }
    void boot().catch(() => setPhase("setup"));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => () => cancelAnimationFrame(frameId.current), []);

  /** Bascule un DTO restauré en moteur + état. */
  const resumeInternal = useCallback(
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
        base.playbackSpeed = speed ?? 1;
        // On rejoue l'état en avant à partir des ordres (déterminisme).
        const rebuilt = rebuildState(base, engine.data, dto.state.now);
        rebuilt.drawings = base.drawings;
        drawingRef.current = base.drawings ?? [];
        stateRef.current = rebuilt;
        engineRef.current = engine;
        cfgRef.current = {
          accountId: dto.accountId,
          date: dto.startDate,
          startTime: dto.startTime,
          timeframe: dto.timeframe,
          startingBalance: rebuilt.account.startingBalance,
        };
        setSessionId(dto.id);
        setViewTfState(rebuilt.viewTimeframe);
        setQuote(readQuote(engine));
        setPhase("running");
        return true;
      } catch (e) {
        console.error("[replay] restore failed", e);
        setError("rt.errorData");
        setPhase("setup");
        return false;
      }
    },
    [readQuote, speed],
  );

  // ── Création d'un compte de rejeu ───────────────────────────────────────
  const createReplayAccount = useCallback(
    async (form: { name: string; startingBalance: number }) => {
      if (!userId) throw new Error("not authenticated");
      const acc = await addAccount({
        name: form.name || "NQ Backtest",
        type: "replay",
        icon: "history",
        startingBalance: form.startingBalance,
      });
      setActiveAccount(acc);
      setSessions([]);
      setPhase("setup");
      return acc;
    },
    [userId, addAccount],
  );

  /** Choisit un compte de rejeu parmi plusieurs et charge ses sessions. */
  const selectAccount = useCallback(
    (accountId: string) => {
      const acc = replayAccounts.find((a) => a.id === accountId) ?? null;
      setActiveAccount(acc);
      if (acc) void loadSessionsOf(acc.id);
      setPhase("setup");
    },
    [replayAccounts, loadSessionsOf],
  );

  // ── Démarrer une nouvelle séance ────────────────────────────────────────
  const startNew = useCallback(
    async (cfg: StartConfig) => {
      if (!userId) return;
      try {
        setError(null);
        setPhase("loading");
        const engine = new ReplayEngine({
          symbol: "NQ",
          date: cfg.date,
          startTime: cfg.startTime,
          timeframe: cfg.timeframe,
        });
        await engine.start();
        const base = createInitialState({
          symbol: "NQ",
          startingBalance: cfg.startingBalance,
          now: engine.now,
          commissionPerContract: 2.5,
          slippageTicks: 1,
        });
        base.viewTimeframe = cfg.timeframe;
        engineRef.current = engine;
        stateRef.current = base;
        cfgRef.current = cfg;
        const id = await createReplaySession(userId, {
          accountId: cfg.accountId,
          symbol: "NQ",
          startDate: cfg.date,
          startTime: cfg.startTime,
          timeframe: cfg.timeframe,
          state: base,
        });
        setSessionId(id);
        setActiveAccount(accounts.find((a) => a.id === cfg.accountId) ?? activeAccount);
        setViewTfState(cfg.timeframe);
        setPlaying(false);
        playingRef.current = false;
        setQuote(readQuote(engine));
        setPhase("running");
      } catch (e) {
        console.error("[replay] start failed", e);
        setError("rt.errorData");
        setPhase("setup");
      }
    },
    [userId, accounts, activeAccount, readQuote],
  );

  // ── Contrôles de lecture ────────────────────────────────────────────────
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
    persistNow();
  }, [persistNow]);

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
    // Reconstruction déterministe de l'état jusqu'à la nouvelle horloge.
    stateRef.current = rebuildState(state, engine.data, engine.now);
    stateRef.current.drawings = drawingRef.current;
    setQuote(readQuote(engine));
    bump();
  }, [bump, readQuote]);

  const drawingRef = useRef<Drawing[]>([]);

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

  // ── Ordres ──────────────────────────────────────────────────────────────
  const placeOrderTicket = useCallback(
    (input: PlaceOrderInput) => {
      const engine = engineRef.current;
      const state = stateRef.current;
      if (!engine || !state) return { ok: false as const };
      const order = simPlaceOrder({ state, input, bars: engine.data });
      refreshValuation(state, engine.data);
      scheduleSave();
      bump();
      return { ok: true as const, order };
    },
    [bump, scheduleSave],
  );

  const bracketOf = useCallback(
    (posId: string, sl: number | null, tp: number | null) => {
      const state = stateRef.current;
      if (!state) return;
      setPositionBracket(state, posId, sl, tp);
      scheduleSave();
      bump();
    },
    [bump, scheduleSave],
  );

  const moveOrder = useCallback(
    (orderId: string, price: number) => {
      const state = stateRef.current;
      if (!state) return;
      moveWorkingOrder(state, orderId, price);
      scheduleSave();
      bump();
    },
    [bump, scheduleSave],
  );

  const cancelOrder = useCallback(
    (orderId: string) => {
      const state = stateRef.current;
      if (!state) return;
      simCancelOrder(state, orderId);
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
      const state = stateRef.current;
      if (!state) return;
      drawingRef.current = [...drawingRef.current, d];
      state.drawings = drawingRef.current;
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
    if (!engine || !state || !userId || !sessionId || !cfgRef.current) return false;
    // Liquide d'abord au prix marqué pour fermer l'exposition, puis journal.
    flattenPositions(state, engine.data);
    refreshValuation(state, engine.data);
    const accountId = cfgRef.current.accountId;
    const res = await pushReplayTradesToJournal(userId, sessionId, accountId, state.closedTrades);
    await updateReplaySession(userId, sessionId, { state, status: "finished" }).catch(() => {});
    setPhase("finished");
    setPlaying(false);
    playingRef.current = false;
    return res;
  }, [sessionId, userId]);

  const abandon = useCallback(async () => {
    if (userId && sessionId) await abandonReplaySession(userId, sessionId).catch(() => {});
    setPhase("setup");
    setSessionId(null);
    engineRef.current = null;
    stateRef.current = null;
    drawingRef.current = [];
  }, [sessionId, userId]);

  /** Revenir à l'écran de configuration après avoir sauvegardé. */
  const goToSetup = useCallback(() => {
    persistNow();
    setPhase("setup");
    setPlaying(false);
    playingRef.current = false;
  }, [persistNow]);

  const beginNew = useCallback(() => {
    persistNow();
    setPlaying(false);
    playingRef.current = false;
    setPhase("setup");
    setSessionId(null);
    engineRef.current = null;
    stateRef.current = null;
    drawingRef.current = [];
  }, [persistNow]);

  // ── Bougies pour le graphe ──────────────────────────────────────────────
  // `version` avance à chaque tick de lecture/action : c'est le TRIGGER des
  // bougies révélées (le quote n'en a pas besoin, il bouge avec `version`).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const candles: SimulatedCandle[] = useMemo(() => {
    const engine = engineRef.current;
    if (!engine) return [];
    return engine.tfCandles(viewTf);
  }, [viewTf, version]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bars: OhlcBar[] = useMemo(() => engineRef.current?.data ?? [], [version]);

  const clockLabel = engineRef.current ? engineRef.current.clockLabel() : "";

  // Nettoyage.
  useEffect(
    () => () => {
      cancelAnimationFrame(frameId.current);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  return {
    phase,
    error,
    account: activeAccount,
    sessions,
    replayAccounts,
    createReplayAccount,
    selectAccount,
    loadSessionsOf,
    startNew,
    resume: resumeInternal,
    goToSetup,
    beginNew,
    finish,
    abandon,
    exit: onExit,
    engine: engineRef.current,
    state: stateRef.current,
    candles,
    bars,
    quote,
    clockLabel,
    playing,
    togglePlay,
    play,
    pause,
    nextCandle,
    prevCandle,
    speed,
    setSpeed: setReplaySpeed,
    viewTf,
    setViewTf,
    TIMEFRAMES,
    placeOrderTicket,
    bracketOf,
    moveOrder,
    cancelOrder,
    closePositionOf,
    setBracketOnPosition: setPositionBracket,
    drawings: drawingRef.current,
    addDrawing,
    updateDrawing,
    removeDrawing,
    sessionId,
    atStart: engineRef.current?.atStart ?? true,
    atEnd: engineRef.current?.atEnd ?? false,
    bounds: engineRef.current
      ? engineRef.current.sessionBounds()
      : { ethStart: 0, ethEnd: 1, rthStart: 0, rthEnd: 0 },
    symbol: "NQ",
    date: cfgRef.current?.date ?? "",
    startTime: cfgRef.current?.startTime ?? "",
    t,
  };
}
