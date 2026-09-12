/**
 * ReplayShellArea — qui occupe la fenêtre de contenu.
 *
 * Le terminal a besoin de toute la place, mais PAS au prix de la navigation.
 * La première version le montait en `fixed inset-0` : immersif, et le rail
 * disparaissait avec — on ne pouvait plus aller au Journal sans quitter le
 * rejeu. Ici le terminal prend la place du contenu et rien d'autre : il est un
 * FRÈRE de flex du rail, qui garde sa largeur (68 ou 212 px selon qu'il soit
 * replié) et reste cliquable.
 *
 * La bascule dépend aussi de la page courante. Sans cela, cliquer « Journal »
 * pendant une séance n'aurait rien affiché : le terminal serait resté devant.
 * Le rejeu tient la fenêtre quand on est SUR Backtest, et la rend dès qu'on va
 * ailleurs — la séance, elle, continue de vivre dans le provider.
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
  const wants = launchOpen || session.active || session.finished;
  if (!wants || page !== "backtest") return <>{children}</>;
  return <ReplayStage onGoJournal={onGoJournal} />;
}
