import { useEffect, useMemo, useReducer, useState } from "react";
import { computeEdgeScore, EDGE_WINDOW_DAYS, type EdgeResult } from "@/domain/edgeScore";
import { loadStartingBalance } from "../store";
import { loadTradingPlan } from "./tradingPlan";
import type { Trade } from "../types";
import { localDateOf } from "@/shared/calendar-date";
import { useLiveTable } from "../hooks/useLiveTable";
import { useVerifiedBalances } from "./useBalanceLedger";

/**
 * Edge Score — hook PARTAGÉ, sur le modèle de `useGoalProgress`.
 *
 * POURQUOI CE HOOK EXISTE. L'Edge Score est l'indicateur de tête du tableau de
 * bord : le premier chiffre que le trader voit à chaque session. Il était
 * calculé uniquement dans `Dashboard.tsx`, avec ses trois entrées assemblées
 * sur place — donc **Jarvis l'ignorait complètement**. Un trader qui demandait
 * « pourquoi mon Edge Score baisse ? » recevait la réponse d'un coach qui ne
 * savait pas ce qu'est cet indicateur.
 *
 * Rassembler la préparation des entrées ici est le seul moyen d'y donner accès
 * sans la recopier. Recopier aurait garanti la divergence : deux assemblages du
 * même score finissent toujours par différer, et un chiffre qui diffère entre
 * deux écrans détruit la confiance — la règle n°1 du projet.
 */

/**
 * Taux de complétion de la checklist par jour, sur la fenêtre de l'Edge Score.
 *
 * Lit exactement les clés que la page Checklist écrit (`tv-chk-{uid}-{date}`).
 * Une journée verrouillée compte pour 1 : verrouiller EST l'engagement, quel
 * que soit le nombre de cases cochées ensuite.
 */
export function readChecklistByDay(
  userId: string | null | undefined,
  today: Date = new Date(),
): Record<string, number> {
  const map: Record<string, number> = {};
  if (!userId || typeof localStorage === "undefined") return map;
  for (let i = 0; i < EDGE_WINDOW_DAYS; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = localDateOf(d);
    try {
      const raw = localStorage.getItem(`tv-chk-${userId}-${iso}`);
      if (!raw) continue;
      const p = JSON.parse(raw) as { locked?: boolean; checked?: boolean[] };
      if (p.locked) map[iso] = 1;
      else if (Array.isArray(p.checked) && p.checked.length > 0)
        map[iso] = p.checked.filter(Boolean).length / p.checked.length;
    } catch {
      /* entrée corrompue — ignorée, jamais bloquante */
    }
  }
  return map;
}

export function useEdgeScore(trades: Trade[], userId: string | null | undefined): EdgeResult {
  const [startingBalance, setStartingBalance] = useState(0);
  const [maxRiskPct, setMaxRiskPct] = useState<number | null>(null);
  // Plan ou solde changés sur un autre appareil : le score suit.
  const [liveRev, bumpLive] = useReducer((n: number) => n + 1, 0);
  useLiveTable("profiles", bumpLive);
  useLiveTable("accounts", bumpLive);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void Promise.allSettled([
      loadStartingBalance(userId).then((b) => {
        if (active) setStartingBalance(b);
      }),
      loadTradingPlan(userId).then((p) => {
        if (!active) return;
        const pct = parseFloat(p.risk.maxRiskPerTradePct);
        setMaxRiskPct(Number.isFinite(pct) && pct > 0 ? pct : null);
      }),
    ]);
    return () => {
      active = false;
    };
  }, [userId, liveRev]);

  const checklistByDay = useMemo(() => readChecklistByDay(userId), [userId]);

  // Soldes avant entrée PROUVÉS seulement. Le risque reste UNKNOWN tant que
  // la limite du plan n'est pas, elle aussi, historiquement datée
  // (`riskPlanVersionVerified`) : un solde exact ne suffit pas à juger une
  // règle qui n'existait peut-être pas encore.
  const verified = useVerifiedBalances(trades);
  return useMemo(
    () =>
      computeEdgeScore(trades, {
        maxRiskPct,
        startingBalance,
        checklistByDay,
        verifiedBalanceBeforeTrade: Object.fromEntries(verified),
      }),
    [trades, maxRiskPct, startingBalance, checklistByDay, verified],
  );
}
