/**
 * ReplayTicket — la salle des marchés du terminal.
 *
 * Entrée au marché / limite / stop, quantité, et bracket posé dans le même
 * geste. Deux boutons d'exécution qui portent chacun leur sens : le couple
 * « sélecteur de sens + bouton d'envoi » demandait deux gestes et un état à
 * vérifier avant de cliquer.
 *
 * LE BRACKET SE MESURE EN TICKS, PAS EN PRIX.
 * C'est la grammaire de Project X, et ce n'est pas un détail d'affichage : un
 * stop saisi en prix absolu est inutilisable au marché — le temps de taper
 * « 24 837,50 », le marché est ailleurs, et le nombre qu'on vient d'écrire ne
 * veut plus rien dire. Une DISTANCE, elle, reste vraie quel que soit le prix
 * d'entrée, vaut pour l'achat comme pour la vente (elle se retourne toute
 * seule), et c'est de toute façon en distance qu'un trader pense son risque :
 * « je mets quarante ticks », jamais « je mets 24 837,50 ».
 *
 * Les prix résultants sont affichés à côté, en clair : la distance est ce
 * qu'on règle, le prix reste ce qu'on vérifie.
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

/** Les paliers de quantité usuels, à un clic — comme sur Project X. */
const QTY_PRESETS = [1, 2, 3, 5, 10];

/** Un pas de réglage pour les distances de bracket, en ticks. */
const TICK_STEPS = [-20, -4, 4, 20];

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
  /** Distances du bracket, EN TICKS depuis l'entrée. */
  const [slTicks, setSlTicks] = useState<string>("40");
  const [tpTicks, setTpTicks] = useState<string>("80");

  const [riskPct, setRiskPct] = useState<string>("");
  /** Le bracket part-il avec l'ordre ? Éteint, stop et objectif sont ignorés. */
  const [bracketOn, setBracketOn] = useState(true);
  const spec = useMemo(() => instrumentOf(symbol), [symbol]);
  const tick = spec.tickSize;
  const mark = price ?? 0;

  /** Le prix d'entrée de référence : la limite saisie, ou le marché. */
  const entryRef = type === "market" ? mark : Number(limit) || mark;

  const slN = bracketOn ? Math.abs(Number(slTicks)) || 0 : 0;
  const tpN = bracketOn ? Math.abs(Number(tpTicks)) || 0 : 0;

  /**
   * Les prix du bracket POUR UN SENS DONNÉ.
   *
   * Un même réglage donne deux trades symétriques : le stop d'un achat est
   * sous l'entrée, celui d'une vente au-dessus. C'est le bouton cliqué qui
   * tranche — et c'est pour ça que le réglage en distance tient : il n'a pas
   * à choisir le sens à l'avance.
   */
  const bracketFor = (side: Side, entry: number) => {
    const dir = side === "long" ? 1 : -1;
    return {
      sl: slN > 0 ? roundToTick(entry - dir * slN * tick, spec) : undefined,
      tp: tpN > 0 ? roundToTick(entry + dir * tpN * tick, spec) : undefined,
    };
  };

  /** L'aperçu s'affiche à l'achat : le sens exact se décide au clic. */
  const preview = bracketFor("long", entryRef);

  const rr = slN > 0 && tpN > 0 ? tpN / slN : null;
  const riskDollars = slN > 0 ? pointsDollars(slN * tick, qty || 1, spec) : null;
  const rewardDollars = tpN > 0 ? pointsDollars(tpN * tick, qty || 1, spec) : null;

  /** Ce que l'ordre courant risque réellement, commissions comprises. */
  const currentRisk = useMemo(() => {
    if (slN <= 0 || !entryRef) return null;
    const stop = entryRef - slN * tick;
    return {
      dollars: riskOfSize(qty, entryRef, stop, spec, commissionPerContract),
      pct: riskPctOfSize(qty, entryRef, stop, balance, spec, commissionPerContract),
    };
  }, [qty, entryRef, slN, tick, balance, spec, commissionPerContract]);

  /** La taille qu'autoriserait le budget de risque saisi. */
  const sizing = useMemo(() => {
    const pct = Number(riskPct);
    if (slN <= 0 || !entryRef || !pct) return null;
    return sizeFromRisk({
      balance,
      riskPct: pct,
      entry: entryRef,
      stop: entryRef - slN * tick,
      spec,
      commissionPerContract,
    });
  }, [riskPct, slN, tick, entryRef, balance, spec, commissionPerContract]);

  const submit = (s: Side) => {
    const entry = type === "market" ? mark : roundToTick(Number(limit) || 0, spec);
    const b = bracketFor(s, entry);
    onPlace({
      side: s,
      type,
      qty: Math.max(1, Math.round(qty || 1)),
      price: type === "market" ? undefined : entry,
      sl: b.sl,
      tp: b.tp,
    });
  };

  /**
   * Une cotation DÉDUITE, pas un carnet.
   *
   * Le rejeu ne dispose que d'OHLC : il n'existe aucune profondeur de marché à
   * afficher. On encadre donc le prix marqué d'un demi-tick de chaque côté —
   * ce qui donne le spread d'un tick, celui du NQ en séance.
   */
  const bid = roundToTick(mark - tick / 2, spec);
  const ask = roundToTick(mark + tick / 2, spec);

  const stepTicks = (cur: string, set: (v: string) => void, d: number) =>
    set(String(Math.max(0, (Math.abs(Number(cur)) || 0) + d)));

  /** Une jambe du bracket : distance en ticks, prix visé, montant en jeu. */
  const legRow = (
    which: "sl" | "tp",
    value: string,
    set: (v: string) => void,
    money: number | null,
    target: number | undefined,
  ) => {
    const color = which === "sl" ? "var(--tv-chart-red)" : "var(--tv-chart-green)";
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-6 shrink-0 text-[10px] font-bold uppercase" style={{ color }}>
          {which === "sl" ? "SL" : "TP"}
        </span>
        <div className="flex items-center gap-0.5 rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-2)] p-0.5">
          {TICK_STEPS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => stepTicks(value, set, d)}
              className="rounded px-1 text-[10px] font-bold text-[var(--tv-text-muted)] transition hover:bg-[var(--tv-surface-hover)] hover:text-[var(--tv-text)]"
            >
              {d > 0 ? `+${d}` : d}
            </button>
          ))}
        </div>
        <input
          value={value}
          onChange={(e) => set(e.target.value)}
          inputMode="numeric"
          aria-label={which === "sl" ? t("rt.sl") : t("rt.tp")}
          className="w-12 rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-1.5 py-1 text-center tv-figure text-xs text-[var(--tv-text)] outline-none focus:border-[var(--tv-accent)]"
        />
        <span className="shrink-0 text-[10px] text-[var(--tv-text-muted)]">{t("rt.ticks")}</span>
        <span className="ml-auto flex min-w-0 flex-col items-end leading-tight">
          <span className="tv-figure text-[11px] font-bold" style={{ color }}>
            {money == null ? "—" : `${which === "sl" ? "−" : "+"}$${Math.abs(money).toFixed(0)}`}
          </span>
          <span className="tv-figure text-[9px] text-[var(--tv-text-muted)]">
            {target == null ? "—" : target.toFixed(2)}
          </span>
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2.5 p-3">
      {/* Contrat et cotation — ce qu'on trade, avant comment on le trade. */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-extrabold tracking-tight text-[var(--tv-text)]">
          {spec.symbol}
        </span>
        <span className="tv-figure text-xs font-semibold">
          <span className="text-[var(--tv-chart-red)]">{bid.toFixed(2)}</span>
          <span className="mx-1 text-[var(--tv-text-muted)]">/</span>
          <span className="text-[var(--tv-chart-green)]">{ask.toFixed(2)}</span>
        </span>
      </div>

      {/* Type d'ordre */}
      <div className="grid grid-cols-3 gap-0.5 rounded-xl bg-[var(--tv-plate-1)] p-0.5">
        {(["market", "limit", "stop"] as const).map((ty) => (
          <button
            key={ty}
            type="button"
            onClick={() => setType(ty)}
            className={cn(
              "rounded-[10px] py-1.5 text-[11px] font-bold uppercase tracking-wide transition",
              type === ty
                ? "bg-[var(--tv-surface-hover)] text-[var(--tv-text)]"
                : "text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]",
            )}
          >
            {ty === "market" ? t("rt.market") : ty === "limit" ? t("rt.limit") : t("rt.stop")}
          </button>
        ))}
      </div>

      {type !== "market" && (
        <label className="flex items-center gap-2 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-2.5 py-1.5">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--tv-text-muted)]">
            {type === "limit" ? t("rt.limit") : t("rt.stop")}
          </span>
          <input
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder={mark ? mark.toFixed(2) : "0.00"}
            inputMode="decimal"
            className="min-w-0 flex-1 bg-transparent text-right tv-figure text-sm text-[var(--tv-text)] outline-none placeholder:text-[var(--tv-text-muted)]"
          />
        </label>
      )}

      {/* QUANTITÉ — le réglage le plus fréquent, donc le plus gros.
        Les paliers à un clic évitent six appuis sur « + ». */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setQty((n) => Math.max(1, n - 1))}
          aria-label="−1"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] text-base font-bold text-[var(--tv-text-muted)] transition hover:text-[var(--tv-text)]"
        >
          −
        </button>
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          aria-label={t("rt.qty")}
          className="h-9 min-w-0 flex-1 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-2 text-center tv-figure text-base text-[var(--tv-text)] outline-none focus:border-[var(--tv-accent)]"
        />
        <button
          type="button"
          onClick={() => setQty((n) => n + 1)}
          aria-label="+1"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] text-base font-bold text-[var(--tv-text-muted)] transition hover:text-[var(--tv-text)]"
        >
          +
        </button>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {QTY_PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setQty(n)}
            className={cn(
              "rounded-lg py-1 text-[11px] font-bold transition",
              qty === n
                ? "tv-accent-fill text-white"
                : "border border-[var(--tv-border)] bg-[var(--tv-plate-1)] text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]",
            )}
          >
            {n}
          </button>
        ))}
      </div>

      {/* BRACKET — en distance, avec ses prix et ses montants en regard. */}
      <div className="flex flex-col gap-2 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] p-2">
        <label className="flex cursor-pointer items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--tv-text-muted)]">
            {t("rt.positionBracket")}
          </span>
          <span className="flex items-center gap-2">
            {rr != null && bracketOn && (
              <span className="tv-figure rounded-md bg-[var(--tv-plate-2)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--tv-text)]">
                {rr.toFixed(2)} R
              </span>
            )}
            <input
              type="checkbox"
              checked={bracketOn}
              onChange={(e) => setBracketOn(e.target.checked)}
              aria-label={t("rt.positionBracket")}
              className="h-4 w-4 accent-[var(--tv-accent)]"
            />
          </span>
        </label>
        <div
          className={cn("flex flex-col gap-1.5", !bracketOn && "pointer-events-none opacity-40")}
        >
          {legRow("sl", slTicks, setSlTicks, riskDollars, preview.sl)}
          {legRow("tp", tpTicks, setTpTicks, rewardDollars, preview.tp)}
        </div>
        <p className="text-[9px] leading-tight text-[var(--tv-text-muted)]">
          {t("rt.bracketHint")}
        </p>
      </div>

      {/* Dimensionnement par le risque — on décide la perte avant la taille. */}
      <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] p-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--tv-text-muted)]">
            {t("rt.sizing")}
          </span>
          <div className="flex items-center gap-1">
            <input
              value={riskPct}
              onChange={(e) => setRiskPct(e.target.value)}
              placeholder="1"
              inputMode="decimal"
              aria-label={t("rt.riskTarget")}
              className="w-10 rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-1 py-1 text-center tv-figure text-[11px] text-[var(--tv-text)] outline-none focus:border-[var(--tv-accent)]"
            />
            <span className="text-[10px] text-[var(--tv-text-muted)]">%</span>
            <button
              type="button"
              onClick={() => sizing && setQty(sizing.contracts)}
              disabled={!sizing || sizing.contracts < 1}
              className="rounded-lg border border-[var(--tv-border)] px-2 py-1 text-[10px] font-bold text-[var(--tv-text)] transition hover:bg-[var(--tv-surface-hover)] disabled:opacity-40"
            >
              {t("rt.sizeApply")}
            </button>
          </div>
        </div>
        {slN <= 0 ? (
          <p className="text-[10px] leading-tight text-[var(--tv-text-muted)]">
            {t("rt.riskNeedsStop")}
          </p>
        ) : (
          <>
            {currentRisk && (
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[var(--tv-text-muted)]">{t("rt.riskOnOrder")}</span>
                <span className="tv-figure font-bold text-[var(--tv-text)]">
                  {currentRisk.dollars.toFixed(0)} $ · {currentRisk.pct.toFixed(2)} %
                </span>
              </div>
            )}
            {sizing &&
              (sizing.contracts >= 1 ? (
                <div className="flex items-center justify-between text-[10px] text-[var(--tv-text-muted)]">
                  <span>
                    {t("rt.stopDistance")} {sizing.stopPoints.toFixed(2)}
                  </span>
                  <span className="tv-figure">
                    {t("rt.contractsFor").replace("{n}", String(sizing.contracts))}
                  </span>
                </div>
              ) : (
                <p className="text-[10px] leading-tight text-[var(--tv-chart-red)]">
                  {t("rt.riskTooSmall")}
                </p>
              ))}
          </>
        )}
      </div>

      {/* LES DEUX BOUTONS D'EXÉCUTION — chacun porte son sens.
        Texte blanc, et non sombre : c'est la couleur qui porte le sens, le
        texte n'a qu'à rester lisible. Un libellé sombre sur un vert de thème
        change de contraste d'un thème à l'autre ; le blanc, non. */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => submit("long")}
          className="rounded-xl bg-[var(--tv-chart-green)] py-3 text-sm font-extrabold uppercase tracking-wide text-white shadow-[var(--tv-elev-1)] transition hover:brightness-110 active:brightness-95"
        >
          {t("rt.buy")} {qty || 1}
          <span className="block text-[9px] font-bold uppercase tracking-wide opacity-85">
            {type === "market" ? t("rt.market") : type === "limit" ? t("rt.limit") : t("rt.stop")}
          </span>
        </button>
        <button
          type="button"
          onClick={() => submit("short")}
          className="rounded-xl bg-[var(--tv-chart-red)] py-3 text-sm font-extrabold uppercase tracking-wide text-white shadow-[var(--tv-elev-1)] transition hover:brightness-110 active:brightness-95"
        >
          {t("rt.sell")} {qty || 1}
          <span className="block text-[9px] font-bold uppercase tracking-wide opacity-85">
            {type === "market" ? t("rt.market") : type === "limit" ? t("rt.limit") : t("rt.stop")}
          </span>
        </button>
      </div>

      <p className="text-center text-[9px] leading-tight text-[var(--tv-text-muted)]">
        1 tick = {tickValueDollars(1, spec).toFixed(2)} $ · 1 pt ={" "}
        {pointsDollars(1, 1, spec).toFixed(0)} $
      </p>
    </div>
  );
}
