/**
 * ReplayTransition — la séquence d'entrée/sortie du mode rejeu.
 *
 * « loading » : voile immersif pendant que la séance se prépare (thème rejeu
 * déjà appliqué). « in » : révélation du terminal (le voile s'efface).
 * « out » : retour au TradeVault réel, thème d'origine restauré sous le voile.
 */

import { useT } from "../i18n/LanguageContext";
import { useReplayMode } from "./ReplayModeContext";
import { timeframeLabel } from "@/modules/replay";

export default function ReplayTransition() {
  const { t } = useT();
  const { transition, pending } = useReplayMode();
  if (!transition) return null;

  const loading = transition === "loading";
  const entering = transition !== "out";

  // Le voile est opaque au chargement, s'efface à la révélation, s'installe à
  // la sortie.
  const animation =
    transition === "loading"
      ? "none"
      : transition === "in"
        ? "rt-overlay-out 1.5s ease forwards"
        : "rt-overlay-in 0.9s ease forwards";

  const title = loading
    ? t("rt.loadingTitle")
    : entering
      ? t("rt.modeTitle")
      : t("rt.modeExitTitle");
  const subtitle = loading
    ? [
        pending?.date,
        pending?.startTime,
        pending?.timeframe ? timeframeLabel(pending.timeframe) : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : entering
      ? t("rt.modeEnter")
      : t("rt.modeExit");

  return (
    <div
      className="fixed inset-0 z-[var(--tv-z-modal)] flex items-center justify-center"
      style={{ animation }}
    >
      <div className="absolute inset-0 bg-[var(--tv-bg)]" />
      {/* Halo discret qui respire — la seule lumière de l'écran. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(var(--tv-accent-rgb)/0.10),transparent_60%)]" />

      <div className="relative flex flex-col items-center gap-5 px-6 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl tv-accent-fill shadow-none">
          <span className="text-2xl font-black tracking-tight text-white">NQ</span>
        </div>

        <div>
          <div className="text-lg font-bold text-[var(--tv-text)]">{title}</div>
          {subtitle && (
            <div className="mt-1 font-mono text-xs text-[var(--tv-text-muted)]">{subtitle}</div>
          )}
        </div>

        {/* Chargeur « bougies » — 5 mèches qui montent et descendent. */}
        {loading && (
          <div className="flex items-end gap-1.5" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="w-1.5 rounded-full tv-accent-fill"
                style={{
                  height: 22,
                  animation: `rt-candle 900ms ${i * 110}ms ease-in-out infinite`,
                }}
              />
            ))}
          </div>
        )}

        <div className="h-1 w-52 overflow-hidden rounded-full bg-[var(--tv-surface-3)]">
          <div
            className="h-full rounded-full tv-accent-fill"
            style={{
              animation: loading
                ? "rt-indeterminate 1.1s ease-in-out infinite"
                : "rt-fill 1.2s ease forwards",
            }}
          />
        </div>
      </div>
    </div>
  );
}
