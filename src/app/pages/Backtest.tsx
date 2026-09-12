/**
 * Backtest — le SEUIL du mode rejeu, pas le rejeu lui-même.
 *
 * Cette page ne contient plus le terminal. Elle présente le rejeu et propose
 * d'y entrer ; le terminal, lui, vit dans `ReplayStage`, par-dessus toute
 * l'application. La différence n'est pas cosmétique : rendre le terminal ICI
 * le laissait sous le rail de navigation, dans une boîte de 78 % de la hauteur,
 * et le changement de monde ne se lisait nulle part.
 *
 * Le pop-up ne s'ouvre plus tout seul à l'arrivée. On ne jette pas quelqu'un
 * dans un plein écran qu'il n'a pas demandé : la page se montre, et c'est le
 * clic qui fait basculer.
 */

import { CalendarClock, Play } from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import { usePageLock } from "../components/PremiumGate";
import { useReplayMode } from "../replay/ReplayModeContext";

export default function Backtest() {
  const { t } = useT();
  const licked = usePageLock("backtest");
  const { session, openLaunch } = useReplayMode();

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

  // `minHeight` et non `height` : une CIBLE (« occupe la page »), jamais un
  // plafond qui écraserait la carte sur un écran court.
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <button
        type="button"
        onClick={openLaunch}
        className="group flex flex-col items-center gap-3 rounded-3xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-10 py-12 transition hover:border-[var(--tv-accent)]/50"
      >
        <div className="grid h-14 w-14 place-items-center rounded-2xl tv-accent-fill transition group-hover:scale-105">
          <Play className="ml-0.5 h-6 w-6 text-white" />
        </div>
        <div className="text-sm font-bold text-[var(--tv-text)]">NQ · Historical Replay</div>
        <div className="text-xs text-[var(--tv-text-muted)]">
          {session.active ? t("rt.backToTerminal") : t("rt.previewCta")}
        </div>
      </button>
    </div>
  );
}
