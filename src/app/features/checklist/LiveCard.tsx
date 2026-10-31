import { useEffect, useState } from "react";
import { Button, Card, Textarea } from "@/shared/ui";
import { cn } from "@/shared/ui/cn";
import { useT } from "@/app/i18n/LanguageContext";
import { RRBadge, TradeLines } from "./checklistParts";
import { biasTone, END_KEYS, useBiasWord } from "./checklistLabels";
import EntryGate from "./EntryGate";
import {
  activePlan,
  altComplete,
  CHANGE_COOLDOWN_S,
  MIN_CHANGE_REASON,
  planRR,
  type Blocker,
  type DayFacts,
  type EndReason,
  type GateQuestion,
  type SessionDay,
} from "./sessionPlan";

/**
 * SÉANCE — l'écran qu'on garde ouvert à côté du graphique.
 *
 * Tout ce qui sert à décider se lit d'un coup d'œil (sens, pourquoi, niveaux,
 * R:R, trades restants, ce qui bloque). Trois gestes y sont rapides : la porte
 * d'entrée, l'encodage d'un trade, le passage au scénario B écrit le matin.
 * Un seul est volontairement lent : changer de plan sans l'avoir prévu.
 */

interface Props {
  day: SessionDay;
  facts: DayFacts;
  blockers: Blocker[];
  blockerText: (b: Blocker) => string;
  questions: GateQuestion[];
  minRR: number | null;
  onLogTrade: () => void;
  onSwitchB: () => void;
  onEnd: (reason: EndReason) => void;
  onChangePlan: (reason: string) => void;
}

export default function LiveCard({
  day,
  facts,
  blockers,
  blockerText,
  questions,
  minRR,
  onLogTrade,
  onSwitchB,
  onEnd,
  onChangePlan,
}: Props) {
  const { t } = useT();
  const biasWord = useBiasWord();
  const plan = activePlan(day);
  const observation = plan.bias === "none";
  const rr = planRR(plan);
  const first = blockers[0];

  return (
    <Card variant="glass" pad="default" className="space-y-4">
      {/* ══ Le plan en vigueur ══ */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className={cn("text-2xl font-extrabold tracking-[-0.02em]", biasTone(plan.bias))}>
              {biasWord(plan.bias)}
            </span>
            {!observation && (
              <span className="tv-label text-slate-500">
                {day.scenario === "B" ? t("chk.scenarioB") : t("chk.scenarioA")}
              </span>
            )}
          </div>
          <p className="tv-row-label">
            {t("chk.lockedAt").replace("{time}", day.lockedAt ?? "—")}
            {day.planChanges.length > 0 &&
              ` · ${t("chk.changed").replace("{n}", String(day.planChanges.length))}`}
            {day.scenarioAt && ` · ${t("chk.altActive").replace("{time}", day.scenarioAt)}`}
          </p>
        </div>
        {!observation && (
          <div className="text-right">
            <div className="tv-figure text-xl text-white">
              {facts.count}/{plan.maxTrades}
            </div>
            <span className="tv-label text-slate-500">{t("chk.trades")}</span>
          </div>
        )}
      </div>

      {plan.narrative.trim() && (
        <p className="border-l-2 border-[var(--tv-border-strong)] pl-3 text-sm text-slate-300">
          {plan.narrative.trim()}
        </p>
      )}

      {!observation && (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["chk.target", plan.target],
                ["chk.entry", plan.entry],
                ["chk.invalidation", plan.invalidation],
                ["chk.risk", plan.risk],
              ] as const
            ).map(([k, v]) => (
              <div
                key={k}
                className="min-w-0 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-3 py-2"
              >
                <dt className="tv-label text-slate-500">{t(k)}</dt>
                <dd className="truncate text-sm font-semibold text-white">{v.trim()}</dd>
              </div>
            ))}
          </dl>
          {rr !== null && <RRBadge rr={rr} low={minRR !== null && rr < minRR} />}
        </>
      )}

      {/* ══ Ce qui bloque — ou rien ══ */}
      <p
        className={cn(
          "text-sm font-semibold",
          !first
            ? "text-[var(--tv-highlight)]"
            : // Ne pas trader était le plan : un choix tenu, pas une alerte.
              first === "observation"
              ? "text-slate-300"
              : first === "window"
                ? "text-amber-300"
                : "text-red-400",
        )}
      >
        {first ? blockerText(first) : t("chk.readyLine")}
      </p>

      <TradeLines facts={facts} plan={day.plan} scenario={day.scenario} onlyOff />

      {!observation && (
        <div className="space-y-2">
          <EntryGate
            questions={questions}
            blocked={first ? blockerText(first) : null}
            onGo={onLogTrade}
          />
          {/* Encoder un trade ne demande jamais de repasser par la porte : le
              trade est pris, il doit entrer au journal sans détour. */}
          <Button variant="subtle" size="sm" className="w-full" onClick={onLogTrade}>
            {t("chk.logTradeQuick")}
          </Button>
        </div>
      )}

      {/* ══ Scénario B : prévu, donc immédiat ══ */}
      {day.scenario === "A" && altComplete(day.plan.alt) && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
          <div className="min-w-0 flex-1">
            <p className="tv-label text-slate-500">{t("chk.scenarioB")}</p>
            <p className="text-sm text-slate-200">
              {t("chk.altReady")
                .replace("{condition}", day.plan.alt.condition.trim())
                .replace("{bias}", biasWord(day.plan.alt.bias))
                .replace("{target}", day.plan.alt.target.trim())}
            </p>
          </div>
          <Button variant="accent" size="sm" className="shrink-0" onClick={onSwitchB}>
            {t("chk.altSwitch")}
          </Button>
        </div>
      )}

      <div className="space-y-2 border-t border-[var(--tv-border)] pt-3">
        <span className="tv-label text-slate-500">{t("chk.end")}</span>
        <div className="flex flex-wrap gap-2">
          {(observation ? (["done"] as const) : (["missed", "invalidated", "done"] as const)).map(
            (r) => (
              <Button key={r} variant="subtle" size="sm" onClick={() => onEnd(r)}>
                {t(END_KEYS[r])}
              </Button>
            ),
          )}
        </div>
      </div>

      <ChangePlanPanel onConfirm={onChangePlan} />
    </Card>
  );
}

/**
 * Changer de plan en séance — le seul geste lent de l'écran, et c'est voulu.
 *
 * Les journaux le montrent : la perte typique commence par un biais retourné
 * EN SÉANCE (« ah non, finalement… »). Le geste reste possible, mais il coûte :
 * un motif écrit d'au moins `MIN_CHANGE_REASON` caractères, puis une attente de
 * `CHANGE_COOLDOWN_S` secondes avant de pouvoir confirmer. Le motif est gardé
 * et relu au bilan. Le compte à rebours est un texte, pas une animation.
 */
function ChangePlanPanel({ onConfirm }: { onConfirm: (reason: string) => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [left, setLeft] = useState(CHANGE_COOLDOWN_S);

  useEffect(() => {
    if (!open || left <= 0) return;
    const id = window.setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [open, left]);

  const close = () => {
    setOpen(false);
    setReason("");
    setLeft(CHANGE_COOLDOWN_S);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="-my-2 inline-flex min-h-[36px] items-center text-xs font-semibold text-slate-500 underline decoration-dotted underline-offset-2 hover:text-slate-300"
      >
        {t("chk.changePlan")}
      </button>
    );
  }

  const short = MIN_CHANGE_REASON - reason.trim().length;
  const ready = short <= 0 && left <= 0;
  return (
    <div className="space-y-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
      <p className="text-sm font-bold text-amber-300">{t("chk.changeTitle")}</p>
      <p className="tv-prose text-slate-300">{t("chk.changeHint")}</p>
      <Textarea
        rows={2}
        value={reason}
        autoFocus
        aria-label={t("chk.changeReasonPh")}
        placeholder={t("chk.changeReasonPh")}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="tv-num flex-1 text-xs text-slate-400">
          {short > 0
            ? t("chk.changeTooShort").replace("{n}", String(short))
            : left > 0
              ? t("chk.changeWait").replace("{s}", String(left))
              : ""}
        </span>
        <Button variant="subtle" size="sm" onClick={close}>
          {t("common.cancel")}
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={!ready}
          onClick={() => {
            onConfirm(reason.trim());
            close();
          }}
        >
          {t("common.confirm")}
        </Button>
      </div>
    </div>
  );
}
