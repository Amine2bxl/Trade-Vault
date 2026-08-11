import { useEffect, useMemo, useState } from "react";
import type { Trade } from "../types";
import { computeStats } from "../utils/tradeCalcs";
import { computeQuantStats } from "../utils/quantStats";
import { loadStartingBalance } from "../store";
import { loadGoalPlan, currentGoalValue, type GoalPlan, type MeasureCtx } from "../utils/goalPlan";

/**
 * Objectifs du trader et leur progression MESURÉE.
 *
 * Pourquoi ce hook existe
 * -----------------------
 * `currentGoalValue()` a besoin d'un `MeasureCtx` complet (stats, stats
 * quantitatives, solde initial, taux de journalisation). Cette construction
 * vivait uniquement dans la page Goals. Or Jarvis en a besoin lui aussi : le
 * pipeline du coach accepte des `goals` depuis le début (`CoachInput.goals`,
 * schéma Zod, `withGoals()`, bloc ACTIVE GOALS du prompt) mais RIEN ne les lui
 * envoyait — Jarvis était donc structurellement incapable de parler des
 * objectifs du trader, alors que tout le tuyau existait.
 *
 * La recopier dans le workspace aurait créé une seconde définition de « où en
 * est cet objectif » — deux réponses possibles à la même question, qui
 * divergeraient au premier changement de formule. D'où un hook unique.
 *
 * Lecture seule et best-effort : un échec dégrade vers « pas d'objectifs »,
 * jamais vers une erreur affichée.
 */
export interface MeasuredGoal {
  kind: string;
  target: number;
  current: number;
}

export interface GoalProgress {
  plan: GoalPlan | null;
  ctx: MeasureCtx;
  /** Forme compacte attendue par le payload du coach. */
  measured: MeasuredGoal[];
  loading: boolean;
}

export function useGoalProgress(
  trades: Trade[],
  userId: string | undefined,
  /** Change quand le sous-compte actif change — force le rechargement. */
  accountId?: string | null,
): GoalProgress {
  const [plan, setPlan] = useState<GoalPlan | null>(null);
  const [startingBalance, setStartingBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sans compte actif, il n'y a pas d'objectif a charger : les plans sont
    // desormais rattaches a un compte, comme le reste des donnees.
    if (!userId || !accountId) {
      setPlan(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    Promise.all([loadGoalPlan(userId, accountId), loadStartingBalance(userId)])
      .then(([p, b]) => {
        if (!active) return;
        setPlan(p);
        setStartingBalance(b);
      })
      .catch(() => {
        /* best-effort : les objectifs enrichissent, ils ne bloquent pas */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, accountId]);

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

  const measured = useMemo<MeasuredGoal[]>(
    () =>
      (plan?.goals ?? []).map((g) => ({
        kind: g.kind,
        target: g.targetValue,
        current: currentGoalValue(g, ctx),
      })),
    [plan, ctx],
  );

  return { plan, ctx, measured, loading };
}
