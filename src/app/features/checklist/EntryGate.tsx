import { useMemo, useState } from "react";
import { Button, ChoiceGroup } from "@/shared/ui";
import { cn } from "@/shared/ui/cn";
import { useT } from "@/app/i18n/LanguageContext";
import { gateQuestions, gateVerdict, type GateQuestion, type SessionPlan } from "./sessionPlan";

/**
 * La porte d'entrée — l'interaction qui compte, au moment où elle compte.
 *
 * Les erreurs des journaux se jouent dans les secondes qui précèdent le clic :
 * entrée chassée, retournement de biais, stop serré « pour voir ». Une case
 * cochée le matin ne pèse rien à ce moment-là. Ici, chaque question reprend le
 * chiffre que le trader a écrit (« Prix dans ta zone : FVG 21 520 ? ») : on y
 * répond en regardant le graphique, pas par réflexe. Un seul « non » ferme la
 * porte, sans discussion ni texte à lire.
 */

interface Props {
  plan: SessionPlan;
  customTitles: string[];
  /** Raison qui interdit toute entrée, déjà formulée ; `null` si rien ne bloque. */
  blocked: string | null;
  onLogTrade: () => void;
}

export default function EntryGate({ plan, customTitles, blocked, onLogTrade }: Props) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const questions = useMemo(() => gateQuestions(customTitles), [customTitles]);
  const verdict = gateVerdict(questions, answers);

  const close = () => {
    setOpen(false);
    setAnswers({});
  };

  const bias = plan.bias === "long" ? t("common.long") : t("common.short");
  const label = (q: GateQuestion): string => {
    switch (q.kind) {
      case "direction":
        return t("chk.gateDirection").replace("{bias}", bias.toUpperCase());
      case "entry":
        return t("chk.gateEntry").replace("{entry}", plan.entry.trim());
      case "stop":
        return t("chk.gateStop").replace("{inv}", plan.invalidation.trim());
      case "size":
        return t("chk.gateSize").replace("{risk}", plan.risk.trim());
      case "custom":
        return q.text ?? "";
    }
  };

  if (!open) {
    return (
      <Button
        className="h-12 w-full text-sm font-bold"
        disabled={blocked !== null}
        onClick={() => setOpen(true)}
      >
        {t("chk.wantEntry")}
      </Button>
    );
  }

  return (
    <div className="space-y-2" role="group" aria-label={t("chk.wantEntry")}>
      <ol className="space-y-1.5">
        {questions.map((q, i) => (
          <li
            key={q.id}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-2",
              answers[q.id] === false
                ? "border-red-500/30 bg-red-500/10"
                : "border-[var(--tv-border)] bg-[var(--tv-plate-2)]",
            )}
          >
            <span className="tv-figure tv-figure-secondary w-4 shrink-0 text-xs text-slate-500">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 text-sm text-slate-200">{label(q)}</span>
            <ChoiceGroup
              label={label(q)}
              value={answers[q.id] === undefined ? null : answers[q.id] ? "yes" : "no"}
              options={[
                { value: "yes", label: t("chk.yes"), tone: "positive" },
                { value: "no", label: t("chk.no"), tone: "negative" },
              ]}
              onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v === "yes" }))}
              className="shrink-0"
            />
          </li>
        ))}
      </ol>

      {verdict === "no" && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5">
          <span className="flex-1 text-sm font-bold text-red-300">{t("chk.gateNo")}</span>
          <Button variant="subtle" size="sm" onClick={close}>
            {t("common.close")}
          </Button>
        </div>
      )}
      {verdict === "go" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--tv-border-accent)] bg-[rgb(var(--tv-accent-rgb)/0.10)] px-3 py-2.5">
          <span className="flex-1 text-sm font-bold text-[var(--tv-highlight)]">
            {t("chk.gateGo")}
          </span>
          <Button
            size="sm"
            onClick={() => {
              close();
              onLogTrade();
            }}
          >
            {t("chk.logTrade")}
          </Button>
        </div>
      )}
      {verdict === "pending" && (
        <Button variant="subtle" size="sm" onClick={close}>
          {t("common.cancel")}
        </Button>
      )}
    </div>
  );
}
