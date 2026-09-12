/**
 * ReplayMode — le mode « app dans l'app ».
 *
 * Le terminal de rejeu n'est pas un écran à part : c'est un MODE de
 * l'application. Quand il est actif :
 *   • le compte actif devient le compte de rejeu, donc Journal, Dashboard,
 *     Analytics, Calendrier et Rapports affichent naturellement les données du
 *     rejeu, sans qu'aucune page n'ait à le savoir ;
 *   • la session (horloge, ordres, dessins) survit à la navigation ;
 *   • un bandeau et une transition signalent clairement qu'on est en rejeu.
 *
 * Le provider monte la session avec le shell : sortir du terminal puis y
 * revenir ne perd rien.
 */

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useAccounts } from "../contexts/AccountContext";
import {
  useReplaySession,
  type ReplaySessionApi,
  type ReplayStartConfig,
} from "./useReplaySession";
import type { ReplaySessionDto } from "../store/replay";

export type ReplayTransitionKind = "in" | "out" | null;

interface Ctx {
  session: ReplaySessionApi;
  transition: ReplayTransitionKind;
  launchOpen: boolean;
  openLaunch: () => void;
  closeLaunch: () => void;
  /** Entre dans le mode rejeu : démarre la séance, bascule le compte, joue la transition. */
  enter: (cfg: ReplayStartConfig) => Promise<boolean>;
  /** Reprend une séance existante. */
  resumeInto: (dto: ReplaySessionDto) => Promise<boolean>;
  /** Quitte le mode rejeu et restaure le compte précédent. */
  exit: () => Promise<void>;
}

const ReplayModeCtx = createContext<Ctx | null>(null);

export function useReplayMode(): Ctx {
  const ctx = useContext(ReplayModeCtx);
  if (!ctx) throw new Error("useReplayMode must be used within ReplayModeProvider");
  return ctx;
}

export function ReplayModeProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  const { activeId, switchAccount } = useAccounts();
  const session = useReplaySession({ userId });
  const [transition, setTransition] = useState<ReplayTransitionKind>(null);
  const [launchOpen, setLaunchOpen] = useState(false);
  const previousAccount = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runTransition = useCallback((kind: Exclude<ReplayTransitionKind, null>, ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    setTransition(kind);
    timer.current = setTimeout(() => setTransition(null), ms);
  }, []);

  const openLaunch = useCallback(() => {
    const target = session.account?.id ?? session.replayAccounts[0]?.id;
    if (target) void session.loadSessionsOf(target);
    setLaunchOpen(true);
  }, [session]);

  const enter = useCallback(
    async (cfg: ReplayStartConfig) => {
      previousAccount.current = activeId;
      const ok = await session.startNew(cfg);
      if (!ok) return false;
      switchAccount(cfg.accountId);
      setLaunchOpen(false);
      runTransition("in", 1400);
      return true;
    },
    [activeId, session, switchAccount, runTransition],
  );

  const resumeInto = useCallback(
    async (dto: ReplaySessionDto) => {
      previousAccount.current = activeId;
      const ok = await session.resume(dto);
      if (!ok) return false;
      switchAccount(dto.accountId);
      setLaunchOpen(false);
      runTransition("in", 1400);
      return true;
    },
    [activeId, session, switchAccount, runTransition],
  );

  const exit = useCallback(async () => {
    await session.leave();
    if (previousAccount.current) switchAccount(previousAccount.current);
    runTransition("out", 1100);
  }, [session, switchAccount, runTransition]);

  return (
    <ReplayModeCtx.Provider
      value={{
        session,
        transition,
        launchOpen,
        openLaunch,
        closeLaunch: () => setLaunchOpen(false),
        enter,
        resumeInto,
        exit,
      }}
    >
      {children}
    </ReplayModeCtx.Provider>
  );
}
