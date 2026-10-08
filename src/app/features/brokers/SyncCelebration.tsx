import { useEffect, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { useT } from "@/app/i18n/LanguageContext";
import type { TKey } from "@/app/i18n/translations";
import { Button, Modal, cn } from "@/shared/ui";

/**
 * LE RETOUR DE CHEZ TRADOVATE.
 *
 * Le trader vient de quitter TradeVault pour se connecter chez son broker :
 * au retour, il doit VOIR que tout a marché, pas deviner à partir d'un toast.
 * Trois étapes qui se cochent l'une après l'autre — connecté, comptes trouvés,
 * trades importés — puis l'anneau qui se referme (le geste `.tv-fete` de la
 * validation du mois : la même famille, pas un effet de plus).
 *
 * Les chiffres affichés sont ceux que le serveur a RÉELLEMENT trouvés
 * (`completeTradovateOAuth`) : l'animation n'invente aucune progression. Tant
 * que la réponse n'est pas là, seule la première étape tourne.
 *
 * Mouvement : `fade-in-up` et le tracé de l'anneau, rien d'autre ; chaque
 * étape entre en 180 ms, décalée de 260 ms. Sous `prefers-reduced-motion`,
 * tout est affiché d'un coup (règle globale de `styles.css`).
 */

export type CelebrationState =
  | { phase: "working" }
  | {
      phase: "done";
      accounts: number;
      trades: number;
      unmapped: number;
      /** Connecté, mais la première synchro n'a pas abouti (elle sera
       *  retentée) : on ne prétend pas que tout est synchronisé. */
      syncPending: boolean;
    }
  | { phase: "failed"; messageKey: TKey };

/** Décalage entre deux étapes qui se cochent. */
const STEP_MS = 260;

/** Pendant l'échange avec Tradovate, la fenêtre ne se ferme pas : la fermer
 *  ne l'arrêterait pas, et le trader croirait avoir annulé. */
const noop = () => {};

export function SyncCelebration({
  state,
  onClose,
  onOpenJournal,
}: {
  state: CelebrationState | null;
  onClose: () => void;
  onOpenJournal: () => void;
}) {
  const { t } = useT();
  // Nombre d'étapes cochées : on les révèle une par une une fois la réponse
  // arrivée, au lieu de tout cocher dans la même image.
  const [revealed, setRevealed] = useState(0);
  const done = state?.phase === "done";

  useEffect(() => {
    if (!done) {
      setRevealed(0);
      return;
    }
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setRevealed(4);
      return;
    }
    const timers = [1, 2, 3, 4].map((n) => window.setTimeout(() => setRevealed(n), n * STEP_MS));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [done]);

  if (!state) return null;

  const plural = (n: number, one: TKey, many: TKey, none?: TKey) =>
    n === 0 && none ? t(none) : n === 1 ? t(one) : t(many).replace("{n}", String(n));

  const tick = (n: number): StepState => (revealed >= n ? "ok" : "wait");
  const steps: { label: string; state: StepState }[] =
    state.phase === "done"
      ? [
          { label: t("brokers.stepConnected"), state: tick(1) },
          {
            label: plural(state.accounts, "brokers.stepAccountsOne", "brokers.stepAccounts"),
            state: tick(2),
          },
          state.syncPending
            ? // Connecté, mais les trades n'ont pas pu être lus : on le dit.
              { label: t("brokers.stepTradesLater"), state: revealed >= 3 ? "warn" : "wait" }
            : {
                label: plural(
                  state.trades,
                  "brokers.stepTradesOne",
                  "brokers.stepTrades",
                  "brokers.stepTradesNone",
                ),
                state: tick(3),
              },
        ]
      : [];

  const finished = state.phase === "done" && revealed >= 4;
  const pending = state.phase === "done" && state.syncPending;

  return (
    <Modal
      open
      onClose={state.phase === "working" ? noop : onClose}
      closeOnBackdrop={state.phase !== "working"}
      labelledBy="sync-celebration-title"
      className="max-w-sm"
    >
      <div
        className="flex flex-col items-center px-6 py-7 text-center"
        role="status"
        aria-live="polite"
      >
        {state.phase === "failed" ? (
          <>
            <span className="grid h-14 w-14 place-items-center rounded-full border border-amber-500/25 bg-amber-500/10 text-amber-300">
              <TriangleAlert className="h-6 w-6" />
            </span>
            <h2 id="sync-celebration-title" className="tv-title mt-4">
              {t("brokers.failedTitle")}
            </h2>
            <p className="tv-prose mt-1.5 text-slate-400">{t(state.messageKey)}</p>
            <Button className="mt-5 w-full" onClick={onClose}>
              {t("brokers.done")}
            </Button>
          </>
        ) : (
          <>
            <Ring complete={finished} />
            <h2 id="sync-celebration-title" className="tv-title mt-4">
              {!finished
                ? t("brokers.syncingTitle")
                : pending
                  ? t("brokers.connectedTitle")
                  : t("brokers.allSynced")}
            </h2>

            <ul className="mt-4 w-full space-y-2 text-left">
              {state.phase === "working" ? (
                <StepRow label={t("brokers.stepConnected")} state="wait" />
              ) : (
                steps.map((s, i) =>
                  // Une étape n'apparaît qu'à son tour : la liste se construit
                  // sous les yeux du trader, dans l'ordre où le serveur a
                  // travaillé.
                  revealed >= i ? <StepRow key={i} label={s.label} state={s.state} /> : null,
                )
              )}
            </ul>

            {finished && (
              <div className="animate-fade-in-up mt-5 w-full space-y-2">
                <p className="tv-prose text-slate-400">
                  {pending ? t("brokers.firstSyncLater") : t("brokers.allSyncedBody")}
                </p>
                <div className="flex flex-col gap-2 pt-2">
                  {state.unmapped > 0 ? (
                    <Button className="w-full" onClick={onClose}>
                      {t("brokers.mapAccounts")}
                    </Button>
                  ) : (
                    <Button className="w-full" onClick={onOpenJournal}>
                      {t("brokers.openJournal")}
                    </Button>
                  )}
                  <Button variant="ghost" className="w-full" onClick={onClose}>
                    {t("brokers.done")}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

type StepState = "wait" | "ok" | "warn";

function StepRow({ label, state }: { label: string; state: StepState }) {
  const ok = state === "ok";
  return (
    <li className="animate-fade-in-up flex items-center gap-2.5 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-3 py-2.5">
      <span
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors",
          ok
            ? "border-[rgb(var(--tv-chart-green-rgb)/0.4)] bg-[rgb(var(--tv-chart-green-rgb)/0.12)] text-[var(--tv-chart-green)]"
            : state === "warn"
              ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
              : "border-[var(--tv-border-strong)] text-slate-500",
        )}
        aria-hidden
      >
        {ok ? (
          <svg viewBox="0 0 16 16" className="h-3 w-3">
            <path
              className="tv-fete-coche"
              d="M3.5 8.5 L6.5 11.5 L12.5 4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animationDelay: "0ms" }}
            />
          </svg>
        ) : state === "warn" ? (
          <TriangleAlert className="h-3 w-3" />
        ) : (
          <Loader2 className="h-3 w-3 animate-spin" />
        )}
      </span>
      <span className={cn("text-[13px] font-semibold", ok ? "text-slate-100" : "text-slate-400")}>
        {label}
      </span>
    </li>
  );
}

/** L'anneau : il tourne en attendant, puis se referme et se coche. */
function Ring({ complete }: { complete: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16" aria-hidden>
      <circle cx="32" cy="32" r="28" fill="none" stroke="var(--tv-border-strong)" strokeWidth="4" />
      {complete ? (
        <>
          <circle
            className="tv-fete-anneau"
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="var(--tv-chart-green)"
            strokeWidth="4"
            strokeLinecap="round"
            transform="rotate(-90 32 32)"
          />
          <path
            className="tv-fete-coche"
            d="M20 33.5 L28.5 42 L44 25"
            fill="none"
            stroke="var(--tv-chart-green)"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        // Un quart d'anneau qui tourne : le « ceci calcule » de la loi du
        // mouvement (`spin`), dessiné dans la forme qui va se refermer.
        <g className="origin-center animate-spin" style={{ transformBox: "fill-box" }}>
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="var(--tv-accent)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="44 176"
          />
        </g>
      )}
    </svg>
  );
}
