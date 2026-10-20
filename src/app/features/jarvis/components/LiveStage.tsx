import { JarvisNeural, type JarvisMode } from "@/shared/ui/JarvisNeural";
import { JarvisOrb } from "@/shared/ui";
import { useT } from "@/app/i18n/LanguageContext";
import { MODE_LABEL } from "../neuralMode";

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
export function LiveStage({ mode, subtitle }: { mode: JarvisMode; subtitle: string }) {
  const { t } = useT();
  return (
    <div className="jarvis-live animate-fade-in" aria-live="polite">
      <JarvisNeural
        mode={mode}
        className="jarvis-live-core"
        label={t(MODE_LABEL[mode])}
        fallback={<JarvisOrb state={mode === "speaking" ? "speaking" : "listening"} size={120} />}
      />
      <p className="jarvis-live-status tv-label">{t(MODE_LABEL[mode])}</p>
      {subtitle && <p className="jarvis-live-text">{subtitle}</p>}
    </div>
  );
}
