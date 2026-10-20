import type { JarvisMode } from "@/shared/ui/JarvisNeural";
import { JarvisPresence } from "./JarvisPresence";

/**
 * JARVIS LIVE — la scène de la conversation vocale.
 *
 * Quand on PARLE à Jarvis, le fil écrit n'est plus l'objet de l'écran : on ne
 * lit pas un appel. La scène prend la place du fil — le cœur neuronal au
 * centre, ce qu'il fait en un mot, et la dernière phrase dite en sous-titre.
 * Les commandes restent dans la barre vocale, en bas, au même endroit que le
 * champ de saisie. Le fil continue de s'écrire derrière : en quittant le mode
 * vocal, la conversation est complète.
 */
export function LiveStage({
  mode,
  subtitle,
  loading,
  elapsedMs,
}: {
  mode: JarvisMode;
  subtitle: string;
  loading: boolean;
  elapsedMs: number;
}) {
  return (
    <div className="jarvis-live animate-fade-in">
      <JarvisPresence mode={mode} loading={loading} elapsedMs={elapsedMs} live />
      {subtitle && <p className="jarvis-live-text">{subtitle}</p>}
    </div>
  );
}
