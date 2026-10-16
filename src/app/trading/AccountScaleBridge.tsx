import { ArrowRight } from "lucide-react";
import { cn } from "@/shared/ui";
import { formatMoney } from "@/shared/currency";
import { fmtFactor } from "./accountCalibration";

/**
 * LE PONT D'ÉCHELLE — « d'où, vers où, à quel facteur », en une ligne.
 *
 * Le transfert entre comptes et le recalibrage posent la même question au
 * trader : ses montants vont changer d'échelle, de combien ? Les deux écrans la
 * montraient chacun à sa façon (un champ « × » nu d'un côté, une phrase de
 * l'autre). Un seul dessin, partagé, se lit avant d'être compris : le compte de
 * départ, le facteur sur la flèche, le compte d'arrivée.
 *
 * Purement visuel : le facteur vient de l'appelant (`defaultTransferFactor`,
 * `factorFor`), jamais recalculé ici — une seule source de vérité.
 */
export function AccountScaleBridge({
  from,
  to,
  factor,
  className,
}: {
  from: { label: string; name: string; balance: number };
  to: { label: string; name: string; balance: number };
  /** `1` = aucune conversion : la flèche le dit au lieu d'afficher « ×1 ». */
  factor: number;
  className?: string;
}) {
  const scaled = Math.abs(factor - 1) > 1e-9;
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2",
        className,
      )}
    >
      <Side {...from} />
      <div className="flex flex-col items-center gap-1 px-1" aria-hidden>
        <span
          className={cn(
            "tv-figure rounded-md border px-1.5 py-0.5 text-[12px] font-bold",
            scaled
              ? "border-[var(--tv-border-accent)] bg-[rgb(var(--tv-accent-rgb)/0.1)] text-[var(--tv-accent)]"
              : "border-[var(--tv-border)] text-slate-500",
          )}
        >
          ×{fmtFactor(factor)}
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
      </div>
      <Side {...to} accent />
    </div>
  );
}

function Side({
  label,
  name,
  balance,
  accent,
}: {
  label: string;
  name: string;
  balance: number;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border px-3 py-2.5",
        accent
          ? "border-[var(--tv-border-strong)] bg-[var(--tv-plate-2)]"
          : "border-[var(--tv-border)] bg-[var(--tv-plate-1)]",
      )}
    >
      <div className="tv-label truncate text-slate-500">{label}</div>
      <div className="mt-0.5 truncate text-[13px] font-semibold text-slate-100">{name}</div>
      <div className="tv-figure truncate text-[15px] text-white">
        {formatMoney(balance, { whole: true })}
      </div>
    </div>
  );
}
