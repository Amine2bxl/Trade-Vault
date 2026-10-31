import { useState } from "react";
import {
  Button,
  Card,
  Chip,
  CHIP_ROW,
  ChoiceGroup,
  Disclosure,
  Field,
  Input,
  Textarea,
} from "@/shared/ui";
import { useT } from "@/app/i18n/LanguageContext";
import { EMOTIONAL_STATES } from "@/app/trading/readiness";
import { HistoryLine, MemoryLines, RRBadge, SectionLabel } from "./checklistParts";
import PlanLadder from "./PlanLadder";
import { planLadder } from "./ladderGeometry";
import { FIELD_KEYS, MOOD_KEYS, useBiasWord, useRFormat } from "./checklistLabels";
import {
  altStarted,
  MAX_TRADES_CHOICES,
  missingFields,
  planRR,
  planWarnings,
  RISKY_MOODS,
  type AltScenario,
  type Bias,
  type DayAction,
  type Direction,
  type PlanHistory,
  type PlanWarning,
  type SessionDay,
  type SessionMemory,
  type SessionPlan,
} from "./sessionPlan";

/**
 * PLAN — l'écran d'avant l'open. Cinq blocs, dans l'ordre où l'on prépare une
 * séance : ce que les séances passées ont appris, le contexte (news, biais et
 * POURQUOI), le scénario A avec ses niveaux, le scénario B facultatif, puis
 * le risque et l'état. Ce que l'app sait déjà (news, R:R, historique) est
 * affiché, jamais demandé.
 */

interface Props {
  day: SessionDay;
  act: (a: DayAction) => SessionDay;
  tried: boolean;
  onLock: () => void;
  news: { id: string; label: string; time: string | null }[];
  history: PlanHistory;
  memory: SessionMemory;
  /** `risk.minRR` du plan de trading ; `null` sans règle. */
  minRR: number | null;
}

export default function PlanCard({ day, act, tried, onLock, news, history, memory, minRR }: Props) {
  const { t } = useT();
  const biasWord = useBiasWord();
  const fmt = useRFormat();
  const { plan, mood } = day;
  const set = (patch: Partial<SessionPlan>) => act({ type: "setPlan", patch });
  const setAlt = (patch: Partial<AltScenario>) => act({ type: "setAlt", patch });
  const missing = missingFields(plan, mood);
  const directional = plan.bias === "long" || plan.bias === "short";
  const rr = planRR(plan);
  const ladder = planLadder(plan);
  const warnings = planWarnings(plan, minRR);
  const [altOpen, setAltOpen] = useState(() => altStarted(plan.alt));

  const warningText = (w: PlanWarning) => {
    const bias = biasWord(plan.bias);
    switch (w) {
      case "targetSide":
        return t("chk.wTargetSide").replace("{bias}", bias);
      case "invSide":
        return t("chk.wInvSide").replace("{bias}", bias);
      case "rrLow":
        return t("chk.wRrLow")
          .replace("{rr}", rr === null ? "—" : fmt.format(rr))
          .replace("{min}", minRR === null ? "—" : fmt.format(minRR));
    }
  };

  return (
    <Card variant="glass" pad="default" className="space-y-5">
      <div>
        <h2 className="tv-title">{t("chk.planTitle")}</h2>
        <p className="tv-row-label">{t("chk.planHint")}</p>
      </div>

      <MemoryLines memory={memory} />

      {/* ══ Contexte ══ */}
      <section className="space-y-3">
        <SectionLabel>{t("chk.secContext")}</SectionLabel>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="tv-label text-slate-500">{t("chk.news")}</span>
          {news.length === 0 ? (
            <span className="text-xs text-slate-400">{t("chk.newsNone")}</span>
          ) : (
            news.slice(0, 3).map((n) => (
              <span key={n.id} className="text-xs font-semibold text-red-400">
                {n.label}
                {n.time && <span className="tv-figure tv-figure-secondary"> {n.time}</span>}
              </span>
            ))
          )}
          {news.length > 3 && (
            <span className="tv-num text-xs text-slate-500">+{news.length - 3}</span>
          )}
        </div>
        <Field label={t("chk.bias")}>
          <ChoiceGroup<Bias>
            label={t("chk.bias")}
            value={plan.bias}
            options={[
              { value: "long", label: t("common.long"), tone: "positive" },
              { value: "short", label: t("common.short"), tone: "negative" },
              { value: "none", label: t("chk.biasNone") },
            ]}
            onChange={(bias) => set({ bias })}
          />
        </Field>
        {plan.bias === "none" && <p className="tv-prose text-slate-400">{t("chk.observeNote")}</p>}
        {directional && (
          <Field label={t("chk.narrative")} htmlFor="chk-narrative">
            <Textarea
              id="chk-narrative"
              rows={2}
              value={plan.narrative}
              placeholder={t("chk.narrativePh")}
              onChange={(e) => set({ narrative: e.target.value })}
            />
          </Field>
        )}
      </section>

      {directional && (
        <>
          {/* ══ Scénario A ══ */}
          <section className="space-y-3">
            <SectionLabel>{t("chk.secPlanA")}</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t("chk.target")} htmlFor="chk-target">
                <Input
                  id="chk-target"
                  value={plan.target}
                  placeholder={t("chk.targetPh")}
                  onChange={(e) => set({ target: e.target.value })}
                />
              </Field>
              <Field label={t("chk.entry")} htmlFor="chk-entry">
                <Input
                  id="chk-entry"
                  value={plan.entry}
                  placeholder={t("chk.entryPh")}
                  onChange={(e) => set({ entry: e.target.value })}
                />
              </Field>
              <Field label={t("chk.invalidation")} htmlFor="chk-inv">
                <Input
                  id="chk-inv"
                  value={plan.invalidation}
                  placeholder={t("chk.invalidationPh")}
                  onChange={(e) => set({ invalidation: e.target.value })}
                />
              </Field>
            </div>
            {/* La carte se dessine pendant la saisie : une cible du mauvais
                côté se voit avant le verrou, pas après le stop. */}
            {ladder && <PlanLadder ladder={ladder} />}
            {((rr !== null && !ladder) || warnings.length > 0) && (
              <div className="flex flex-wrap items-center gap-2">
                {/* La carte porte déjà le R de la cible ; le badge ne revient
                    que sans carte, ou pour signaler un R:R sous le minimum. */}
                {(!ladder || warnings.includes("rrLow")) && (
                  <RRBadge rr={rr} low={warnings.includes("rrLow")} />
                )}
                {warnings.map((w) => (
                  <span key={w} className="text-xs font-semibold text-amber-300">
                    {warningText(w)}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* ══ Scénario B — facultatif, mais écrit maintenant ou jamais ══ */}
          <Disclosure
            title={t("chk.secPlanB")}
            // Un B commencé mais incomplet bloque le verrou : il doit se voir.
            open={altOpen || (tried && missing.some((f) => f.startsWith("alt")))}
            onChange={setAltOpen}
          >
            <div className="space-y-3">
              <p className="tv-prose text-slate-400">{t("chk.altHint")}</p>
              <Field label={t("chk.altCondition")} htmlFor="chk-alt-cond">
                <Input
                  id="chk-alt-cond"
                  value={plan.alt.condition}
                  placeholder={t("chk.altConditionPh")}
                  onChange={(e) => setAlt({ condition: e.target.value })}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={t("chk.altBias")}>
                  <ChoiceGroup<Direction>
                    label={t("chk.altBias")}
                    value={plan.alt.bias}
                    options={[
                      { value: "long", label: t("common.long"), tone: "positive" },
                      { value: "short", label: t("common.short"), tone: "negative" },
                    ]}
                    onChange={(bias) => setAlt({ bias })}
                  />
                </Field>
                <Field label={t("chk.altTarget")} htmlFor="chk-alt-target">
                  <Input
                    id="chk-alt-target"
                    value={plan.alt.target}
                    onChange={(e) => setAlt({ target: e.target.value })}
                  />
                </Field>
                <Field label={t("chk.altEntry")} htmlFor="chk-alt-entry">
                  <Input
                    id="chk-alt-entry"
                    value={plan.alt.entry}
                    onChange={(e) => setAlt({ entry: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          </Disclosure>

          {/* ══ Risque ══ */}
          <section className="space-y-3">
            <SectionLabel>{t("chk.secRisk")}</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("chk.risk")} htmlFor="chk-risk">
                <Input
                  id="chk-risk"
                  inputMode="decimal"
                  value={plan.risk}
                  placeholder="250"
                  onChange={(e) => set({ risk: e.target.value })}
                />
              </Field>
              <Field label={t("chk.maxTrades")}>
                <ChoiceGroup<number>
                  label={t("chk.maxTrades")}
                  value={plan.maxTrades}
                  options={MAX_TRADES_CHOICES.map((n) => ({ value: n, label: String(n) }))}
                  onChange={(maxTrades) => set({ maxTrades })}
                />
              </Field>
            </div>
          </section>
        </>
      )}

      {/* ══ État ══ */}
      <section className="space-y-3">
        <SectionLabel>{t("chk.secState")}</SectionLabel>
        <div className={CHIP_ROW}>
          {EMOTIONAL_STATES.map((m) => (
            <Chip
              key={m}
              selected={mood === m}
              tone={RISKY_MOODS.includes(m) ? "warning" : "accent"}
              onClick={() => act({ type: "setMood", mood: mood === m ? null : m })}
            >
              {t(MOOD_KEYS[m])}
            </Chip>
          ))}
        </div>
        {mood && RISKY_MOODS.includes(mood) && (
          <p className="tv-prose font-semibold text-amber-300">{t("chk.moodRisky")}</p>
        )}
      </section>

      <HistoryLine history={history} />

      <div className="space-y-2">
        <Button className="h-12 w-full text-sm font-bold" onClick={onLock}>
          {plan.bias === "none" ? t("chk.lockObserve") : t("chk.lock")}
        </Button>
        {tried && missing.length > 0 && (
          <p className="tv-prose text-amber-300" role="status">
            {t("chk.missing").replace("{list}", missing.map((f) => t(FIELD_KEYS[f])).join(", "))}
          </p>
        )}
      </div>
    </Card>
  );
}
