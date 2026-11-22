import { useT } from "@/app/i18n/LanguageContext";
import { intlLocale } from "@/app/i18n/locale";
import { Button, Input, FORM_LABEL } from "@/shared/ui";
import { formatMoney } from "@/shared/currency";
import {
  plannedR,
  priceOrNull,
  rFromPrices,
  riskFromPrices,
  stopSize,
  type PlannedLevels,
} from "@/domain/executionPlan";

/**
 * PRIX ET PLAN — ce que le trader a vraiment posé, à côté de ce qu'il avait
 * écrit avant l'open.
 *
 * Tout est facultatif. Avec une entrée et un stop, le R et le risque se
 * CALCULENT ; ils ne remplacent jamais une saisie sans un clic (« Utiliser »).
 * Le plan de séance s'affiche en lecture seule : il a été figé à l'encodage.
 */

export type PriceField = "entryPrice" | "exitPrice" | "quantity" | "initialStop" | "initialTarget";

interface Props {
  symbol: string;
  direction: "long" | "short" | "be";
  values: Record<PriceField, string>;
  onChange: (key: PriceField, value: string) => void;
  planned: PlannedLevels | null;
  /** Trade venu du broker : entrée, sortie et quantité sont déjà au-dessus. */
  executionShownAbove: boolean;
  riskDollar: number;
  rMultiple: string;
  /** Le R se déduit du P&L observé (trade importé) : rien à appliquer. */
  rLocked: boolean;
  onUseR: (r: number) => void;
  onUseRisk: (risk: number) => void;
}

const FIELDS: readonly [PriceField, Parameters<ReturnType<typeof useT>["t"]>[0], boolean][] = [
  ["entryPrice", "trade.execEntry", true],
  ["initialStop", "trade.initialStop", false],
  ["initialTarget", "trade.initialTarget", false],
  ["exitPrice", "trade.execExit", true],
  ["quantity", "trade.execContracts", true],
];

export function TradePricesSection(props: Props) {
  const { t, lang } = useT();
  const { values, planned, direction } = props;
  const fmt = (n: number, digits = 2) =>
    n.toLocaleString(intlLocale(lang), { maximumFractionDigits: digits });

  const side = direction === "be" ? null : direction;
  const entry = priceOrNull(values.entryPrice);
  const stop = priceOrNull(values.initialStop);
  const target = priceOrNull(values.initialTarget);
  const exit = priceOrNull(values.exitPrice);
  const qty = priceOrNull(values.quantity);

  const size = side ? stopSize(side, entry, stop, props.symbol) : null;
  const aimR = side ? plannedR(side, entry, stop, target) : null;
  const priceR = side ? rFromPrices(side, entry, stop, exit) : null;
  const impliedRisk = side ? riskFromPrices(side, entry, stop, qty, props.symbol) : null;
  const planR =
    planned?.direction != null
      ? plannedR(planned.direction, planned.entry, planned.stop, planned.target)
      : null;

  const canUseR = priceR != null && !props.rLocked && Number(props.rMultiple) !== priceR;
  const canUseRisk = impliedRisk != null && Math.abs(props.riskDollar - impliedRisk) >= 0.01;
  const planFillable =
    planned != null &&
    ((planned.stop != null && values.initialStop.trim() === "") ||
      (planned.target != null && values.initialTarget.trim() === ""));

  const level = (key: Parameters<typeof t>[0], v: number | null) =>
    v == null ? null : (
      <span>
        {t(key)} <span className="tv-figure text-slate-200">{fmt(v, 5)}</span>
      </span>
    );

  return (
    <div className="space-y-2.5">
      {planned && (
        <div className="tv-trade-strip flex-wrap gap-x-3 gap-y-1 text-[12px] text-slate-400">
          <span className="tv-label">
            {t("trade.planLine").replace("{s}", planned.scenario ?? "A")}
          </span>
          {planned.direction && (
            <span className="font-semibold text-slate-200">
              {planned.direction === "long" ? t("common.long") : t("common.short")}
            </span>
          )}
          {level("trade.planEntry", planned.entry)}
          {level("trade.planStop", planned.stop)}
          {level("trade.planTarget", planned.target)}
          {planR != null && (
            <span>
              {t("trade.rPlanned")} <span className="tv-figure text-slate-200">{fmt(planR)}R</span>
            </span>
          )}
          {planFillable && (
            <Button
              variant="subtle"
              size="sm"
              className="ml-auto"
              onClick={() => {
                if (planned.stop != null && values.initialStop.trim() === "")
                  props.onChange("initialStop", String(planned.stop));
                if (planned.target != null && values.initialTarget.trim() === "")
                  props.onChange("initialTarget", String(planned.target));
              }}
            >
              {t("trade.usePlanLevels")}
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {FIELDS.filter(([, , exec]) => !(exec && props.executionShownAbove)).map(([key, label]) => (
          <label key={key} className="block min-w-0">
            <span className={FORM_LABEL}>{t(label)}</span>
            <Input
              aria-label={t(label)}
              type="number"
              step={key === "quantity" ? "1" : "any"}
              min="0"
              inputMode="decimal"
              value={values[key]}
              onChange={(e) => props.onChange(key, e.target.value)}
              placeholder="—"
              className="tv-figure"
            />
          </label>
        ))}
      </div>

      <p className="tv-trade-strip flex-wrap gap-x-3 gap-y-1 text-[12px] text-slate-500">
        {size || aimR != null || priceR != null || impliedRisk != null ? (
          <>
            {size && (
              <span>
                {t("trade.stopSize")}{" "}
                <span className="tv-figure text-slate-200">
                  {fmt(size.points, 4)} pts{size.ticks != null ? ` · ${size.ticks} ticks` : ""}
                </span>
              </span>
            )}
            {aimR != null && (
              <span>
                {t("trade.rAimed")} <span className="tv-figure text-slate-200">{fmt(aimR)}R</span>
              </span>
            )}
            {priceR != null && (
              <span className="inline-flex items-center gap-1.5">
                {t("trade.rFromPrices")}{" "}
                <span className="tv-figure text-slate-200">
                  {priceR > 0 ? "+" : ""}
                  {fmt(priceR)}R
                </span>
                {canUseR && (
                  <Button variant="subtle" size="sm" onClick={() => props.onUseR(priceR)}>
                    {t("trade.useValue")}
                  </Button>
                )}
              </span>
            )}
            {impliedRisk != null && (
              <span className="inline-flex items-center gap-1.5">
                {t("trade.riskFromPrices")}{" "}
                <span className="tv-figure text-slate-200">{formatMoney(impliedRisk)}</span>
                {canUseRisk && (
                  <Button variant="subtle" size="sm" onClick={() => props.onUseRisk(impliedRisk)}>
                    {t("trade.useValue")}
                  </Button>
                )}
              </span>
            )}
          </>
        ) : (
          t("trade.pricesHint")
        )}
      </p>
    </div>
  );
}
