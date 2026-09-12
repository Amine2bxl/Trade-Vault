/**
 * ReplayStage — la scène du rejeu, PAR-DESSUS l'application.
 *
 * Le rejeu n'est plus une page dans le cadre TradeVault : entrer change de
 * monde. La scène couvre tout l'écran — rail de navigation, en-tête et marges
 * disparaissent — et le thème bascule. Le trader n'a plus sous les yeux une
 * fonctionnalité de son journal, mais un terminal.
 *
 * La première version rendait le terminal DANS la page, sous la barre latérale
 * et dans une boîte de 78 % de la hauteur : on restait visiblement au même
 * endroit, et le changement de contexte ne se lisait pas. C'est ce que ce
 * composant corrige.
 *
 * La session, elle, continue de vivre dans `ReplayModeProvider` : quitter la
 * scène ne détruit rien, et les autres pages restent branchées sur le compte
 * de rejeu tant que le mode est actif.
 */

import { useState } from "react";
import { useT } from "../i18n/LanguageContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { useReplayMode } from "./ReplayModeContext";
import ReplayTerminal from "./ReplayTerminal";
import ReplayFinish from "./ReplayFinish";
import ReplaySetup from "./ReplaySetup";
import type { JournalPushResult } from "../store/replay";

export default function ReplayStage({ onGoJournal }: { onGoJournal: () => void }) {
  const { t } = useT();
  const confirm = useConfirm();
  const { session, launchOpen, exit } = useReplayMode();
  const [push, setPush] = useState<JournalPushResult | null>(null);

  const showSetup = launchOpen && !session.active && !session.finished;
  if (!showSetup && !session.active && !session.finished) return null;

  const confirmFinish = async () => {
    if (!(await confirm(t("rt.finishConfirm")))) return;
    const res = await session.finish();
    if (res) setPush(res);
  };

  const leaveForJournal = async () => {
    await exit();
    onGoJournal();
  };

  return (
    <div
      // FRÈRE DE FLEX du rail, pas calque par-dessus lui. `fixed inset-0`
      // donnait bien l'immersion, mais emportait la navigation avec : on ne
      // pouvait plus rejoindre le Journal sans quitter la séance. Le terminal
      // prend donc la fenêtre de contenu — toute la fenêtre, sans marge ni
      // coins arrondis, pour que la rupture reste franche — et laisse le rail.
      //
      // `min-h-0` est indispensable dans une colonne flex : sans lui le
      // graphe, qui mesure sa place, pousserait ses panneaux hors de l'écran.
      className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--tv-bg)]"
      role="region"
      aria-label={t("rt.modeTitle")}
    >
      {showSetup ? (
        <ReplaySetup />
      ) : session.finished ? (
        <ReplayFinish
          state={session.state}
          accountName={session.account?.name ?? "Replay"}
          push={push}
          onNew={() => setPush(null)}
          onGoJournal={() => void leaveForJournal()}
          onExit={() => void exit()}
        />
      ) : (
        <ReplayTerminal
          accountName={session.account?.name ?? "Replay"}
          state={session.state}
          candles={session.candles}
          bounds={session.bounds}
          quote={session.quote}
          playing={session.playing}
          atStart={session.atStart}
          atEnd={session.atEnd}
          clockLabel={session.clockLabel}
          viewTf={session.viewTf}
          setViewTf={session.setViewTf}
          timeframes={session.TIMEFRAMES}
          speed={session.speed}
          setSpeed={session.setSpeed}
          onTogglePlay={session.togglePlay}
          onNext={session.nextCandle}
          onPrev={session.prevCandle}
          onPlaceOrder={(input) => session.placeOrderTicket(input)}
          onBracket={session.bracketOf}
          onMoveOrder={session.moveOrder}
          onCancelOrder={session.cancelOrder}
          onClosePos={session.closePositionOf}
          drawings={session.drawings}
          onAddDrawing={session.addDrawing}
          onUpdateDrawing={session.updateDrawing}
          onRemoveDrawing={session.removeDrawing}
          onFinish={() => void confirmFinish()}
          onExit={() => void exit()}
        />
      )}
    </div>
  );
}
