/**
 * ReplayOrderBar — LA BARRE D'EXÉCUTION.
 *
 * Le geste le plus fréquent d'un terminal — passer un ordre au marché — vivait
 * dans un panneau latéral masqué sous 1024 px, derrière un formulaire à six
 * champs. Sur une plateforme de trading, ce geste tient en un bouton, toujours
 * visible, qui dit exactement ce qu'il va faire : « ACHAT +2 @ MARCHÉ ».
 *
 * D'où cette barre, calquée sur la disposition des terminaux de prop firm :
 *
 *   [− 1 3 5 10 15 +]   [ACHAT +n @ MARCHÉ]  [VENTE −n @ MARCHÉ]
 *   [TOUT FERMER]  [RETOURNER]  [TOUT ANNULER]
 *
 * Trois choix portent le reste :
 *
 *  • LA QUANTITÉ EST DANS LE BOUTON, pas ailleurs. Un bouton « ACHAT » dont la
 *    taille se règle à l'autre bout de l'écran est un piège : on clique en
 *    croyant en prendre un, on en prend dix.
 *  • LES TROIS GESTES D'URGENCE SONT SÉPARÉS du reste et TEINTÉS, parce qu'ils
 *    détruisent quelque chose. Ils demandent confirmation.
 *  • RIEN N'EST CLIQUABLE SANS EFFET. Sans position ouverte, « tout fermer »
 *    et « retourner » sont éteints ; sans ordre en carnet, « tout annuler »
 *    l'est aussi. Un bouton actif qui ne fait rien fait douter de tous les
 *    autres.
 */

import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";

/** Les paliers de quantité d'un clic — ceux des terminaux de prop firm. */
const QTY_PRESETS = [1, 3, 5, 10, 15];

export interface OrderBarProps {
  qty: number;
  setQty: (n: number) => void;
  /** Positions ouvertes / ordres en carnet — ce qui arme les gestes d'urgence. */
  openPositions: number;
  workingOrders: number;
  onBuy: () => void;
  onSell: () => void;
  onFlatten: () => void;
  onReverse: () => void;
  onCancelAll: () => void;
  /** Le marché est-il lisible ? Sans prix marqué, aucun ordre ne part. */
  ready: boolean;
}

function DangerButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex-1 rounded-md border px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide transition",
        disabled
          ? "cursor-not-allowed border-[var(--tv-border)] text-[var(--tv-text-muted)] opacity-40"
          : "border-[var(--tv-border-strong)] text-[var(--tv-text-secondary)] hover:border-[var(--tv-danger)]/60 hover:text-[var(--tv-danger)]",
      )}
    >
      {label}
    </button>
  );
}

export default function ReplayOrderBar({
  qty,
  setQty,
  openPositions,
  workingOrders,
  onBuy,
  onSell,
  onFlatten,
  onReverse,
  onCancelAll,
  ready,
}: OrderBarProps) {
  const { t } = useT();
  const n = Math.max(1, Math.round(qty || 1));

  return (
    <div className="flex shrink-0 flex-col gap-1.5 border-t border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-2 py-2">
      {/* Quantité */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setQty(Math.max(1, n - 1))}
          aria-label={t("rt.qtyMinus")}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[var(--tv-border)] text-[var(--tv-text-muted)] transition hover:text-[var(--tv-text)]"
        >
          −
        </button>
        {QTY_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setQty(p)}
            aria-pressed={n === p}
            className={cn(
              "tv-figure h-6 flex-1 rounded-md text-[11px] font-bold transition",
              n === p
                ? "bg-[var(--tv-surface-hover)] text-[var(--tv-text)]"
                : "text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]",
            )}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setQty(n + 1)}
          aria-label={t("rt.qtyPlus")}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[var(--tv-border)] text-[var(--tv-text-muted)] transition hover:text-[var(--tv-text)]"
        >
          +
        </button>
      </div>

      {/* Exécution — le bouton PORTE la quantité. */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onBuy}
          disabled={!ready}
          className="flex-1 rounded-md bg-[var(--tv-chart-green)] px-2 py-2 text-[11px] font-black tracking-wide text-[#04121c] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("rt.buyMarket").replace("{n}", String(n))}
        </button>
        <button
          type="button"
          onClick={onSell}
          disabled={!ready}
          className="flex-1 rounded-md bg-[var(--tv-chart-red)] px-2 py-2 text-[11px] font-black tracking-wide text-[#1c0404] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("rt.sellMarket").replace("{n}", String(n))}
        </button>
      </div>

      {/* Les trois gestes d'urgence. */}
      <div className="flex items-center gap-1.5">
        <DangerButton
          label={t("rt.flattenAll")}
          onClick={onFlatten}
          disabled={openPositions === 0}
        />
        <DangerButton
          label={t("rt.reversePosition")}
          onClick={onReverse}
          disabled={openPositions === 0}
        />
        <DangerButton
          label={t("rt.cancelAll")}
          onClick={onCancelAll}
          disabled={workingOrders === 0}
        />
      </div>
    </div>
  );
}
