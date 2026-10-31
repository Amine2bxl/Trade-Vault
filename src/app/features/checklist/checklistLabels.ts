import { useMemo } from "react";
import { useT } from "@/app/i18n/LanguageContext";
import { intlLocale } from "@/app/i18n/locale";
import type { TKey } from "@/app/i18n/translations";
import type { Trade } from "@/app/types";
import type { EmotionalState } from "@/app/trading/readiness";
import type { Bias, Breach, EndReason, PlanField } from "./sessionPlan";

/* ══ Libellés et formats partagés par les écrans de la checklist ══
   À part des composants : un fichier de composants n'exporte que des
   composants (rafraîchissement à chaud). */

export const MOOD_KEYS: Record<EmotionalState, TKey> = {
  calm: "session.stateCalm",
  focused: "session.stateFocused",
  tired: "session.stateTired",
  anxious: "session.stateAnxious",
  frustrated: "session.stateFrustrated",
  overconfident: "session.stateOverconfident",
};

export const FIELD_KEYS: Record<PlanField, TKey> = {
  bias: "chk.fBias",
  narrative: "chk.fNarrative",
  target: "chk.fTarget",
  entry: "chk.fEntry",
  invalidation: "chk.fInvalidation",
  risk: "chk.fRisk",
  altCondition: "chk.fAltCondition",
  altBias: "chk.fAltBias",
  altTarget: "chk.fAltTarget",
  mood: "chk.fMood",
};

export const BREACH_KEYS: Record<Breach, TKey> = {
  direction: "chk.brDirection",
  chased: "chk.brChased",
  size: "chk.brSize",
  extra: "chk.brExtra",
  window: "chk.brWindow",
  stopMoved: "chk.brStopMoved",
  planChanged: "chk.brPlanChanged",
};

export const END_KEYS: Record<EndReason, TKey> = {
  missed: "chk.endMissed",
  invalidated: "chk.endInvalidated",
  done: "chk.endDone",
};

export const DIRECTION_KEYS: Record<Trade["direction"], TKey> = {
  long: "common.long",
  short: "common.short",
  be: "common.be",
};

/** Le sens en un mot : LONG, SHORT, ou OBSERVATION. */
export function useBiasWord() {
  const { t } = useT();
  return (b: Bias | null) =>
    b === "long"
      ? t("common.long").toUpperCase()
      : b === "short"
        ? t("common.short").toUpperCase()
        : t("chk.observation");
}

/** Couleur d'un sens : la convention long/short du journal, rien de plus. */
export const biasTone = (b: Bias | null) =>
  b === "long" ? "text-emerald-400" : b === "short" ? "text-red-400" : "text-slate-300";

export function useRFormat() {
  const { lang } = useT();
  return useMemo(
    () =>
      new Intl.NumberFormat(intlLocale(lang), {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    [lang],
  );
}
