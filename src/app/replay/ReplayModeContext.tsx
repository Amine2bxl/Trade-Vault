/**
 * ReplayMode — le mode « app dans l'app ».
 *
 * Le terminal de rejeu est un MODE de l'application, pas un écran à part :
 *   • le compte actif devient le compte de rejeu → Journal, Dashboard,
 *     Analytics, Calendrier et Rapports affichent les données du rejeu ;
 *   • la session (horloge, ordres, dessins) survit à la navigation ;
 *   • l'identité visuelle bascule vers le thème Replay le temps du mode.
 *
 * L'entrée joue une séquence immersive : thème changé, voile de chargement,
 * puis révélation du terminal. La sortie restaure le thème réel.
 */

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useAccounts } from "../contexts/AccountContext";
import { useTheme } from "../contexts/ThemeContext";
import {
  useReplaySession,
  type ReplaySessionApi,
  type ReplayStartConfig,
} from "./useReplaySession";
import { applyReplayTheme, restoreUserTheme } from "./replayTheme";
import { countAccountTrades, seedReplayWeek, type ReplaySessionDto } from "../store/replay";

export type ReplayOverlayStage = "loading" | "in" | "out" | null;

interface Ctx {
  session: ReplaySessionApi;
  transition: ReplayOverlayStage;
  pending: ReplayStartConfig | null;
  launchOpen: boolean;
  openLaunch: () => void;
  closeLaunch: () => void;
  enter: (cfg: ReplayStartConfig) => Promise<boolean>;
  resumeInto: (dto: ReplaySessionDto) => Promise<boolean>;
  exit: () => Promise<void>;
  /** Semaine d'exemple NQ si le compte est vide — pour voir l'app en action. */
  ensureSampleWeek: (accountId: string) => Promise<number>;
}

const ReplayModeCtx = createContext<Ctx | null>(null);

export function useReplayMode(): Ctx {
  const ctx = useContext(ReplayModeCtx);
  if (!ctx) throw new Error("useReplayMode must be used within ReplayModeProvider");
  return ctx;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ReplayModeProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  const { activeId, switchAccount } = useAccounts();
  const { active: userTheme } = useTheme();
  const session = useReplaySession({ userId });
  const [transition, setTransition] = useState<ReplayOverlayStage>(null);
  const [pending, setPending] = useState<ReplayStartConfig | null>(null);
  const [launchOpen, setLaunchOpen] = useState(false);
  const previousAccount = useRef<string | null>(null);
  const currentTheme = useRef(userTheme);
  currentTheme.current = userTheme;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const after = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const openLaunch = useCallback(() => {
    const target = session.account?.id ?? session.replayAccounts[0]?.id;
    if (target) void session.loadSessionsOf(target);
    setLaunchOpen(true);
  }, [session]);

  const enter = useCallback(
    async (cfg: ReplayStartConfig) => {
      clearTimers();
      previousAccount.current = activeId;
      applyReplayTheme();
      setPending(cfg);
      setTransition("loading");
      // Battement immersif : les données se préparent pendant que l'écran est
      // déjà passé en thème rejeu.
      await wait(700);
      const ok = await session.startNew(cfg);
      if (!ok) {
        restoreUserTheme(currentTheme.current);
        setTransition(null);
        setPending(null);
        return false;
      }
      switchAccount(cfg.accountId);
      setLaunchOpen(false);
      setTransition("in");
      after(1500, () => {
        setTransition(null);
        setPending(null);
      });
      return true;
    },
    [activeId, session, switchAccount],
  );

  const resumeInto = useCallback(
    async (dto: ReplaySessionDto) => {
      clearTimers();
      previousAccount.current = activeId;
      applyReplayTheme();
      setPending({
        accountId: dto.accountId,
        date: dto.startDate,
        startTime: dto.startTime,
        timeframe: dto.timeframe,
        startingBalance: dto.state?.account.startingBalance ?? 100_000,
      });
      setTransition("loading");
      await wait(600);
      const ok = await session.resume(dto);
      if (!ok) {
        restoreUserTheme(currentTheme.current);
        setTransition(null);
        setPending(null);
        return false;
      }
      switchAccount(dto.accountId);
      setLaunchOpen(false);
      setTransition("in");
      after(1500, () => {
        setTransition(null);
        setPending(null);
      });
      return true;
    },
    [activeId, session, switchAccount],
  );

  const exit = useCallback(async () => {
    clearTimers();
    setTransition("out");
    restoreUserTheme(currentTheme.current);
    await session.leave();
    if (previousAccount.current) switchAccount(previousAccount.current);
    after(900, () => setTransition(null));
  }, [session, switchAccount]);

  const ensureSampleWeek = useCallback(
    async (accountId: string) => {
      if (!userId) return 0;
      const n = await countAccountTrades(userId, accountId);
      if (n > 0) return 0;
      return seedReplayWeek(userId, accountId);
    },
    [userId],
  );

  return (
    <ReplayModeCtx.Provider
      value={{
        session,
        transition,
        pending,
        launchOpen,
        openLaunch,
        closeLaunch: () => setLaunchOpen(false),
        enter,
        resumeInto,
        exit,
        ensureSampleWeek,
      }}
    >
      {children}
    </ReplayModeCtx.Provider>
  );
}
