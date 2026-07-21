import { useMemo } from "react";
import { TrendingDown, TrendingUp, Banknote } from "lucide-react";
import type { Trade } from "../types";
import { analyzeBehavior } from "@/modules/trading/behavior";
import { formatPnl } from "../utils/tradeCalcs";
import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";

/**
 * "Cost of my mistakes" — the monthly, money-denominated verdict (US-2.1).
 * Every number comes from the deterministic behavior engine; the card only
 * renders. Hidden until at least one mistake-tagged trade exists.
 */
export default function MistakeCostCard({ trades }: { trades: Trade[] }) {
  const { t } = useT();
  const costs = useMemo(() => analyzeBehavior(trades).mistakeCosts, [trades]);

  const monthRows = costs.rows.filter((r) => r.monthCount > 0 && r.monthPnl < 0).slice(0, 3);
  if (!costs.rows.length) return null;

  const monthCost = costs.monthTotal;
  const prevCost = costs.prevMonthTotal;
  // "Improving" = this month's mistakes bleed less than last month's.
  const improving = monthCost > prevCost;
  const worst = monthRows[0] ?? null;

  return (
    <div className="glass rounded-2xl p-4 md:p-5 card-premium animate-fade-in-up stagger-1">
      <div className="flex items-center gap-1.5 mb-1">
        <Banknote className="w-3.5 h-3.5 text-red-400" />
        <span className="text-xs font-bold text-white">{t("mistakes.costTitle")}</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className={cn("text-2xl font-bold", monthCost < 0 ? "text-red-400" : "text-emerald-400")}
        >
          {formatPnl(monthCost)}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-slate-400">
          {improving ? (
            <TrendingUp className="w-3 h-3 text-emerald-400" />
          ) : (
            <TrendingDown className="w-3 h-3 text-red-400" />
          )}
          {t("mistakes.costPrevMonth")} {formatPnl(prevCost)}
        </span>
      </div>
      {worst && (
        <p className="mt-1.5 text-[11px] text-slate-400">
          {t("mistakes.costWorstPrefix")}{" "}
          <span className="font-semibold text-white">{worst.name}</span> — {worst.monthCount}×,{" "}
          <span className="font-semibold text-red-400">{formatPnl(worst.monthPnl)}</span>{" "}
          {t("mistakes.costWorstSuffix")}
        </p>
      )}
      <p className="mt-1 text-[10px] text-slate-500">{t("mistakes.costBasis")}</p>
    </div>
  );
}
