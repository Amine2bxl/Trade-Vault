import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "./icons";

/** Small info affordance: a hoverable/focusable icon that reveals a plain-language
 *  explanation of a metric. Native `title` covers touch / no-hover as a fallback.
 *
 *  L'INFOBULLE N'EXISTE QUE QUAND ELLE EST AFFICHÉE, et en position fixe bornée à
 *  l'écran. Montée en permanence (opacité 0) et centrée sur l'icône, celle d'une
 *  case en bord droit dépassait de 71px de la colonne sur téléphone : invisible,
 *  mais rognée au survol et comptée dans la largeur de la page. */
export function InfoTip({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const w = 208;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
    setPos({ left, top: r.top - 8 });
  };
  const hide = () => setPos(null);
  return (
    <span
      ref={ref}
      className="relative inline-flex shrink-0 align-middle"
      tabIndex={0}
      title={text}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <Info className="w-3 h-3 text-slate-600 hover:text-slate-300 focus:text-slate-300 transition-colors cursor-help" />
      {pos &&
        createPortal(
          <span
            role="tooltip"
            style={{ left: pos.left, top: pos.top }}
            className="animate-fade-in pointer-events-none fixed z-[var(--tv-z-modal-top)] w-52 -translate-y-full rounded-xl border border-[var(--tv-border-strong)] bg-[var(--tv-plate-2)] px-3 py-2 text-[11px] font-normal normal-case leading-snug tracking-normal text-slate-300 shadow-[var(--tv-elev-2)]"
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}
