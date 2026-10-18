import { useMemo } from "react";
import { Card } from "@/shared/ui";
import { useT } from "@/app/i18n/LanguageContext";
import type { Trade } from "@/app/types";
import { newsDaySplit, type DayBucket } from "@/domain/tradeNews";
import { formatMoney } from "@/shared/currency";
import { useEconomicHistory } from "../news/useTradeNews";
import { cn } from "@/shared/ui/cn";

/**
 * JOURS D'ANNONCE FACE AUX JOURS CALMES.
 *
 * Les résultats des journées où une annonce FORTE a touché la devise du trade
 * (calendrier réel uniquement), face aux autres. Chaque colonne affiche son
 * `n` ; sous l'échantillon minimum, aucun chiffre. Une comparaison, jamais une
 * explication : la page ne dit pas que l'annonce a causé le résultat.
 */
export function NewsDaysCard({ trades }: { trades: Trade[] }) {
  const { t } = useT();
  const dates = useMemo(() => trades.map((tr) => tr.date), [trades]);
  const { events, loading, failed } = useEconomicHistory(dates);
  const split = useMemo(() => newsDaySplit(trades, events), [trades, events]);

  return (
    <Card className="p-4 md:p-5 animate-fade-in-up stagger-6">
      <h3 className="tv-title mb-1">{t("analytics.newsDays")}</h3>
      <p className="tv-hint mb-3">{t("analytics.newsDaysSub")}</p>
      {loading ? (
        <div className="h-24 rounded-xl bg-white/[0.02] animate-pulse" />
      ) : failed || split.classified === 0 ? (
        <p className="text-[13px] text-slate-500 py-4">{t("analytics.newsDaysNone")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--tv-border)] bg-[var(--tv-border)]">
          <Column
            label={t("analytics.newsDaysNews")}
            b={split.newsDays}
            min={split.minSample}
            accent
          />
          <Column label={t("analytics.newsDaysQuiet")} b={split.quietDays} min={split.minSample} />
        </div>
      )}
      {!loading && split.uncovered > 0 && (
        <p className="tv-hint mt-2">
          {t("analytics.newsDaysUncovered").replace("{n}", String(split.uncovered))}
        </p>
      )}
    </Card>
  );
}

function Column({
  label,
  b,
  min,
  accent,
}: {
  label: string;
  b: DayBucket;
  min: number;
  accent?: boolean;
}) {
  const { t } = useT();
  const pnlTone = (v: number | null) =>
    v === null
      ? "text-slate-500"
      : v >= 0
        ? "text-[var(--tv-chart-green)]"
        : "text-[var(--tv-chart-red)]";
  return (
    <div className="bg-[var(--tv-plate-1)] px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn("tv-label", accent ? "text-amber-300/90" : "text-slate-400")}>
          {label}
        </span>
        <span className="tv-figure text-[11px] text-slate-500">n = {b.n}</span>
      </div>
      {b.winRate === null && b.avgPnl === null ? (
        <p className="mt-2 text-[12px] text-slate-500">
          {t("analytics.newsDaysTooFew").replace("{n}", String(min))}
        </p>
      ) : (
        <dl className="mt-2 space-y-1.5">
          <Row
            k={t("analytics.winRateLabel")}
            v={b.winRate === null ? "—" : `${Math.round(b.winRate * 100)}%`}
          />
          <Row
            k={t("analytics.newsDaysAvgPnl")}
            v={b.avgPnl === null ? "—" : formatMoney(b.avgPnl, { signed: true })}
            tone={pnlTone(b.avgPnl)}
          />
          <Row
            k={t("analytics.newsDaysAvgR")}
            v={b.avgR === null ? "—" : `${b.avgR >= 0 ? "+" : ""}${b.avgR.toFixed(2)}R`}
            tone={pnlTone(b.avgR)}
          />
        </dl>
      )}
    </div>
  );
}

function Row({ k, v, tone = "text-white" }: { k: string; v: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[11px] text-slate-500">{k}</dt>
      <dd className={cn("tv-figure text-[13px]", tone)}>{v}</dd>
    </div>
  );
}
