/**
 * ReplayStage — la scène du rejeu : seuil, terminal, bilan.
 *
 * Entrer change de monde sans couper les ponts. La scène prend TOUTE la
 * fenêtre de contenu — ni marge, ni coins arrondis, ni en-tête de page, et le
 * thème bascule — mais le rail de navigation garde sa place et reste
 * cliquable. Deux versions ont raté cet équilibre : la première rendait le
 * terminal dans la page, sous une boîte de 78 % de la hauteur, et on ne
 * sentait pas qu'on avait bougé ; la seconde le montait en `fixed inset-0`,
 * et on ne pouvait plus rejoindre le Journal sans quitter la séance.
 * C'est `ReplayShellArea` qui arbitre désormais qui occupe la fenêtre.
 *
 * La session vit dans `ReplayModeProvider` : aller sur une autre page ne
 * détruit rien, et les pages restent branchées sur le compte de rejeu tant que
 * le mode est actif.
 */

import { useState } from "react";
import { useT } from "../i18n/LanguageContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { useToast } from "../contexts/ToastContext";
import { useReplayMode } from "./ReplayModeContext";
import ReplayTerminal from "./ReplayTerminal";
import ReplayFinish from "./ReplayFinish";
import ReplaySetup from "./ReplaySetup";
import type { JournalPushResult } from "../store/replay";

export default function ReplayStage({ onGoJournal }: { onGoJournal: () => void }) {
  const { t } = useT();
  const confirm = useConfirm();
  const { toast } = useToast();
  const { session, launchOpen, exit } = useReplayMode();
  const [push, setPush] = useState<JournalPushResult | null>(null);

  const showSetup = launchOpen && !session.active && !session.finished;
  if (!showSetup && !session.active && !session.finished) return null;

  const confirmFinish = async () => {
    if (!(await confirm(t("rt.finishConfirm")))) return;
    const res = await session.finish();
    if (res) setPush(res);
  };

  /**
   * Quitter : on demande, on enregistre, et on DIT ce qui s'est passé.
   *
   * La sortie était muette et sans confirmation. Or elle emporte une séance en
   * cours : le trader méritait d'être prévenu, et de savoir si sa séance est
   * réellement reprenable — ce qui n'est pas le cas quand la table de
   * persistance manque et que le rejeu tournait en local.
   */
  const confirmExit = async () => {
    if (!(await confirm(t("rt.exitConfirm")))) return;
    const saved = await exit();
    toast(saved ? t("rt.sessionSaved") : t("rt.sessionLocalOnly"), saved ? "success" : "info");
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
          onExit={() => void confirmExit()}
        />
      )}
    </div>
  );
}
