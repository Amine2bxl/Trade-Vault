/**
 * ReplayTransition — LE FRANCHISSEMENT ENTRE LES DEUX MONDES.
 *
 * TradeVault a deux environnements étanches — le journal réel et le rejeu — et
 * passer de l'un à l'autre change le thème, la nature des données et ce qu'on
 * a le droit d'en conclure. Cette séquence est ce qui rend le franchissement
 * LISIBLE : sans elle, le produit changeait de couleur sous les yeux du trader
 * sans un mot, et il pouvait se croire dans son journal réel en lisant les
 * chiffres d'un backtest.
 *
 * Trois temps, les mêmes dans les deux sens :
 *
 *  • « loading » — le voile s'installe, opaque, pendant que la séance se
 *    prépare ;
 *  • « in » — il s'efface sur le monde du rejeu ;
 *  • « out » — il s'installe et se retire sur le journal réel.
 *
 * Le voile NOMME toujours le monde où l'on arrive, jamais celui qu'on quitte :
 * ce qui compte au moment de lever les yeux, c'est où l'on est.
 */

import { History, Wallet } from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import { useReplayMode } from "./ReplayModeContext";
import { timeframeLabel } from "@/modules/replay";

export default function ReplayTransition() {
  const { t } = useT();
  const { transition, pending } = useReplayMode();
  if (!transition) return null;

  const loading = transition === "loading";
  /** On ENTRE dans le rejeu (loading, in) ou on REVIENT au réel (out). */
  const toReplay = transition !== "out";

  // Le voile est opaque au chargement, s'efface à la révélation, s'installe à
  // la sortie.
  const animation =
    transition === "loading"
      ? "none"
      : transition === "in"
        ? "rt-overlay-out 1.5s ease forwards"
        : "rt-overlay-in 0.9s ease forwards";

  // En révélation (« in ») le voile s'efface : il ne doit pas bloquer les clics
  // sur le terminal qui apparaît derrière — c'était le cas, et on ne pouvait
  // plus ni zoomer ni passer d'ordres.
  const pointerEvents = transition === "in" ? "none" : "auto";

  const title = loading ? t("rt.loadingTitle") : toReplay ? t("env.toReplay") : t("env.toLive");
  /** La séance visée, quand on en prépare une — sinon le sens du monde. */
  const detail = [
    pending?.date,
    pending?.startTime,
    pending?.timeframe ? timeframeLabel(pending.timeframe) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const body = toReplay ? t("env.replayBody") : t("env.liveBody");

  const Icon = toReplay ? History : Wallet;

  return (
    <div
      className="fixed inset-0 z-[var(--tv-z-modal)] flex items-center justify-center"
      style={{ animation, pointerEvents }}
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-[var(--tv-bg)]" />
      {/* Halo discret qui respire — la seule lumière de l'écran. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(var(--tv-accent-rgb)/0.10),transparent_60%)]" />

      <div className="relative flex max-w-sm flex-col items-center gap-5 px-6 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl tv-accent-fill shadow-none">
          <Icon className="h-7 w-7 text-white" />
        </div>

        <div>
          <div className="tv-label text-[10px] text-[var(--tv-text-muted)]">
            {t(toReplay ? "env.replay" : "env.live")}
          </div>
          <div className="mt-1 text-lg font-bold text-[var(--tv-text)]">{title}</div>
          {loading && detail ? (
            <div className="mt-1 tv-figure text-xs text-[var(--tv-text-muted)]">{detail}</div>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-[var(--tv-text-muted)]">{body}</p>
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
