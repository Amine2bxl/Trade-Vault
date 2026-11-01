import { useState } from "react";
import { Check, X } from "@/shared/ui/icons";
import { Button, Card, Chip, CHIP_ROW, ChoiceGroup, Field, Textarea } from "@/shared/ui";
import { cn } from "@/shared/ui/cn";
import type { Trade } from "@/domain/trade";
import { useT } from "@/app/i18n/LanguageContext";
import { GatePreview, HistoryLine, SectionLabel, TradeLines } from "./checklistParts";
import { BREACH_KEYS, END_KEYS } from "./checklistLabels";
import EntryGate from "./EntryGate";
import {
  BREACHES,
  type Breach,
  type DayAction,
  type DayFacts,
  type GateQuestion,
  type PlanHistory,
  type SessionDay,
} from "./sessionPlan";

/**
 * BILAN puis SÉANCE CLOSE.
 *
 * Le bilan confronte chaque trade au plan, pré-coche les écarts que les
 * données montrent déjà, et demande une phrase. Une fois clos, il se
 * transforme en entrée du journal en un clic : trade ou setup manqué, le
 * formulaire s'ouvre déjà rempli — l'encodage n'a plus d'excuse pour ne pas
 * se faire.
 */

interface ReviewProps {
  day: SessionDay;
  facts: DayFacts;
  act: (a: DayAction) => SessionDay;
  /** Écarts que les données montrent déjà, proposés au « non ». */
  observed: Breach[];
  onClose: () => void;
}

export function ReviewCard({ day, facts, act, observed, onClose }: ReviewProps) {
  const { t } = useT();
  const { review } = day;
  const setReview = (patch: Partial<SessionDay["review"]>) => act({ type: "setReview", patch });
  return (
    <Card variant="glass" pad="default" className="space-y-4">
      <div>
        <h2 className="tv-title">{t("chk.reviewTitle")}</h2>
        {day.endReason && (
          <p className="tv-row-label">
            {t(END_KEYS[day.endReason])}
            {day.endedAt ? ` · ${day.endedAt}` : ""}
          </p>
        )}
      </div>

      {facts.count > 0 ? (
        <TradeLines facts={facts} plan={day.plan} scenario={day.scenario} />
      ) : (
        <p className="text-xs text-slate-400">{t("chk.reviewNoTrades")}</p>
      )}

      {day.planChanges.length > 0 && (
        <div className="space-y-1">
          <span className="tv-label text-amber-300">{t("chk.brPlanChanged")}</span>
          <ul className="space-y-0.5">
            {day.planChanges.map((c, i) => (
              <li key={i} className="text-xs text-slate-300">
                <span className="tv-figure tv-figure-secondary mr-2 text-slate-500">{c.at}</span>
                {c.reason ? t("chk.quoted").replace("{text}", c.reason) : "—"}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Field label={t("chk.respected")}>
        <ChoiceGroup<"yes" | "no">
          label={t("chk.respected")}
          value={review.respected === null ? null : review.respected ? "yes" : "no"}
          options={[
            { value: "yes", label: t("chk.yes"), tone: "positive" },
            { value: "no", label: t("chk.no"), tone: "negative" },
          ]}
          onChange={(v) =>
            setReview(
              v === "yes"
                ? { respected: true }
                : // Les écarts que les données montrent déjà sont proposés : le
                  // trader corrige, il ne retape pas.
                  {
                    respected: false,
                    breaches: review.breaches.length > 0 ? review.breaches : observed,
                  },
            )
          }
        />
      </Field>

      {review.respected === false && (
        <Field label={t("chk.breaches")}>
          <div className={CHIP_ROW}>
            {BREACHES.map((b) => {
              const on = review.breaches.includes(b);
              return (
                <Chip
                  key={b}
                  tone="danger"
                  selected={on}
                  onClick={() =>
                    setReview({
                      breaches: on
                        ? review.breaches.filter((x) => x !== b)
                        : [...review.breaches, b],
                    })
                  }
                >
                  {t(BREACH_KEYS[b])}
                </Chip>
              );
            })}
          </div>
        </Field>
      )}

      <Field label={t("chk.lesson")} htmlFor="chk-note">
        <Textarea
          id="chk-note"
          rows={2}
          value={review.note}
          placeholder={t("chk.notePh")}
          onChange={(e) => setReview({ note: e.target.value })}
        />
      </Field>

      <Button className="w-full" disabled={review.respected === null} onClick={onClose}>
        {t("chk.closeSession")}
      </Button>
    </Card>
  );
}

interface ClosedProps {
  day: SessionDay;
  facts: DayFacts;
  history: PlanHistory;
  onReopen: () => void;
  onJournal: () => void;
  onEncodeTrade: () => void;
  /** Ajoute le bilan à un trade déjà au journal (saisi ou importé). */
  onReviewTrade: (trade: Trade, index: number) => void;
  /** Questions d'entrée de la prochaine séance, et leur réglage. */
  questions: GateQuestion[];
  onCustomize: () => void;
  onEncodeMissed: () => void;
}

export function ClosedCard({
  day,
  facts,
  history,
  onReopen,
  onJournal,
  onEncodeTrade,
  onEncodeMissed,
  onReviewTrade,
  questions,
  onCustomize,
}: ClosedProps) {
  const { t } = useT();
  const [trying, setTrying] = useState(false);
  const { review } = day;
  const directional = day.plan.bias === "long" || day.plan.bias === "short";
  // Le geste le plus probable passe devant : un setup parti sans soi se note
  // comme setup manqué, une séance sans trade encodé appelle son trade.
  const missedFirst = day.endReason === "missed";
  const hasTrades = facts.count > 0;
  return (
    <Card variant="glass" pad="default" className="space-y-4">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-xl",
            review.respected
              ? "tv-accent-fill"
              : "border border-red-500/30 bg-red-500/10 text-red-400",
          )}
        >
          {review.respected ? (
            <Check className="h-4 w-4" strokeWidth={3} />
          ) : (
            <X className="h-4 w-4" strokeWidth={3} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="tv-title">{t("chk.closedTitle")}</h2>
          <p className="tv-row-label">
            {review.respected ? t("chk.closedYes") : t("chk.closedNo")}
            {review.breaches.length > 0 &&
              ` · ${review.breaches.map((b) => t(BREACH_KEYS[b])).join(", ")}`}
          </p>
        </div>
      </div>
      {review.note.trim() && (
        <p className="text-sm text-slate-200">
          {t("chk.quoted").replace("{text}", review.note.trim())}
        </p>
      )}
      <section className="space-y-2.5">
        <SectionLabel>{t("chk.encodeTitle")}</SectionLabel>
        <p className="tv-prose text-slate-400">
          {hasTrades ? t("chk.encodeHintTrades") : t("chk.encodeHint")}
        </p>
        {/* Le trade est déjà au journal (saisi, ou importé du broker) : on
            lui AJOUTE le bilan. En créer un second fausserait toutes les
            statistiques du jour. */}
        {hasTrades && (
          <TradeLines
            facts={facts}
            plan={day.plan}
            scenario={day.scenario}
            action={(tr, i) => (
              <Button variant="accent" size="sm" onClick={() => onReviewTrade(tr, i)}>
                {t("chk.reviewTrade")}
              </Button>
            )}
          />
        )}
        <div
          className={cn("grid gap-2 sm:grid-cols-2", missedFirst && "[&>*:first-child]:order-2")}
        >
          {directional && (
            <Button
              variant={missedFirst || hasTrades ? "subtle" : "accent"}
              onClick={onEncodeTrade}
            >
              {hasTrades ? t("chk.encodeAnother") : t("chk.encodeTrade")}
            </Button>
          )}
          <Button variant={missedFirst ? "accent" : "subtle"} onClick={onEncodeMissed}>
            {t("chk.encodeMissed")}
          </Button>
        </div>
      </section>

      <HistoryLine history={history} />

      {/* La séance est close, mais la suivante se prépare d'ici : on revoit
          ses questions, on les ajuste, on les essaie à blanc. */}
      <section className="space-y-2.5 border-t border-[var(--tv-border)] pt-4">
        <SectionLabel>{t("chk.nextSession")}</SectionLabel>
        <p className="tv-prose text-slate-500">{t("chk.tomorrow")}</p>
        <GatePreview questions={questions} onCustomize={onCustomize} hideList={trying}>
          {questions.length > 0 && (
            <EntryGate
              questions={questions}
              blocked={null}
              onGo={() => {}}
              practice
              onOpenChange={setTrying}
            />
          )}
        </GatePreview>
      </section>
      <div className="flex flex-wrap gap-2">
        <Button variant="subtle" size="sm" onClick={onJournal}>
          {t("chk.journal")}
        </Button>
        <Button variant="subtle" size="sm" onClick={onReopen}>
          {t("chk.reopenReview")}
        </Button>
      </div>
    </Card>
  );
}
