import { JarvisOrb, type JarvisOrbState } from "@/shared/ui";
import { useT } from "@/app/i18n/LanguageContext";

/**
 * LA BARRE VOCALE — ce qui remplace le champ de saisie pendant une
 * conversation à voix haute.
 *
 * Un seul objet à regarder : l'orbe, qui dit déjà si Jarvis écoute, réfléchit
 * ou parle. À côté, l'état en un mot et ce que le trader est en train de dire
 * — la transcription provisoire est la seule preuve qu'il est bien entendu,
 * et la voir s'écrire évite de répéter une question mal comprise.
 *
 * L'orbe est un bouton : pendant l'écoute, elle envoie tout de suite ce qui a
 * été dit ; pendant que Jarvis parle, elle l'interrompt (on coupe la parole à
 * un coach, pas à un répondeur).
 */
export function VoiceBar({
  state,
  interim,
  onOrb,
  onEnd,
}: {
  state: JarvisOrbState;
  interim: string;
  onOrb: () => void;
  onEnd: () => void;
}) {
  const { t } = useT();
  const status =
    state === "speaking"
      ? t("jarvis.voice.speaking")
      : state === "thinking"
        ? t("jarvis.voice.thinking")
        : t("jarvis.voice.listening");
  const orbLabel =
    state === "speaking"
      ? t("jarvis.voice.orbInterrupt")
      : state === "listening"
        ? t("jarvis.voice.orbSend")
        : status;
  return (
    <div
      className="jarvis-voicebar animate-fade-in"
      role="group"
      aria-label={t("jarvis.voice.start")}
    >
      <button
        type="button"
        onClick={onOrb}
        disabled={state === "thinking"}
        aria-label={orbLabel}
        title={orbLabel}
        className="jarvis-voicebar-orb"
      >
        <JarvisOrb state={state} size={40} />
      </button>
      <div className="min-w-0 flex-1" aria-live="polite">
        <p className="tv-label text-[var(--tv-highlight)]">{status}</p>
        <p className="jarvis-voicebar-text">{interim || t("jarvis.voice.hint")}</p>
      </div>
      <button type="button" onClick={onEnd} className="jarvis-voicebar-end">
        {t("jarvis.voice.end")}
      </button>
    </div>
  );
}
