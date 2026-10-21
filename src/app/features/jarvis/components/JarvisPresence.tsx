import type { ReactNode } from "react";
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

/**
 * LA PRÉSENCE DE JARVIS — le cœur, ce qu'il fait, et les phases de préparation.
 *
 * Deux tailles, une seule source :
 *
 *   • `live` — la scène vocale : le cœur occupe l'écran, on PARLE à Jarvis.
 *   • `compact` — la conversation écrite. Le cœur central de 220px et ses
 *     bulles prenaient environ 300px AU-DESSUS du fil, en permanence : la
 *     discussion se lisait dans ce qui restait. Il vit maintenant dans une
 *     ligne de 44px posée sur le champ de saisie, là où l'œil revient après
 *     chaque message. Il respire sans jamais geler (`keepAlive`) : un cœur
 *     figé se lit comme un Jarvis éteint, et à 40px il ne coûte presque rien.
 *
 * Les bulles sont des phases visuelles, pas une trace de raisonnement : aucun
 * pourcentage ni coche de réussite ne simule une progression du serveur.
 */
export function JarvisPresence({
  mode,
  loading = false,
  elapsedMs = 0,
  live = false,
  compact = false,
  action,
}: {
  mode: JarvisMode;
  loading?: boolean;
  elapsedMs?: number;
  live?: boolean;
  compact?: boolean;
  /** Commande posée au bout de la ligne compacte (« afficher la réponse »). */
  action?: ReactNode;
}) {
  const { t } = useT();
  const state: JarvisOrbState = loading
    ? "thinking"
    : mode === "speaking" || mode === "writing"
      ? "speaking"
      : mode === "listening"
        ? "listening"
        : "idle";
  const busy = loading || mode === "writing" || mode === "speaking";
  return (
    <div
      className="jarvis-presence"
      data-live={live}
      data-compact={compact}
      data-loading={loading}
      data-busy={busy}
    >
      <JarvisNeural
        mode={mode}
        className="jarvis-presence-core"
        keepAlive={compact}
        fallback={<JarvisOrb state={state} size={compact ? 36 : 100} />}
      />
      <div className="jarvis-presence-body">
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
          <div className="jarvis-process animate-fade-in" title={t("jarvis.process.indicative")}>
            <ol className="jarvis-process-bubbles" aria-label={t("jarvis.process.label")}>
              {PHASES.map(({ mode: phase, Icon }) => (
                <li key={phase} className="jarvis-process-bubble" data-active={mode === phase}>
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{t(MODE_LABEL[phase])}</span>
                </li>
              ))}
            </ol>
            <div className="jarvis-process-caption">
              {!compact && <span>{t("jarvis.process.indicative")}</span>}
              {/* Le temps réel écoulé, jamais un délai promis. Le lecteur
                  d'écran reçoit l'état ; il n'entend pas chaque seconde. */}
              <span className="tv-figure" aria-hidden="true">
                {Math.floor(elapsedMs / 1000)} s
              </span>
            </div>
          </div>
        )}
      </div>
      {action && <div className="jarvis-presence-action">{action}</div>}
    </div>
  );
}
