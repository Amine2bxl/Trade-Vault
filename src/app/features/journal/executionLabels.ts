import type { TKey } from "@/app/i18n/translations";
import type { ExecutionVerdict } from "@/modules/discipline";

/** Libellés et teintes du verdict d'exécution — partagés par le détail d'un trade et le bilan. */
export const VERDICT_KEYS: Record<ExecutionVerdict, TKey> = {
  good_execution: "exec.good",
  bad_execution: "exec.bad",
  unknown: "exec.unknown",
};

export function verdictTone(v: ExecutionVerdict | "good_discipline"): string {
  return v === "bad_execution"
    ? "border-red-500/30 bg-red-500/10 text-red-300"
    : v === "unknown"
      ? "border-[var(--tv-border)] text-slate-400"
      : "border-[var(--tv-border-accent)] bg-[rgb(var(--tv-accent-rgb)/0.10)] text-[var(--tv-highlight)]";
}
