/**
 * ReplayTicket — la salle des marchés du terminal.
 *
 * Entrée au marché / limite / stop, avec quantité et bracket posé dans le même
 * geste. Le R:R se calcule en direct, ticks et points compris — déplacer un
 * prix (ou le bracket, sur le graphe) met tout à jour immédiatement.
 *
 * La disposition suit celle des plateformes de trading : contrat et cotation en
 * tête, type d'ordre, paliers de quantité, puis DEUX boutons d'exécution qui
 * portent chacun leur sens. Le couple « sélecteur de sens + bouton d'envoi »
 * demandait deux gestes et un état à vérifier avant de cliquer.
 */

import { useMemo, useState } from "react";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import {
  instrumentOf,
  roundToTick,
  tickValueDollars,
  pointsDollars,
  sizeFromRisk,
  riskOfSize,
  riskPctOfSize,
} from "@/modules/replay";

type Side = "long" | "short";
type OrderType = "market" | "limit" | "stop";

interface Props {
  price: number | null;
  /** Capital de référence du dimensionnement — l'equity courante. */
  balance: number;
  /** Symbole de la séance : le spec vient du registre, jamais d'une constante. */
  symbol: string;
  commissionPerContract: number;
  onPlace: (input: {
    side: Side;
    type: OrderType;
    qty: number;
    price?: number;
    sl?: number;
    tp?: number;
  }) => void;
}

export default function ReplayTicket({
  price,
  balance,
  symbol,
  commissionPerContract,
  onPlace,
}: Props) {
  const { t } = useT();
  const [type, setType] = useState<OrderType>("market");
  const [qty, setQty] = useState(1);
  const [limit, setLimit] = useState<string>("");
  const [sl, setSl] = useState<string>("");
  const [tp, setTp] = useState<string>("");

  const [riskPct, setRiskPct] = useState<string>("");
  /** Le bracket part-il avec l'ordre ? Éteint, stop et objectif sont ignorés. */
  const [bracketOn, setBracketOn] = useState(true);
  const spec = useMemo(() => instrumentOf(symbol), [symbol]);
  const tick = spec.tickSize;
  const mark = price ?? 0;

  const limitNumber = type === "market" ? mark : Number(limit);
  // Éteint, le bracket n'existe pas : ni pour l'ordre envoyé, ni pour le R:R,
  // ni pour le dimensionnement. Un seul interrupteur, une seule vérité.
  const slNumber = bracketOn && sl ? Number(sl) : null;
  const tpNumber = bracketOn && tp ? Number(tp) : null;

  const rr = useMemo(() => {
    if (!slNumber && !tpNumber) return null;
    const entryVal = limitNumber || mark;
    const riskPts = slNumber ? Math.abs(entryVal - slNumber) : 0;
    const rewPts = tpNumber ? Math.abs(tpNumber - entryVal) : 0;
    if (riskPts <= 0) return null;
    return { rr: rewPts / riskPts, riskPts, rewPts };
  }, [slNumber, tpNumber, limitNumber, mark]);

  // Le prix d'entrée de référence : la limite saisie, ou le marché.
  const entryRef = limitNumber || mark;

  /** Ce que l'ordre courant risque réellement, tel qu'il est composé. */
  const currentRisk = useMemo(() => {
    if (slNumber == null || !entryRef) return null;
    return {
      dollars: riskOfSize(qty, entryRef, slNumber, spec, commissionPerContract),
      pct: riskPctOfSize(qty, entryRef, slNumber, balance, spec, commissionPerContract),
    };
  }, [qty, entryRef, slNumber, balance, spec, commissionPerContract]);

  /** La taille qu'autoriserait le budget de risque saisi. */
  const sizing = useMemo(() => {
    const pct = Number(riskPct);
    if (slNumber == null || !entryRef || !pct) return null;
    return sizeFromRisk({
      balance,
      riskPct: pct,
      entry: entryRef,
      stop: slNumber,
      spec,
      commissionPerContract,
    });
  }, [riskPct, slNumber, entryRef, balance, spec, commissionPerContract]);

  /**
   * Le SENS est porté par le bouton, pas par un sélecteur en amont.
   *
   * Il fallait auparavant choisir « Acheter » en haut, puis appuyer sur un
   * bouton d'envoi en bas : deux gestes, et un état à vérifier avant de
   * cliquer. Les plateformes de trading — Project X compris — donnent deux
   * boutons qui font ce qu'ils disent. Un clic, aucune ambiguïté sur le sens.
   */
  const submit = (s: Side) => {
    onPlace({
      side: s,
      type,
      qty: Math.max(1, Math.round(qty || 1)),
      price: type === "market" ? undefined : roundToTick(Number(limit) || 0, spec),
      sl: slNumber != null ? roundToTick(slNumber, spec) : undefined,
      tp: tpNumber != null ? roundToTick(tpNumber, spec) : undefined,
    });
  };

  /** Les paliers de quantité usuels, à un clic — comme sur Project X. */
  const QTY_PRESETS = [1, 2, 3, 5, 10, 15];

  /**
   * Une cotation DÉDUITE, pas un carnet.
   *
   * Le rejeu ne dispose que d'OHLC : il n'existe aucune profondeur de marché à
   * afficher. On encadre donc le prix marqué d'un demi-tick de chaque côté —
   * ce qui donne le spread d'un tick, celui du NQ en séance. Le jour où des
   * données tick arriveront, c'est ici que le vrai bid/ask se branchera.
   */
  const bidAsk = {
    bid: roundToTick(mark - tick / 2, spec),
    ask: roundToTick(mark + tick / 2, spec),
  };

  const bump = (setter: (v: string) => void, current: string, dTick: number) =>
    setter(
      current
        ? String(roundToTick(Number(current) + dTick * tick, spec))
        : String(roundToTick(mark + dTick * tick, spec)),
    );

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Contrat — ce qu'on trade, affiché avant comment on le trade. */}
      <div className="flex items-center justify-between rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-3 py-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-[var(--tv-text-muted)]">
            {t("rt.contract")}
          </div>
          <div className="truncate text-sm font-bold text-[var(--tv-text)]">{spec.symbol}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-[var(--tv-text-muted)]">
            {t("rt.bidAsk")}
          </div>
          <div className="tv-figure text-xs font-semibold">
            <span className="text-[var(--tv-chart-red)]">{bidAsk.bid.toFixed(2)}</span>
            <span className="mx-1 text-[var(--tv-text-muted)]">/</span>
            <span className="text-[var(--tv-chart-green)]">{bidAsk.ask.toFixed(2)}</span>
          </div>
        </div>
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

      {/* Paliers de quantité — un clic, pas six sur « + ». */}
      <div className="flex flex-wrap gap-1">
        {QTY_PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setQty(n)}
            className={cn(
              "min-w-8 rounded-lg px-2 py-1 text-xs font-bold transition",
              qty === n
                ? "tv-accent-fill text-white"
                : "border border-[var(--tv-border)] bg-[var(--tv-plate-1)] text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]",
            )}
          >
            {n}
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
            className="w-14 rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-2 py-1 text-center tv-figure text-sm text-[var(--tv-text)] outline-none"
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
            className="rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-3 py-2 tv-figure text-sm text-[var(--tv-text)] outline-none focus:border-[var(--tv-accent)]"
          />
        </label>
      )}

      {/* Bracket — interrupteur AVANT les champs : c'est lui qui décide si le
        stop et l'objectif partent avec l'ordre. Les laisser saisis mais
        inertes, sans le dire, serait le pire des deux mondes. */}
      <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-3 py-2">
        <span className="text-[11px] font-medium text-[var(--tv-text-muted)]">
          {t("rt.positionBracket")}
        </span>
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "text-[11px] font-bold",
              bracketOn ? "text-[var(--tv-accent)]" : "text-[var(--tv-text-muted)]",
            )}
          >
            {bracketOn ? t("rt.enabled") : t("rt.disabled")}
          </span>
          <input
            type="checkbox"
            checked={bracketOn}
            onChange={(e) => setBracketOn(e.target.checked)}
            className="h-4 w-4 accent-[var(--tv-accent)]"
          />
        </span>
      </label>

      {/* Bracket */}
      <div className={cn("grid grid-cols-2 gap-2", !bracketOn && "pointer-events-none opacity-40")}>
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
              className="min-w-0 flex-1 rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-2 py-1.5 tv-figure text-xs text-[var(--tv-text)] outline-none"
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
              className="min-w-0 flex-1 rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-2 py-1.5 tv-figure text-xs text-[var(--tv-text)] outline-none"
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

      {/* Dimensionnement par le risque — on décide la perte avant la taille */}
      <div className="flex flex-col gap-2 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-[var(--tv-text-muted)]">
            {t("rt.sizing")}
          </span>
          <div className="flex items-center gap-1">
            <input
              value={riskPct}
              onChange={(e) => setRiskPct(e.target.value)}
              placeholder="1"
              inputMode="decimal"
              aria-label={t("rt.riskTarget")}
              className="w-12 rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-2 py-1 text-center tv-figure text-xs text-[var(--tv-text)] outline-none focus:border-[var(--tv-accent)]"
            />
            <span className="text-[11px] text-[var(--tv-text-muted)]">%</span>
            <button
              type="button"
              onClick={() => sizing && setQty(sizing.contracts)}
              disabled={!sizing || sizing.contracts < 1}
              className="rounded-lg border border-[var(--tv-border)] px-2 py-1 text-[11px] font-semibold text-[var(--tv-text)] transition disabled:opacity-40"
            >
              {t("rt.sizeApply")}
            </button>
          </div>
        </div>

        {slNumber == null ? (
          <p className="text-[10px] leading-relaxed text-[var(--tv-text-muted)]">
            {t("rt.riskNeedsStop")}
          </p>
        ) : (
          <>
            {currentRisk && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--tv-text-muted)]">{t("rt.riskOnOrder")}</span>
                <span className="tv-figure font-semibold text-[var(--tv-text)]">
                  {currentRisk.dollars.toFixed(0)} $ · {currentRisk.pct.toFixed(2)} %
                </span>
              </div>
            )}
            {sizing &&
              (sizing.contracts >= 1 ? (
                <div className="flex items-center justify-between text-[10px] text-[var(--tv-text-muted)]">
                  <span>
                    {t("rt.stopDistance")} {sizing.stopPoints.toFixed(2)} · {sizing.stopTicks} ticks
                  </span>
                  <span className="tv-figure">
                    {t("rt.contractsFor").replace("{n}", String(sizing.contracts))}
                  </span>
                </div>
              ) : (
                <p className="text-[10px] leading-relaxed text-[var(--tv-chart-red)]">
                  {t("rt.riskTooSmall")}
                </p>
              ))}
          </>
        )}
      </div>

      {/* R:R */}
      {rr && (
        <div className="flex items-center justify-between rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-3 py-2 text-[11px] text-[var(--tv-text-muted)]">
          <span>
            R <span className="font-bold text-[var(--tv-text)]">{rr.rr.toFixed(2)}</span>
          </span>
          <span>
            Risque{" "}
            <span className="tv-figure font-semibold text-[var(--tv-text)]">
              {pointsDollars(rr.riskPts, qty, spec).toFixed(0)} $
            </span>
          </span>
          <span>
            Récomp.{" "}
            <span className="tv-figure font-semibold text-[var(--tv-text)]">
              {pointsDollars(rr.rewPts, qty, spec).toFixed(0)} $
            </span>
          </span>
        </div>
      )}

      {/* LES DEUX BOUTONS D'EXÉCUTION — chacun porte son sens.
        Ils remplacent le couple « sélecteur de sens + bouton d'envoi » : un
        seul geste, et rien à vérifier avant de cliquer. */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => submit("long")}
          className="rounded-xl bg-[var(--tv-chart-green)] py-3 text-sm font-bold text-[#04121c] transition hover:brightness-110"
        >
          {t("rt.buy")} +{qty || 1}
          <span className="block text-[10px] font-semibold opacity-80">
            @ {type === "market" ? t("rt.market") : type === "limit" ? t("rt.limit") : t("rt.stop")}
          </span>
        </button>
        <button
          type="button"
          onClick={() => submit("short")}
          className="rounded-xl bg-[var(--tv-chart-red)] py-3 text-sm font-bold text-[#04121c] transition hover:brightness-110"
        >
          {t("rt.sell")} −{qty || 1}
          <span className="block text-[10px] font-semibold opacity-80">
            @ {type === "market" ? t("rt.market") : type === "limit" ? t("rt.limit") : t("rt.stop")}
          </span>
        </button>
      </div>

      <p className="text-center text-[10px] leading-relaxed text-[var(--tv-text-muted)]">
        1 tick = {tickValueDollars(1, spec).toFixed(2)} $ · 1 point ={" "}
        {pointsDollars(1, 1, spec).toFixed(0)} $ · commissions incluses au remplissage
      </p>
    </div>
  );
}
