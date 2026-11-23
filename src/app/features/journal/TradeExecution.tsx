import { useEffect, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { useT } from "@/app/i18n/LanguageContext";
import type { TKey } from "@/app/i18n/translations";
import { saveExecutionOverride, type ExecutionOverride } from "@/app/store/tradeIntel";
import type { Deviation, ExecutionAssessment, ExecutionVerdict } from "@/modules/discipline";
import { cn } from "@/shared/ui/cn";
import { VERDICT_KEYS, verdictTone } from "./executionLabels";
import { formatMoney } from "@/shared/currency";

/**
 * L'EXÉCUTION, À CÔTÉ DU RÉSULTAT — jamais mélangée avec lui.
 *
 * Le verdict vient du moteur (`modules/discipline/execution`) ; chaque écart
 * dit d'où il vient (observé, déclaré, à confirmer). Le trader peut corriger
 * le verdict : la correction est enregistrée comme telle, le calcul reste
 * visible dans les écarts.
 */

const DEVIATION_KEYS: Record<Deviation["kind"], TKey> = {
  direction: "exec.dev.direction",
  extra: "exec.dev.extra",
  observation: "exec.dev.observation",
  entry_outside_zone: "exec.dev.entryOutsideZone",
  stop_beyond_plan: "exec.dev.stopBeyondPlan",
  over_risk: "exec.dev.overRisk",
  mistake: "exec.dev.mistake",
  plan_not_respected: "exec.dev.planNotRespected",
  reflection_reason: "exec.dev.reflectionReason",
  early_exit: "exec.dev.earlyExit",
};

const CERTAINTY_KEYS: Record<Deviation["certainty"], TKey> = {
  observed: "exec.observed",
  declared: "exec.declared",
  to_confirm: "exec.toConfirm",
};

export function TradeExecution({
  tradeId,
  assessment,
  label = true,
}: {
  tradeId: string;
  /** `null` pendant le chargement du plan du jour. */
  assessment: ExecutionAssessment | null;
  label?: boolean;
}) {
  const { t } = useT();
  const { user } = useAuth();
  // Correction optimiste : affichée tout de suite, retirée si la base refuse.
  const [pending, setPending] = useState<{ value: ExecutionOverride | null } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setPending(null);
    setFailed(false);
  }, [tradeId, assessment]);
  if (!assessment) return null;

  const detailText = (d: Deviation): string => {
    if (d.detail == null) return "";
    if (d.kind === "reflection_reason") return t(`trade.reason.${d.detail}` as TKey);
    if (d.kind === "over_risk") return formatMoney(Number(d.detail));
    return d.detail;
  };
  const manual = pending ? pending.value !== null : assessment.source === "manual";
  const verdict: ExecutionVerdict = pending?.value ?? assessment.verdict;
  const correct = async (value: ExecutionOverride | null) => {
    if (!user) return;
    setPending({ value });
    setFailed(false);
    const ok = await saveExecutionOverride(user.id, tradeId, value, null);
    if (!ok) {
      setPending(null);
      setFailed(true);
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <span className="tv-label block text-slate-500">
          {t("exec.title")} <span className="normal-case text-slate-600">· {t("exec.notPnl")}</span>
        </span>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-lg border px-2.5 py-1 text-[11px] font-semibold",
            verdictTone(verdict),
          )}
        >
          {t(VERDICT_KEYS[verdict])}
        </span>
        {manual && <span className="text-[11px] text-slate-500">{t("exec.manual")}</span>}
        <span className="ml-auto flex gap-1">
          {(["good_execution", "bad_execution"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={manual && verdict === v}
              onClick={() => void correct(manual && verdict === v ? null : v)}
              className="rounded-md border border-[var(--tv-border)] px-2 py-0.5 text-[10px] text-slate-400 transition-colors hover:text-white aria-pressed:border-[var(--tv-border-strong)] aria-pressed:text-white"
            >
              {t(v === "good_execution" ? "exec.markGood" : "exec.markBad")}
            </button>
          ))}
        </span>
      </div>
      {assessment.deviations.length > 0 ? (
        <ul className="space-y-1">
          {assessment.deviations.map((d, i) => (
            <li key={i} className="flex items-baseline gap-2 text-xs">
              <span
                className={cn(
                  "tv-label shrink-0",
                  d.certainty === "to_confirm" ? "text-amber-300" : "text-slate-500",
                )}
              >
                {t(CERTAINTY_KEYS[d.certainty])}
              </span>
              <span className="text-slate-300">
                {t(DEVIATION_KEYS[d.kind]).replace("{v}", detailText(d))}
              </span>
            </li>
          ))}
        </ul>
      ) : verdict === "unknown" ? (
        <p className="text-xs text-slate-500">{t("exec.unknownHint")}</p>
      ) : null}
      {failed && <p className="text-xs text-red-400">{t("exec.overrideFailed")}</p>}
    </div>
  );
}
