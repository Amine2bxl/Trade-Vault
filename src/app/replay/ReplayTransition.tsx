/**
 * ReplayTransition — la confirmation visuelle d'entrée/sortie du mode rejeu.
 *
 * Un fondu discret par-dessus l'application : au centre, la marque du rejeu et
 * une ligne de progression. Arrivée = le trader est DANS le terminal ; retour =
 * il est revenu dans le TradeVault réel. Court, propre, sans saturation.
 */

import { useT } from "../i18n/LanguageContext";
import { useReplayMode } from "./ReplayModeContext";

export default function ReplayTransition() {
  const { t } = useT();
  const { transition } = useReplayMode();
  if (!transition) return null;
  const entering = transition === "in";

  return (
    <div
      className="fixed inset-0 z-[var(--tv-z-modal)] flex items-center justify-center"
      style={{
        animation: entering ? "rt-fade-in 1.4s ease forwards" : "rt-fade-out 1.1s ease forwards",
      }}
    >
      <div className="absolute inset-0 bg-[var(--tv-bg)]" />
      <div className="relative flex flex-col items-center gap-4 px-6 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl tv-accent-fill">
          <span className="text-2xl font-black text-white">NQ</span>
        </div>
        <div>
          <div className="text-lg font-bold text-[var(--tv-text)]">
            {entering ? t("rt.modeTitle") : t("rt.modeExitTitle")}
          </div>
          <div className="mt-1 text-xs text-[var(--tv-text-muted)]">
            {entering ? t("rt.modeEnter") : t("rt.modeExit")}
          </div>
        </div>
        <div className="h-1 w-44 overflow-hidden rounded-full bg-[var(--tv-surface-3)]">
          <div
            className="h-full rounded-full tv-accent-fill"
            style={{ animation: "rt-progress 1.2s ease forwards" }}
          />
        </div>
      </div>
    </div>
  );
}

/* Animations — nommées pour être réutilisables et overridées par le thème. */
