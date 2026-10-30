import { useMemo, useState } from "react";
import type { Trade } from "@/app/types";
import { useT } from "@/app/i18n/LanguageContext";
import { formatPnl } from "@/domain/tradeCalcs";
import { stopAfterLossesScenario } from "@/modules/research";
import { Badge, Card, SelectPicker } from "@/shared/ui";

/**
 * BEHAVIORLAB (lot 2) — « et si je m'étais arrêté après N pertes ? »
 *
 * Un SCÉNARIO rejoué sur l'historique, étiqueté comme tel : il dit ce que les
 * trades qui ont suivi N pertes ont rapporté ou coûté, pas ce qui se serait
 * passé. Les séances dont l'ordre n'est pas prouvé sont écartées et comptées.
 */

const OPTIONS = ["2", "3", "4"] as const;
type Option = (typeof OPTIONS)[number];

export function BehaviorScenarioCard({ trades }: { trades: Trade[] }) {
  const { t } = useT();
  const [n, setN] = useState<Option>("2");
  const r = useMemo(() => stopAfterLossesScenario(trades, Number(n)), [trades, n]);

  return (
    <Card className="p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="tv-title flex flex-wrap items-center gap-2">
            {t("behavior.title")}
            <Badge variant="warning">{t("behavior.hypothetical")}</Badge>
          </h3>
          <p className="tv-row-label mt-1 max-w-xl">{t("behavior.subtitle")}</p>
        </div>
        <SelectPicker
          label={t("behavior.after")}
          value={n}
          onChange={setN}
          options={OPTIONS.map((o) => ({
            value: o,
            label: t("behavior.afterN").replace("{n}", o),
          }))}
        />
      </div>

      {r.sessionsEvaluated === 0 ? (
        <p className="tv-prose mt-3 text-slate-500">
          {t("behavior.none").replace("{unknown}", String(r.sessionsUnknown))}
        </p>
      ) : (
        <div className="mt-3 space-y-1.5">
          <p className="tv-prose text-slate-300">
            {t("behavior.result")
              .replace("{triggered}", String(r.sessionsTriggered))
              .replace("{evaluated}", String(r.sessionsEvaluated))
              .replace("{removed}", String(r.tradesRemoved))}
          </p>
          {r.tradesRemoved > 0 && (
            <p className="tv-prose text-slate-300">
              {t("behavior.removedPnl")}{" "}
              <span
                className={
                  r.removedPnl < 0 ? "tv-figure text-red-400" : "tv-figure text-emerald-400"
                }
              >
                {formatPnl(r.removedPnl)}
              </span>
              {" · "}
              {t("behavior.compare")}{" "}
              <span className="tv-figure text-slate-100">{formatPnl(r.actualPnl)}</span>
              {" → "}
              <span className="tv-figure text-slate-100">{formatPnl(r.hypotheticalPnl)}</span>
            </p>
          )}
          {r.sessionsUnknown > 0 && (
            <p className="tv-hint">
              {t("behavior.excluded").replace("{n}", String(r.sessionsUnknown))}
            </p>
          )}
          <p className="tv-hint">{t("behavior.caveat")}</p>
        </div>
      )}
    </Card>
  );
}
