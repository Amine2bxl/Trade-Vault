/**
 * ReplayTicket — la salle des marchés du terminal.
 *
 * Entrée au marché / limite / stop, avec quantité et bracket posé dans le même
 * geste. Le R:R se calcule en direct, ticks et points compris — déplacer un
 * prix (ou le bracket, sur le graphe) met tout à jour immédiatement.
 */

import { useMemo, useState } from "react";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import { NQ, roundToTick, tickValueDollars, pointsDollars } from "@/modules/replay";

type Side = "long" | "short";
type OrderType = "market" | "limit" | "stop";

interface Props {
  price: number | null;
  onPlace: (input: {
    side: Side;
    type: OrderType;
    qty: number;
    price?: number;
    sl?: number;
    tp?: number;
  }) => void;
}

export default function ReplayTicket({ price, onPlace }: Props) {
  const { t } = useT();
  const [side, setSide] = useState<Side>("long");
  const [type, setType] = useState<OrderType>("market");
  const [qty, setQty] = useState(1);
  const [limit, setLimit] = useState<string>("");
  const [sl, setSl] = useState<string>("");
  const [tp, setTp] = useState<string>("");

  const tick = NQ.tickSize;
  const mark = price ?? 0;

  const limitNumber = type === "market" ? mark : Number(limit);
  const slNumber = sl ? Number(sl) : null;
  const tpNumber = tp ? Number(tp) : null;

  const rr = useMemo(() => {
    if (!slNumber && !tpNumber) return null;
    const entryVal = limitNumber || mark;
    const riskPts = slNumber ? Math.abs(entryVal - slNumber) : 0;
    const rewPts = tpNumber ? Math.abs(tpNumber - entryVal) : 0;
    if (riskPts <= 0) return null;
    return { rr: rewPts / riskPts, riskPts, rewPts };
  }, [slNumber, tpNumber, limitNumber, mark]);

  const submit = () => {
    const base = { side, type, qty: Math.max(1, Math.round(qty || 1)) };
    onPlace({
      ...base,
      price: type === "market" ? undefined : roundToTick(Number(limit) || 0, NQ),
      sl: slNumber != null ? roundToTick(slNumber, NQ) : undefined,
      tp: tpNumber != null ? roundToTick(tpNumber, NQ) : undefined,
    });
  };

  const bump = (setter: (v: string) => void, current: string, dTick: number) =>
    setter(
      current
        ? String(roundToTick(Number(current) + dTick * tick, NQ))
        : String(roundToTick(mark + dTick * tick, NQ)),
    );

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Buy / Sell */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setSide("long")}
          className={cn(
            "rounded-xl py-2.5 text-sm font-bold transition",
            side === "long"
              ? "bg-[var(--tv-chart-green)] text-[#04121c]"
              : "border border-[var(--tv-border)] bg-[var(--tv-plate-1)] text-[var(--tv-text-muted)]",
          )}
        >
          {t("rt.buy")} · {t("rt.long")}
        </button>
        <button
          type="button"
          onClick={() => setSide("short")}
          className={cn(
            "rounded-xl py-2.5 text-sm font-bold transition",
            side === "short"
              ? "bg-[var(--tv-chart-red)] text-[#04121c]"
              : "border border-[var(--tv-border)] bg-[var(--tv-plate-1)] text-[var(--tv-text-muted)]",
          )}
        >
          {t("rt.sell")} · {t("rt.short")}
        </button>
      </div>

      {/* Type */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--tv-plate-1)] p-1">
        {(["market", "limit", "stop"] as const).map((ty) => (
          <button
            key={ty}
            type="button"
            onClick={() => setType(ty)}
            className={cn(
              "rounded-lg py-1.5 text-xs font-semibold transition",
              type === ty
                ? "bg-[var(--tv-surface-hover)] text-[var(--tv-text)]"
                : "text-[var(--tv-text-muted)]",
            )}
          >
            {ty === "market" ? t("rt.market") : ty === "limit" ? t("rt.limit") : t("rt.stop")}
          </button>
        ))}
      </div>

      {/* Quantité */}
      <label className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-[var(--tv-text-muted)]">{t("rt.qty")}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--tv-border)] text-sm"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="w-14 rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-2 py-1 text-center font-mono text-sm text-[var(--tv-text)] outline-none"
          />
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--tv-border)] text-sm"
          >
            +
          </button>
        </div>
      </label>

      {type !== "market" && (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-[var(--tv-text-muted)]">
            {type === "limit" ? t("rt.limit") : t("rt.stop")} {t("rt.mark")}
          </span>
          <input
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder={mark ? mark.toFixed(2) : "0.00"}
            inputMode="decimal"
            className="rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-3 py-2 font-mono text-sm text-[var(--tv-text)] outline-none focus:border-[var(--tv-accent)]"
          />
        </label>
      )}

      {/* Bracket */}
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-[var(--tv-chart-red)]">{t("rt.sl")}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => bump(setSl, sl, -5)}
              className="px-1 text-xs text-[var(--tv-text-muted)]"
            >
              −5
            </button>
            <input
              value={sl}
              onChange={(e) => setSl(e.target.value)}
              placeholder="—"
              inputMode="decimal"
              className="min-w-0 flex-1 rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-2 py-1.5 font-mono text-xs text-[var(--tv-text)] outline-none"
            />
            <button
              type="button"
              onClick={() => bump(setSl, sl, 5)}
              className="px-1 text-xs text-[var(--tv-text-muted)]"
            >
              +5
            </button>
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-[var(--tv-chart-green)]">{t("rt.tp")}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => bump(setTp, tp, -5)}
              className="px-1 text-xs text-[var(--tv-text-muted)]"
            >
              −5
            </button>
            <input
              value={tp}
              onChange={(e) => setTp(e.target.value)}
              placeholder="—"
              inputMode="decimal"
              className="min-w-0 flex-1 rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-2 py-1.5 font-mono text-xs text-[var(--tv-text)] outline-none"
            />
            <button
              type="button"
              onClick={() => bump(setTp, tp, 5)}
              className="px-1 text-xs text-[var(--tv-text-muted)]"
            >
              +5
            </button>
          </div>
        </label>
      </div>

      {/* R:R */}
      {rr && (
        <div className="flex items-center justify-between rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-3 py-2 text-[11px] text-[var(--tv-text-muted)]">
          <span>
            R <span className="font-bold text-[var(--tv-text)]">{rr.rr.toFixed(2)}</span>
          </span>
          <span>
            Risque{" "}
            <span className="font-mono font-semibold text-[var(--tv-text)]">
              {pointsDollars(rr.riskPts, qty).toFixed(0)} $
            </span>
          </span>
          <span>
            Récomp.{" "}
            <span className="font-mono font-semibold text-[var(--tv-text)]">
              {pointsDollars(rr.rewPts, qty).toFixed(0)} $
            </span>
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        className={cn(
          "rounded-xl py-2.5 text-sm font-bold text-[#04121c] transition disabled:opacity-40",
          side === "long" ? "bg-[var(--tv-chart-green)]" : "bg-[var(--tv-chart-red)]",
        )}
      >
        {side === "long" ? `${t("rt.buy")} ${qty || 1} NQ` : `${t("rt.sell")} ${qty || 1} NQ`}
      </button>

      <p className="text-center text-[10px] leading-relaxed text-[var(--tv-text-muted)]">
        1 tick = {tickValueDollars(1).toFixed(2)} $ · 1 point = {pointsDollars(1, 1).toFixed(0)} $ ·
        commissions incluses au remplissage
      </p>
    </div>
  );
}
