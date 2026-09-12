/**
 * ReplayShellArea — qui occupe l'écran, et quand.
 *
 * LE TERMINAL PREND TOUT, LE MODE REJEU NON. Deux situations qu'il ne faut pas
 * confondre :
 *
 *  • dans le TERMINAL, le rejeu couvre l'écran entier, rail compris. On trade,
 *    on ne navigue pas — et un rail visible pendant qu'on passe des ordres est
 *    une invitation à partir au mauvais moment. On en sort par le bouton du
 *    terminal, pas par la navigation ;
 *  • HORS du terminal, en mode rejeu, tout redevient normal : rail, pages,
 *    compte de rejeu actif. C'est là qu'on lit son journal.
 *
 * La bascule dépend donc de la page courante ET de l'état de la séance. Le
 * contenu de l'application reste MONTÉ dessous : revenir d'une séance ne
 * reconstruit pas la page qu'on avait quittée.
 */

import type { ReactNode } from "react";
import { useReplayMode } from "./ReplayModeContext";
import ReplayStage from "./ReplayStage";

export default function ReplayShellArea({
  page,
  onGoJournal,
  children,
}: {
  page: string;
  onGoJournal: () => void;
  children: ReactNode;
}) {
  const { session, launchOpen } = useReplayMode();
  const takeover = (launchOpen || session.active || session.finished) && page === "backtest";
  return (
    <>
      {children}
      {takeover && <ReplayStage onGoJournal={onGoJournal} />}
    </>
  );
}
