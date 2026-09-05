import { useLayoutEffect, useRef } from "react";
import { ArrowUp, Mic, MicOff } from "lucide-react";
import { useT } from "../../i18n/LanguageContext";
import { cn } from "../../utils/cn";

/**
 * LE CHAMP DE DISCUSSION.
 *
 * ══ CE QU'IL REMPLACE ══
 *
 * `MorphingInput` : un `<input>` d'UNE SEULE LIGNE, précédé d'un bouton qui
 * faisait tourner un placeholder animé lettre par lettre, en anglais codé en
 * dur, avec une animation `rotateX` + `blur` sur chaque caractère.
 *
 * Trois choses ne vont pas là-dedans, et elles se voient toutes à l'usage :
 *
 *   • UNE SEULE LIGNE. On écrit à un coach « j'ai pris trois trades hier
 *     après une perte, j'ai augmenté la taille et je ne comprends pas
 *     pourquoi » : dans un champ d'une ligne, on ne relit jamais ce qu'on
 *     vient d'écrire. Le champ grandit maintenant avec le texte, jusqu'à huit
 *     lignes, puis défile.
 *   • ENTRÉE ENVOYAIT, ET RIEN NE PERMETTAIT D'ALLER À LA LIGNE. Maj+Entrée
 *     le fait ; c'est la convention de tous les assistants, et l'indication
 *     est écrite sous le champ.
 *   • LE BOUTON QUI FAIT TOURNER LE PLACEHOLDER. Une cible de 40px, à gauche
 *     du champ, dont l'unique effet est de changer un texte gris que
 *     l'utilisateur va effacer en tapant. Il occupait la place du micro.
 *
 * ══ CE QUI EST GARDÉ ══
 *
 * Le micro — la dictée est le vrai raccourci d'un journal de trading, on parle
 * plus vite qu'on ne tape après une séance — et l'envoi, qui ne s'allume que
 * lorsqu'il y a quelque chose à envoyer.
 */
export default function Composer({
  value,
  onChange,
  onSubmit,
  disabled,
  listening,
  onMic,
  micAvailable,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  listening?: boolean;
  onMic?: () => void;
  micAvailable?: boolean;
}) {
  const { t } = useT();
  const ref = useRef<HTMLTextAreaElement | null>(null);

  /* LA HAUTEUR SUIT LE TEXTE.
     `useLayoutEffect` et non `useEffect` : la mesure doit tomber avant la
     peinture, sinon le champ affiche une frame à l'ancienne hauteur et le
     texte « saute » à chaque retour à la ligne. On remet `auto` avant de lire
     `scrollHeight`, sinon la hauteur ne redescend jamais quand on efface. */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 8 * 24)}px`;
  }, [value]);

  const pret = !disabled && value.trim().length > 0;

  return (
    <div>
      <div
        className={cn(
          "flex items-end gap-1.5 rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] p-1.5 transition",
          "focus-within:border-[var(--tv-border-accent)] focus-within:ring-2 focus-within:ring-[rgb(var(--tv-accent-rgb)/0.16)]",
        )}
      >
        {micAvailable && onMic && (
          <button
            type="button"
            onClick={onMic}
            aria-label={t("common.voiceInput")}
            aria-pressed={!!listening}
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors",
              listening
                ? "bg-red-500/15 text-red-400"
                : "text-slate-400 hover:bg-white/[0.07] hover:text-white",
            )}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        )}

        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // Entrée envoie ; Maj+Entrée va à la ligne. La composition IME
            // (japonais, chinois) valide aussi avec Entrée : envoyer pendant
            // qu'elle est en cours couperait le mot en train d'être composé.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (pret) onSubmit();
            }
          }}
          disabled={disabled}
          placeholder={t("jarvis.composerPlaceholder")}
          aria-label={t("assistant.title")}
          className="min-h-9 min-w-0 flex-1 resize-none bg-transparent px-1.5 py-2 text-sm leading-6 text-white outline-none placeholder:text-slate-600 disabled:opacity-50"
        />

        <button
          type="button"
          onClick={() => pret && onSubmit()}
          disabled={!pret}
          aria-label={t("jarvis.send")}
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-xl transition",
            pret
              ? "tv-accent-fill active:scale-95"
              : "cursor-not-allowed bg-white/[0.05] text-slate-600",
          )}
        >
          <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>

      <p className="tv-hint mt-1.5 px-1">{t("jarvis.composerHint")}</p>
    </div>
  );
}
