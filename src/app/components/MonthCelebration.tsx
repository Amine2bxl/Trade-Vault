import { useEffect } from "react";
import { useT } from "../i18n/LanguageContext";

/**
 * LA VALIDATION DU MOIS.
 *
 * Terminer les actions d'un mois du plan ne produisait qu'un TOAST — la même
 * bande grise, au même endroit, que « trade enregistré » ou « export terminé ».
 * Un jalon qu'on met quatre semaines à atteindre mérite d'être vu autrement que
 * l'accusé de réception d'un clic.
 *
 * ── CE QUE CE N'EST PAS ──
 * Ni confettis, ni feu d'artifice, ni son. Une coche qui SE DESSINE dans un
 * anneau qui se referme : le geste dit « bouclé », il dure une seconde et
 * demie, et il part tout seul. Rien à fermer, rien qui bloque la page.
 *
 * ── ACCESSIBILITÉ ──
 * `role="status"` : un lecteur d'écran annonce le texte sans que le focus
 * bouge. Et `prefers-reduced-motion` supprime le tracé — l'anneau et la coche
 * apparaissent d'un coup, la carte reste, le message aussi.
 */
export default function MonthCelebration({
  mois,
  total,
  onDone,
}: {
  /** Numéro du mois validé, 1-indexé. */
  mois: number;
  total: number;
  onDone: () => void;
}) {
  const { t } = useT();

  useEffect(() => {
    const id = setTimeout(onDone, 1900);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div
      role="status"
      aria-live="polite"
      /* `pointer-events-none` : la célébration ne doit jamais intercepter un
         clic. Le trader vient de cocher une case, il peut vouloir en cocher
         une autre pendant que ça joue. */
      className="pointer-events-none fixed inset-0 z-[90] grid place-items-center"
    >
      <div className="tv-fete glass-strong flex flex-col items-center gap-3 rounded-3xl px-8 py-7 shadow-[var(--tv-elev-3)]">
        <svg viewBox="0 0 64 64" className="h-16 w-16" aria-hidden="true">
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="rgb(255 255 255 / 0.08)"
            strokeWidth="4"
          />
          <circle
            className="tv-fete-anneau"
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="var(--tv-chart-green)"
            strokeWidth="4"
            strokeLinecap="round"
            transform="rotate(-90 32 32)"
          />
          <path
            className="tv-fete-coche"
            d="M20 33.5 L28.5 42 L44 25"
            fill="none"
            stroke="var(--tv-chart-green)"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="text-center">
          <div className="font-display text-base font-extrabold tracking-tight text-white">
            {t("goals.monthDone")}
          </div>
          <div className="tv-row-label mt-1">
            {t("goals.monthStep").replace("{i}", String(mois)).replace("{n}", String(total))}
          </div>
        </div>
      </div>
    </div>
  );
}
