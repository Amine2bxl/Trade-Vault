/**
 * Backtest — le point d'entrée du Terminal de Rejeu.
 *
 * C'est un ENVIRONNEMENT, pas une page du shell : l'application entière bascule
 * ici quand la navigation atteint `backtest`. Le verrou Premium est posé avant
 * tout, la séance démarre du bon compte de rejeu, et la sortie est aussi fluide
 * que l'entrée.
 */

import { Suspense, useState } from "react";
import { useT } from "../i18n/LanguageContext";
import { usePageLockState, PreviewWall } from "../components/PremiumGate";
import { useConfirm } from "../contexts/ConfirmContext";
import LoadingScreen from "../components/LoadingScreen";
import UpgradeModal from "../components/UpgradeModal";
import { useReplaySession } from "../replay/useReplaySession";
import ReplaySetup from "../replay/ReplaySetup";
import ReplayTerminal from "../replay/ReplayTerminal";
import ReplayFinish from "../replay/ReplayFinish";
import type { JournalPushResult } from "../store/replay";
import type { PlaceOrderInput } from "@/modules/replay";

export default function Backtest({
  userId,
  onExit,
}: {
  userId: string | null;
  onExit: () => void;
}) {
  const { t } = useT();
  const confirm = useConfirm();
  const { locked, resolved } = usePageLockState("backtest");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [push, setPush] = useState<JournalPushResult | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);

  const session = useReplaySession({ userId, onExit: () => setConfirmExit(true) });
  const { phase } = session;

  const busy = phase === "loading";

  // Le verrou premium : même expérience que les pages payantes du shell.
  if (!resolved) return <LoadingScreen message={t("app.checkingAccount")} />;
  if (locked) {
    return (
      <div className="flex h-dvh w-full items-center justify-center overflow-hidden bg-[var(--tv-bg)]">
        <div className="w-full max-w-3xl px-6">
          <PreviewWall
            locked
            requiredTier="pro"
            benefit={t("rt.premiumBenefit")}
            onUpgrade={() => setUpgradeOpen(true)}
          >
            <div className="h-[60vh] w-full rounded-3xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)]" />
          </PreviewWall>
        </div>
        <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
      </div>
    );
  }

  const onPlace = (input: PlaceOrderInput) => {
    const res = session.placeOrderTicket(input);
    void res;
  };

  const handleFinish = async () => {
    if (!(await confirm(t("rt.finishConfirm")))) return;
    const res = await session.finish();
    if (res) setPush(res);
  };

  const handleExit = () => {
    if (confirmExit) {
      setConfirmExit(false);
      session.exit?.();
      return;
    }
    void confirm(t("rt.exitConfirm")).then((ok) => {
      if (ok) {
        void session.pause();
        onExit();
      }
    });
  };

  const goJournal = () => {
    window.dispatchEvent(new CustomEvent("tv:navigate", { detail: { page: "journal" } }));
  };

  return (
    <Suspense fallback={<LoadingScreen message={t("rt.enter")} />}>
      <div className="h-dvh w-full overflow-hidden bg-[var(--tv-bg)]">
        {busy && <LoadingScreen message={t("rt.enter")} />}

        {!busy && phase === "setup" && (
          <ReplaySetup
            replayAccounts={session.replayAccounts}
            account={session.account}
            sessions={session.sessions}
            busy={false}
            onCreateAccount={(form) => void session.createReplayAccount(form).catch(() => {})}
            onHoldAccount={(id) => session.selectAccount(id)}
            onResume={(dto) => void session.resume(dto)}
            onStart={(cfg) => void session.startNew(cfg)}
          />
        )}

        {!busy && phase === "running" && (
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
            onPlaceOrder={onPlace}
            onBracket={session.bracketOf}
            onMoveOrder={session.moveOrder}
            onCancelOrder={session.cancelOrder}
            onClosePos={session.closePositionOf}
            drawings={session.drawings}
            onAddDrawing={session.addDrawing}
            onUpdateDrawing={session.updateDrawing}
            onRemoveDrawing={session.removeDrawing}
            onFinish={handleFinish}
            onExit={handleExit}
          />
        )}

        {!busy && phase === "finished" && (
          <ReplayFinish
            state={session.state}
            accountName={session.account?.name ?? "Replay"}
            push={push}
            onNew={session.beginNew}
            onGoJournal={goJournal}
            onExit={onExit}
          />
        )}
      </div>
    </Suspense>
  );
}
