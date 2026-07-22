import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "../contexts/AuthContext";
import { useAccounts } from "../contexts/AccountContext";
import { useT } from "../i18n/LanguageContext";
import { useToast } from "../contexts/ToastContext";
import { useConfirm } from "../contexts/ConfirmContext";
import type { Trade } from "../types";
import { computeStats } from "../utils/tradeCalcs";
import { computeQuantStats } from "../utils/quantStats";
import { loadStartingBalance } from "../store";
import { sendPushToSelf } from "@/backend/push.functions";
import {
  HORIZON,
  type GoalDef,
  type GoalPlan,
  type MeasureCtx,
  currentMonthIndex,
  deleteGoalPlan,
  loadGoalPlan,
  monthTaskCompletion,
  saveGoalPlan,
  setTaskDone,
} from "../utils/goalPlan";

// Goals 2.0 — pick SEVERAL fully customizable goals at once; TradeVault
// generates a progressive 6-month action plan: per-goal milestones + concrete
// monthly tasks, checkable and persisted, with push reminders.

import { GoalPicker, PlanView } from "./goals/views";
import { PageHeader } from "@/shared/ui";

export default function Goals({ trades }: { trades: Trade[] }) {
  const { user } = useAuth();
  const { activeId } = useAccounts();
  const { lang, t } = useT();
  const { toast } = useToast();
  const confirm = useConfirm();
  const fr = lang === "fr";
  const tr = useCallback((f: string, e: string) => (fr ? f : e), [fr]);
  const sendPush = useServerFn(sendPushToSelf);

  const [plan, setPlan] = useState<GoalPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingBalance, setStartingBalance] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    Promise.all([loadGoalPlan(user.id), loadStartingBalance(user.id)])
      .then(([p, b]) => {
        if (!active) return;
        setPlan(p);
        setStartingBalance(b);
      })
      .catch((e) => console.error("Failed to load goal plan", e))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user?.id, activeId]);

  const stats = useMemo(() => computeStats(trades), [trades]);
  const quant = useMemo(
    () => computeQuantStats(trades, startingBalance),
    [trades, startingBalance],
  );
  const journalRate = useMemo(
    () =>
      trades.length === 0
        ? 0
        : trades.filter((x) => x.notes.trim().length > 0).length / trades.length,
    [trades],
  );
  const ctx: MeasureCtx = useMemo(
    () => ({ stats, quant, startingBalance, journalRate }),
    [stats, quant, startingBalance, journalRate],
  );

  const generate = useCallback(
    async (goals: GoalDef[]) => {
      if (!user || busy || goals.length === 0) return;
      setBusy(true);
      const p: GoalPlan = {
        goals,
        startedAt: new Date().toISOString().slice(0, 10),
        horizonMonths: HORIZON,
        tasksDone: {},
      };
      try {
        await saveGoalPlan(user.id, p);
        setPlan(p);
        toast(
          tr(
            "Plan d'action généré — 6 mois, c'est parti !",
            "Action plan generated — 6 months, let's go!",
          ),
          "success",
        );
        // Confirmation push (mobile + desktop) — best-effort.
        sendPush({
          data: {
            title: tr("Ton plan d'action est prêt 🎯", "Your action plan is ready 🎯"),
            body: tr(
              `${goals.length} objectif(s), ${HORIZON} étapes mensuelles. Première mission : les tâches de ce mois-ci.`,
              `${goals.length} goal(s), ${HORIZON} monthly steps. First mission: this month's tasks.`,
            ),
            url: "/",
          },
        }).catch(() => {});
      } catch (e) {
        console.error("Failed to save goal plan", e);
        toast(t("app.saveTradeFailed"), "error");
      } finally {
        setBusy(false);
      }
    },
    [user, busy, toast, tr, t, sendPush],
  );

  const removePlan = useCallback(async () => {
    if (!user || busy || !plan) return;
    if (
      !(await confirm(
        tr(
          "Supprimer ce plan et repartir de zéro ? La progression des tâches sera perdue.",
          "Delete this plan and start over? Task progress will be lost.",
        ),
        { danger: true },
      ))
    )
      return;
    setBusy(true);
    try {
      await deleteGoalPlan(user.id);
      setPlan(null);
    } catch (e) {
      console.error("Failed to delete goal plan", e);
    } finally {
      setBusy(false);
    }
  }, [user, busy, plan, confirm, tr]);

  const toggleTask = useCallback(
    async (key: string, done: boolean) => {
      if (!user || !plan) return;
      // Optimistic — revert on failure.
      const prev = plan;
      const optimistic = {
        ...plan,
        tasksDone: done
          ? { ...plan.tasksDone, [key]: true }
          : Object.fromEntries(Object.entries(plan.tasksDone).filter(([k]) => k !== key)),
      };
      setPlan(optimistic);
      try {
        await setTaskDone(user.id, prev, key, done);
        // All tasks of the current month just completed → celebrate + push.
        const i = currentMonthIndex(optimistic);
        if (done && monthTaskCompletion(optimistic, i) === 1) {
          toast(
            tr(
              "Toutes les tâches du mois validées — énorme ! 🔥",
              "All of this month's tasks done — huge! 🔥",
            ),
            "success",
          );
          sendPush({
            data: {
              title: tr("Mois validé 🔥", "Month complete 🔥"),
              body: tr(
                `Étape ${i + 1}/${optimistic.horizonMonths} : toutes les actions sont faites. Le plan avance.`,
                `Step ${i + 1}/${optimistic.horizonMonths}: every action done. The plan is moving.`,
              ),
              url: "/",
            },
          }).catch(() => {});
        }
      } catch (e) {
        console.error("Failed to toggle task", e);
        setPlan(prev);
      }
    },
    [user, plan, toast, tr, sendPush],
  );

  const updateManualValue = useCallback(
    async (goalId: string, value: number) => {
      if (!user || !plan) return;
      const next: GoalPlan = {
        ...plan,
        goals: plan.goals.map((g) => (g.id === goalId ? { ...g, manualValue: value } : g)),
      };
      setPlan(next);
      try {
        await saveGoalPlan(user.id, next);
      } catch (e) {
        console.error("Failed to update goal value", e);
      }
    },
    [user, plan],
  );

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <div className="glass rounded-3xl p-10 flex justify-center">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <PageHeader
        className="mb-6"
        title={tr("Objectifs", "Goals")}
        subtitle={tr(
          "Choisis tes objectifs — TradeVault génère ton plan d'action mensuel, concret et progressif.",
          "Pick your goals — TradeVault generates your concrete, progressive monthly action plan.",
        )}
      />

      {!plan ? (
        <GoalPicker ctx={ctx} fr={fr} busy={busy} onGenerate={generate} />
      ) : (
        <PlanView
          plan={plan}
          ctx={ctx}
          fr={fr}
          lang={lang}
          busy={busy}
          onDelete={removePlan}
          onToggleTask={toggleTask}
          onManualValue={updateManualValue}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Goal picker (multi-select) ───────────────────────── */
