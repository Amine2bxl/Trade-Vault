/**
 * Backtest — l'entrée du mode rejeu, DANS le shell.
 *
 * Contrairement à la première version, rien ne « prend possession » de l'écran :
 * quand le trader arrive ici, un pop-up de pré-confirmation lui demande le
 * minimum (compte, date, heure, timeframe, capital) ; à validation, la
 * transition jouée et le terminal s'ouvre. Toutes les autres pages (Journal,
 * Dashboard, Calendar…) restent accessibles et branchées sur le compte de rejeu
 * — une app dans l'app.
 */

import { useEffect, useState } from "react";
import { CalendarClock, Play } from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { useAvailableHeight } from "../hooks/useAvailableHeight";
import { usePageLock } from "../components/PremiumGate";
import { useReplayMode } from "../replay/ReplayModeContext";
import ReplayTerminal from "../replay/ReplayTerminal";
import ReplayFinish from "../replay/ReplayFinish";
import ReplayLaunchModal from "../replay/ReplayLaunchModal";
import type { JournalPushResult } from "../store/replay";

export default function Backtest() {
  const { t } = useT();
  const confirm = useConfirm();
  const licked = usePageLock("backtest");
  const { session, openLaunch, exit } = useReplayMode();
  const { boxRef, height } = useAvailableHeight();

  const [push, setPush] = useState<JournalPushResult | null>(null);

  // Arrivée sur la page : le pop-up de pré-confirmation s'ouvre (sauf si une
  // session est déjà en cours).
  useEffect(() => {
    if (licked || session.active || session.finished) return;
    openLaunch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [licked, session.active, session.finished]);

  // Le terminal à l'écran signale sa présence (la lecture reprend / s'arrête).
  useEffect(() => {
    if (session.active && !session.finished) session.setVisible(true);
    return () => {
      session.setVisible(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.active, session.finished]);

  const goJournal = () => {
    window.dispatchEvent(new CustomEvent("tv:navigate", { detail: { page: "journal" } }));
  };

  const confirmFinish = async () => {
    if (!(await confirm(t("rt.finishConfirm")))) return;
    const res = await session.finish();
    if (res) setPush(res);
  };

  // Verrou Premium : la page est rendue derrière le mur d'aperçu (PageGate).
  // On fournit un corps illustratif — l'aperçu doit montrer quelque chose.
  if (licked) {
    return (
      <div className="grid min-h-[60vh] place-items-center rounded-3xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)]">
        <div className="collection-max-w-sm px-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--tv-surface-hover)]">
            <CalendarClock className="h-6 w-6 text-[var(--tv-text-muted)]" />
          </div>
          <p className="text-sm font-semibold text-[var(--tv-text)]">{t("rt.previewTitle")}</p>
          <p className="mt-1 text-xs text-[var(--tv-text-muted)]">{t("rt.premiumBenefit")}</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={boxRef} style={{ height }} className="overflow-hidden rounded-2xl">
      {!session.active && !session.finished ? (
        /* Pas encore de session : une carte « entrer » plutôt qu'un écran vide. */
        <div className="flex h-full items-center justify-center">
          <button
            type="button"
            onClick={openLaunch}
            className="group flex flex-col items-center gap-3 rounded-3xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-10 py-12 transition hover:border-[var(--tv-accent)]/50"
          >
            <div className="grid h-14 w-14 place-items-center rounded-2xl tv-accent-fill transition group-hover:scale-105">
              <Play className="ml-0.5 h-6 w-6 text-white" />
            </div>
            <div className="text-sm font-bold text-[var(--tv-text)]">NQ · Historical Replay</div>
            <div className="text-xs text-[var(--tv-text-muted)]">{t("rt.previewCta")}</div>
          </button>
        </div>
      ) : session.finished ? (
        <ReplayFinish
          state={session.state}
          accountName={session.account?.name ?? "Replay"}
          push={push}
          onNew={openLaunch}
          onGoJournal={goJournal}
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
      <ReplayLaunchModal />
    </div>
  );
}
