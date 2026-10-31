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
  type MissedReminder,
  type SessionPlan,
} from "./sessionPlan";

/* ══ Les morceaux communs aux trois écrans de la checklist ══ */

/**
 * La journée en frise : trois étapes, chacune avec son heure — verrou du plan,
 * fenêtre de séance, fin. On voit d'un coup d'œil où l'on en est ET si le plan
 * a été écrit avant la séance.
 */
export function PhaseSteps({
  phase,
  times,
}: {
  phase: SessionDay["phase"];
  times: Partial<Record<"plan" | "live" | "review", string | null>>;
}) {
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
          {i > 0 && <span aria-hidden className="h-px w-3 bg-[var(--tv-border-strong)] sm:w-6" />}
          <span
            aria-current={i === idx ? "step" : undefined}
            className="flex flex-col leading-tight"
          >
            <span
              className={cn(
                "tv-label",
                i === idx
                  ? "text-white"
                  : i < idx
                    ? "text-[var(--tv-highlight)]"
                    : "text-slate-500",
              )}
            >
              {t(labels[p])}
            </span>
            {times[p] && (
              <span className="tv-figure tv-figure-secondary tv-hint leading-tight">
                {times[p]}
              </span>
            )}
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
 * Ce que les séances passées disent à celle-ci : la dernière leçon du bilan,
 * le « la prochaine fois » du dernier setup manqué, et trois comptes — plan
 * respecté, plan verrouillé avant l'open, écart le plus fréquent. C'est le
 * contenu qui change chaque jour : ce qui empêche le plan de s'écrire par
 * réflexe. Chaque compte porte son dénominateur.
 */
export function MemoryLines({
  memory,
  reminder,
}: {
  memory: SessionMemory;
  reminder: MissedReminder | null;
}) {
  const { t, lang } = useT();
  const counts = [memory.respected, memory.early, memory.topBreach].some(Boolean);
  if (!memory.lastLesson && !reminder && !counts) return null;
  const day = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(intlLocale(lang), {
      day: "numeric",
      month: "short",
    });
  const ratio = (yes: number, total: number) => (
    <span className="tv-figure text-slate-200">
      {yes}/{total}
    </span>
  );
  return (
    <section
      aria-label={t("chk.memoryTitle")}
      className="space-y-2.5 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-3 py-3"
    >
      <h3 className="tv-label text-slate-500">{t("chk.memoryTitle")}</h3>
      {memory.lastLesson && (
        <div className="space-y-0.5">
          <p className="tv-label text-[var(--tv-highlight)]">
            {t("chk.lastLesson").replace("{date}", day(memory.lastLesson.date))}
          </p>
          <p className="text-sm text-slate-200">
            {t("chk.quoted").replace("{text}", memory.lastLesson.note)}
          </p>
        </div>
      )}
      {reminder && (
        <div className="space-y-0.5">
          <p className="tv-label text-amber-300">
            {t(reminder.kind === "next" ? "chk.missedNext" : "chk.missedLesson").replace(
              "{date}",
              day(reminder.date),
            )}
          </p>
          {/* Les notes de setups manqués sont longues : trois lignes, le
              reste au survol. On relit l'essentiel, on ne relit pas un roman. */}
          <p className="line-clamp-3 text-sm text-slate-200" title={reminder.text}>
            {t("chk.quoted").replace("{text}", reminder.text)}
          </p>
        </div>
      )}
      {counts && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--tv-border)] pt-2 text-xs text-slate-400">
          {memory.respected && (
            <span>
              {t("chk.memRespected")} {ratio(memory.respected.yes, memory.respected.total)}
            </span>
          )}
          {memory.early && (
            <span>
              {t("chk.memEarly")} {ratio(memory.early.yes, memory.early.total)}
            </span>
          )}
          {memory.topBreach && (
            <span>
              {t("chk.memTopBreach").replace("{breach}", t(BREACH_KEYS[memory.topBreach.breach]))}{" "}
              {ratio(memory.topBreach.count, memory.topBreach.sessions)}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
