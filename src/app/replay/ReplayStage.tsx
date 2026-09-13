/**
 * ReplayStage — la scène du rejeu : seuil, terminal, bilan.
 *
 * Entrer change de monde. La scène prend l'écran ENTIER — rail compris, sans
 * marge ni en-tête de page — et le thème bascule. On trade ici, on ne navigue
 * pas : la sortie est le bouton du terminal, et elle est explicite.
 *
 * C'est `ReplayShellArea` qui arbitre quand cela s'applique. Hors du terminal,
 * le mode rejeu laisse l'application entièrement normale : rail, pages,
 * compte de rejeu actif — c'est là qu'on lit son journal.
 *
 * La session vit dans `ReplayModeProvider` : aller sur une autre page ne
 * détruit rien, et les pages restent branchées sur le compte de rejeu tant que
 * le mode est actif.
 *
 * LES DEUX SORTIES SONT DISTINCTES, et c'est tout l'objet de ce fichier :
 *
 *  • TERMINER & EXPORTER ferme la séance et écrit les trades au journal. C'est
 *    l'aboutissement. On annonce ce qui va être écrit AVANT, et ce qui a été
 *    écrit APRÈS — un export qui ne dit rien ne se distingue pas d'un export
 *    qui n'a pas eu lieu, et c'est exactement ce qui se passait.
 *  • QUITTER range la séance et revient au produit, sans rien exporter. Elle
 *    reste reprenable, et on le dit.
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
  const [busy, setBusy] = useState(false);

  const showSetup = launchOpen && !session.active && !session.finished;
  if (!showSetup && !session.active && !session.finished) return null;

  const accountName = session.account?.name ?? "Replay";

  /**
   * Terminer : on DIT ce qui va être écrit, on l'écrit, puis on DIT ce qui
   * l'a été.
   *
   * Le message de confirmation portait auparavant une phrase générique. Un
   * trader qui a fermé neuf trades veut lire « neuf » : c'est le seul chiffre
   * qui lui permet de vérifier, après coup, que l'export a bien eu lieu.
   */
  const confirmFinish = async () => {
    if (busy) return;
    const n = session.state?.closedTrades.length ?? 0;
    const message =
      n === 0
        ? t("rt.finishNothing")
        : t("rt.finishBody").replace("{n}", String(n)).replace("{account}", accountName);
    if (!(await confirm(message))) return;
    setBusy(true);
    try {
      const res = await session.finish();
      if (!res) {
        toast(t("rt.exportFailed"), "error");
        return;
      }
      setPush(res);
      if (res.saved > 0) {
        toast(t("rt.exported").replace("{n}", String(res.saved)), "success");
      } else if (res.failed > 0) {
        toast(t("rt.exportFailed"), "error");
      } else {
        toast(t("rt.exportedNone"), "info");
      }
    } finally {
      setBusy(false);
    }
  };

  /**
   * Quitter : on demande, on enregistre, et on DIT ce qui s'est passé.
   *
   * La sortie emporte une séance en cours : le trader mérite d'être prévenu,
   * et de savoir si sa séance est réellement reprenable — ce qui n'est pas le
   * cas quand la table de persistance manque et que le rejeu tournait en local.
   */
  const confirmExit = async () => {
    if (busy) return;
    if (!(await confirm(t("rt.exitConfirm")))) return;
    setBusy(true);
    try {
      const saved = await exit();
      toast(saved ? t("rt.sessionSaved") : t("rt.sessionLocalOnly"), saved ? "success" : "info");
    } finally {
      setBusy(false);
    }
  };

  const leaveForJournal = async () => {
    await exit();
    onGoJournal();
  };

  return (
    <div
      // L'ÉCRAN ENTIER, rail compris. On trade ici, on ne navigue pas : un rail
      // visible pendant qu'on passe des ordres invite à partir au mauvais
      // moment. La sortie est le bouton du terminal, et elle est explicite.
      // `--tv-z-overlay` est le calque plein écran du design system.
      //
      // `min-h-0` est indispensable dans une colonne flex : sans lui le graphe,
      // qui mesure sa place, pousserait ses panneaux hors de l'écran.
      className="fixed inset-0 z-[var(--tv-z-overlay)] flex min-h-0 w-screen flex-col bg-[var(--tv-bg)]"
      role="region"
      aria-label={t("rt.modeTitle")}
    >
      {showSetup ? (
        <ReplaySetup />
      ) : session.finished ? (
        <ReplayFinish
          state={session.state}
          accountName={accountName}
          push={push}
          onNew={() => setPush(null)}
          onGoJournal={() => void leaveForJournal()}
          onExit={() => void exit()}
        />
      ) : (
        <ReplayTerminal
          accountName={accountName}
          dataSource={session.dataSource}
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
          onPause={session.pause}
          onNext={session.nextCandle}
          onPrev={session.prevCandle}
          onPlaceOrder={(input) => session.placeOrderTicket(input)}
          onBracket={session.bracketOf}
          onMoveOrder={session.moveOrder}
          onMoveOrderBracket={session.moveOrderBracket}
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
