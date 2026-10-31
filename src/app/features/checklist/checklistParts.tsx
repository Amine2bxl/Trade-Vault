import { useMemo } from "react";
import { cn } from "@/shared/ui/cn";
import { useT } from "@/app/i18n/LanguageContext";
import { intlLocale } from "@/app/i18n/locale";
import type { TKey } from "@/app/i18n/translations";
import { measuredR } from "@/domain/trade";
import { BREACH_KEYS, DIRECTION_KEYS, useRFormat } from "./checklistLabels";
import {
  tradeBreaches,
  type DayFacts,
  type PlanHistory,
  type Scenario,
  type SessionDay,
  type SessionMemory,
  type SessionPlan,
} from "./sessionPlan";

/* ══ Les morceaux communs aux trois écrans de la checklist ══ */

/** Où en est la journée — trois mots, l'étape courante en clair. */
export function PhaseSteps({ phase }: { phase: SessionDay["phase"] }) {
  const { t } = useT();
  const order = ["plan", "live", "review"] as const;
  const idx = phase === "closed" ? order.length : order.indexOf(phase);
  const labels: Record<(typeof order)[number], TKey> = {
    plan: "chk.phasePlan",
    live: "chk.phaseLive",
    review: "chk.phaseReview",
  };
  return (
    <ol className="flex items-center gap-2 pl-1.5">
      {order.map((p, i) => (
        <li key={p} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden className="h-px w-4 bg-[var(--tv-border-strong)]" />}
          <span
            aria-current={i === idx ? "step" : undefined}
            className={cn(
              "tv-label",
              i === idx ? "text-white" : i < idx ? "text-[var(--tv-highlight)]" : "text-slate-500",
            )}
          >
            {t(labels[p])}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Un titre de section dans une carte : un libellé et un filet, rien d'autre. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <h3 className="tv-label shrink-0 text-slate-400">{children}</h3>
      <span aria-hidden className="h-px flex-1 bg-[var(--tv-border)]" />
    </div>
  );
}

/** Le R:R que promettent les niveaux écrits — rouge sous le minimum du plan. */
export function RRBadge({ rr, low }: { rr: number | null; low: boolean }) {
  const { t } = useT();
  const fmt = useRFormat();
  if (rr === null) return null;
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 rounded-lg border px-2 py-0.5",
        low
          ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
          : "border-[var(--tv-border)] bg-[var(--tv-plate-2)] text-slate-200",
      )}
    >
      <span className="tv-label">{t("chk.rr")}</span>
      <span className="tv-figure text-sm">{fmt.format(rr)}</span>
    </span>
  );
}

/** Les trades du jour, chacun confronté au plan écrit. */
export function TradeLines({
  facts,
  plan,
  scenario,
  onlyOff = false,
}: {
  facts: DayFacts;
  plan: SessionPlan;
  scenario: Scenario;
  onlyOff?: boolean;
}) {
  const { t, lang } = useT();
  const fmt = useMemo(
    () =>
      new Intl.NumberFormat(intlLocale(lang), {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
        signDisplay: "exceptZero",
      }),
    [lang],
  );
  const rows = facts.trades
    .map((tr, i) => ({ tr, breaches: tradeBreaches(tr, i, plan, scenario) }))
    .filter((r) => !onlyOff || r.breaches.length > 0);
  if (rows.length === 0) return null;
  const why: Record<string, TKey> = {
    direction: "chk.tbDirection",
    extra: "chk.tbExtra",
    observation: "chk.tbObservation",
  };
  return (
    <ul className="space-y-1">
      {rows.map(({ tr, breaches }) => {
        const r = measuredR(tr);
        const off = breaches.length > 0;
        return (
          <li key={tr.id} className="flex items-baseline gap-2 text-xs">
            <span className="tv-figure tv-figure-secondary w-10 shrink-0 text-slate-400">
              {tr.entryTime || "—"}
            </span>
            <span className="w-12 shrink-0 font-semibold uppercase text-slate-300">
              {t(DIRECTION_KEYS[tr.direction])}
            </span>
            <span
              className={cn(
                "tv-figure w-12 shrink-0",
                r === null ? "text-slate-500" : r >= 0 ? "text-emerald-400" : "text-red-400",
              )}
            >
              {r === null ? "—" : `${fmt.format(r)}R`}
            </span>
            <span
              className={cn(
                // Le motif se lit en entier, quitte à passer à la ligne : un
                // « hors plan · contre le bi… » ne dit pas ce qui a dérapé.
                "min-w-0 flex-1 font-semibold",
                off ? "text-red-400" : "text-[var(--tv-highlight)]",
              )}
            >
              {off
                ? `${t("chk.offPlanTag")} · ${breaches.map((b) => t(why[b])).join(", ")}`
                : t("chk.inPlanTag")}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Dans le plan / hors plan : le chiffre qui donne sa valeur au rituel. */
export function HistoryLine({ history }: { history: PlanHistory }) {
  const { t, lang } = useT();
  if (history.inPlan.n + history.offPlan.n === 0) return null;
  const fmt = new Intl.NumberFormat(intlLocale(lang), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  });
  const cell = (key: TKey, b: PlanHistory["inPlan"]) => (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-slate-400">{t(key)}</span>
      {b.avgR !== null ? (
        <span
          className={cn("tv-figure", b.avgR >= 0 ? "text-emerald-400" : "text-red-400")}
        >{`${fmt.format(b.avgR)}R`}</span>
      ) : null}
      <span className="tv-num text-slate-500">
        {b.avgR !== null
          ? `n=${b.n}`
          : t("chk.sampleLow")
              .replace("{n}", String(b.n))
              .replace("{min}", String(history.minSample))}
      </span>
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className="tv-label text-slate-500">{t("chk.history")}</span>
      {cell("chk.inPlan", history.inPlan)}
      {cell("chk.offPlan", history.offPlan)}
    </div>
  );
}

/**
 * Ce que les séances passées disent à celle-ci : la dernière leçon écrite et
 * l'écart le plus souvent déclaré. C'est le contenu qui change chaque jour —
 * ce qui empêche le plan de s'écrire par réflexe.
 */
export function MemoryLines({ memory }: { memory: SessionMemory }) {
  const { t, lang } = useT();
  if (!memory.lastLesson && !memory.topBreach) return null;
  const date = memory.lastLesson
    ? new Date(`${memory.lastLesson.date}T12:00:00`).toLocaleDateString(intlLocale(lang), {
        day: "numeric",
        month: "short",
      })
    : "";
  return (
    <div className="space-y-1.5 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-3 py-2.5">
      {memory.lastLesson && (
        <p className="text-sm text-slate-200">
          <span className="tv-label mr-2 text-[var(--tv-highlight)]">
            {t("chk.lastLesson").replace("{date}", date)}
          </span>
          {t("chk.quoted").replace("{text}", memory.lastLesson.note)}
        </p>
      )}
      {memory.topBreach && (
        <p className="text-xs text-slate-400">
          {t("chk.topBreach")
            .replace("{breach}", t(BREACH_KEYS[memory.topBreach.breach]))
            .replace("{count}", String(memory.topBreach.count))
            .replace("{n}", String(memory.topBreach.sessions))}
        </p>
      )}
    </div>
  );
}
