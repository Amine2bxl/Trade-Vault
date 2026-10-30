import { useMemo, useState } from "react";
import type { Trade } from "@/app/types";
import { useT } from "@/app/i18n/LanguageContext";
import { intlLocale } from "@/app/i18n/locale";
import { formatPnl } from "@/domain/tradeCalcs";
import { MIN_SESSIONS, MIN_TRADES } from "@/modules/patterns/thresholds";
import {
  analyzeDimension,
  outOfSample,
  type EdgeCell,
  type EdgeDimension,
  type HoldoutStatus,
} from "@/modules/research";
import { Card, SelectPicker, cn } from "@/shared/ui";

/**
 * CONDITIONS DE PERFORMANCE — EdgeLab (lot 2), dans Analytics.
 *
 * Pour une dimension choisie, chaque valeur affiche son `n`, ses séances, son
 * espérance nette, l'intervalle bootstrap par séances, le q corrigé pour les
 * tests multiples et un verdict qui ne dit jamais « meilleur ». Un écart
 * sélectionné sur la période d'apprentissage est ensuite confronté au holdout.
 * Le pied de carte rend la méthode : graine, tirages, seuil FDR, couverture.
 */

const DIMENSIONS: EdgeDimension[] = ["strategy", "symbol", "session", "weekday", "account"];
const COSTS = ["0", "2", "5", "10"] as const;
type Cost = (typeof COSTS)[number];

export function EdgeLabCard({
  trades,
  accountName,
}: {
  trades: Trade[];
  accountName: (id: string) => string;
}) {
  const { t, lang } = useT();
  const [dimension, setDimension] = useState<EdgeDimension>("strategy");
  const [cost, setCost] = useState<Cost>("0");
  const extraCostPerTrade = Number(cost);

  const report = useMemo(
    () => analyzeDimension(trades, dimension, { extraCostPerTrade }),
    [trades, dimension, extraCostPerTrade],
  );
  const oos = useMemo(
    () => outOfSample(trades, dimension, { extraCostPerTrade }),
    [trades, dimension, extraCostPerTrade],
  );
  const oosByKey = new Map(oos.cells.map((c) => [c.key, c]));

  // Libellés existants du produit : sessions (`session.*`) et jours via Intl.
  const weekdayFmt = new Intl.DateTimeFormat(intlLocale(lang), {
    weekday: "long",
    timeZone: "UTC",
  });
  const label = (key: string) => {
    if (dimension === "session") return t(`session.${key as "asia" | "london" | "newyork"}`);
    // Le 4 janvier 2026 est un dimanche (jour 0).
    if (dimension === "weekday")
      return weekdayFmt.format(new Date(Date.UTC(2026, 0, 4 + Number(key))));
    if (dimension === "account") return accountName(key);
    return key;
  };
  const verdictText = (c: EdgeCell) => {
    if (c.verdict === "insufficient") {
      return t("edge.verdict.insufficient")
        .replace("{trades}", String(Math.max(0, MIN_TRADES - c.n)))
        .replace("{sessions}", String(Math.max(0, MIN_SESSIONS - c.sessions)));
    }
    const base = t(`edge.verdict.${c.verdict}`);
    return c.fragile ? `${base} · ${t("edge.fragile")}` : base;
  };
  const holdoutText = (s: HoldoutStatus) => t(`edge.holdout.${s}`);

  return (
    <Card className="overflow-hidden animate-fade-in-up stagger-3">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3 md:px-5">
        <div className="min-w-0">
          <h3 className="tv-title">{t("edge.title")}</h3>
          <p className="tv-hint mt-0.5 max-w-xl">{t("edge.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SelectPicker
            label={t("edge.dimension")}
            value={dimension}
            onChange={setDimension}
            options={DIMENSIONS.map((d) => ({ value: d, label: t(`edge.dim.${d}`) }))}
          />
          <SelectPicker
            label={t("edge.costStress")}
            value={cost}
            neutralValue="0"
            onChange={setCost}
            options={COSTS.map((c) => ({
              value: c,
              label: c === "0" ? t("edge.costNone") : t("edge.costPlus").replace("{n}", c),
            }))}
          />
        </div>
      </div>

      {report.cells.length === 0 ? (
        <p className="tv-prose px-4 py-4 text-slate-500 md:px-5">{t("edge.empty")}</p>
      ) : (
        <ul className="divide-y divide-white/[0.04]">
          {report.cells.map((c) => {
            const o = oosByKey.get(c.key);
            const tone =
              c.verdict === "positive_observed"
                ? "text-emerald-400"
                : c.verdict === "negative_observed"
                  ? "text-red-400"
                  : "text-slate-400";
            return (
              <li key={c.key} className="px-4 py-3 md:px-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="min-w-0 truncate font-bold text-white" title={label(c.key)}>
                    {label(c.key)}
                  </span>
                  <span className="tv-figure text-slate-400">
                    {t("edge.sample")
                      .replace("{n}", String(c.n))
                      .replace("{sessions}", String(c.sessions))}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="tv-figure">
                    <span className="tv-label mr-1.5 text-slate-500">{t("edge.expectancy")}</span>
                    <span className={c.netExpectancy >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {formatPnl(c.netExpectancy)}
                    </span>
                  </span>
                  {c.bootstrap && (
                    <span className="tv-figure text-slate-300">
                      <span className="tv-label mr-1.5 text-slate-500">{t("edge.interval")}</span>
                      {formatPnl(c.bootstrap.low)} … {formatPnl(c.bootstrap.high)}
                    </span>
                  )}
                  {c.q !== null && (
                    <span className="tv-figure text-slate-300">
                      <span className="tv-label mr-1.5 text-slate-500">q</span>
                      {c.q < 0.001 ? "< 0.001" : c.q.toFixed(3)}
                    </span>
                  )}
                  <span className="tv-figure text-slate-300">
                    <span className="tv-label mr-1.5 text-slate-500">R</span>
                    {c.expectancyR === null
                      ? `— (${t("edge.nR").replace("{n}", String(c.nR))})`
                      : `${c.expectancyR.toFixed(2)}R (${t("edge.nR").replace("{n}", String(c.nR))})`}
                  </span>
                </div>
                <p className={cn("tv-prose mt-1", tone)}>{verdictText(c)}</p>
                {o && (
                  <p className="tv-prose text-slate-400">
                    {t("edge.oos")
                      .replace("{validation}", holdoutText(o.validation))
                      .replace("{holdout}", holdoutText(o.holdout))
                      .replace("{n}", String(o.holdoutN))}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="tv-hint border-t border-white/[0.06] px-4 py-3 md:px-5">
        {t("edge.method")
          .replace("{iterations}", String(report.iterations || 2000))
          .replace("{alpha}", String(Math.round(report.alpha * 100)))
          .replace("{tests}", String(report.tests))
          .replace("{coverage}", String(Math.round(report.coverage * 100)))
          .replace("{unknown}", String(report.unknown))
          .replace("{version}", String(report.version))}
      </p>
    </Card>
  );
}
