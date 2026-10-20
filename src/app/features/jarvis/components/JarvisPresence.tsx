import { JarvisOrb, type JarvisOrbState } from "@/shared/ui";
import { JarvisNeural, type JarvisMode } from "@/shared/ui/JarvisNeural";
import { AudioLines, Brain, ScanLine, Sparkles } from "@/shared/ui/icons";
import { useT } from "@/app/i18n/LanguageContext";
import { MODE_LABEL } from "../neuralMode";

const PHASES = [
  { mode: "understanding", Icon: AudioLines },
  { mode: "analyzing", Icon: ScanLine },
  { mode: "thinking", Icon: Brain },
  { mode: "revising", Icon: Sparkles },
] as const;

/** Une présence centrale, partagée par le chat et la scène vocale.
 * Les bulles sont des phases visuelles, pas une trace de raisonnement : aucun
 * pourcentage ni coche de réussite ne simule une progression du serveur. */
export function JarvisPresence({
  mode,
  loading = false,
  elapsedMs = 0,
  live = false,
}: {
  mode: JarvisMode;
  loading?: boolean;
  elapsedMs?: number;
  live?: boolean;
}) {
  const { t } = useT();
  const state: JarvisOrbState = loading
    ? "thinking"
    : mode === "speaking" || mode === "writing"
      ? "speaking"
      : mode === "listening"
        ? "listening"
        : "idle";
  return (
    <div className="jarvis-presence" data-live={live} data-loading={loading}>
      <JarvisNeural
        mode={mode}
        className="jarvis-presence-core"
        fallback={<JarvisOrb state={state} size={100} />}
      />
      <p className="jarvis-presence-status" role="status" aria-live="polite">
        {t(MODE_LABEL[mode])}
        {loading && (
          <span className="jarvis-wait-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        )}
      </p>
      {loading && (
        <div className="jarvis-process animate-fade-in">
          <ol className="jarvis-process-bubbles" aria-label={t("jarvis.process.label")}>
            {PHASES.map(({ mode: phase, Icon }) => (
              <li key={phase} className="jarvis-process-bubble" data-active={mode === phase}>
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{t(MODE_LABEL[phase])}</span>
              </li>
            ))}
          </ol>
          <div className="jarvis-process-caption">
            <span>{t("jarvis.process.indicative")}</span>
            {/* Le temps réel écoulé, jamais un délai promis. Le lecteur
                d'écran reçoit l'état ; il n'entend pas chaque seconde. */}
            <span className="tv-figure" aria-hidden="true">
              {Math.floor(elapsedMs / 1000)} s
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
