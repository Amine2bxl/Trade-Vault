/**
 * useAccountRules — les règles d'un compte, telles que le trader les a saisies.
 *
 * TradeVault ne code EN DUR aucune règle de prop firm : « Apex 50k = 2 500 $ de
 * drawdown » serait une affirmation que personne n'a vérifiée, et qui change
 * plusieurs fois par an selon les firmes (voir `modules/probability/rules.ts`).
 * Les règles d'un compte viennent donc d'une seule source : le SCÉNARIO que le
 * trader a enregistré dans le simulateur, où il recopie son contrat.
 *
 * Ce hook va les y chercher. Il rend `null` quand aucun scénario n'existe pour
 * ce compte — et c'est une réponse, pas un échec : le tableau de bord affiche
 * alors la courbe sans plancher et invite à saisir les règles, au lieu d'en
 * supposer.
 *
 * Le scénario le plus RÉCENT fait foi : c'est celui que le trader vient
 * d'ajuster, donc celui qui décrit son compte aujourd'hui.
 */

import { useQuery } from "@tanstack/react-query";
import { loadScenarios } from "../store/simulations";
import type { AccountRules } from "@/modules/probability/rules";

export function useAccountRules(accountId: string | null): AccountRules | null {
  const q = useQuery({
    queryKey: ["account-rules", accountId],
    enabled: Boolean(accountId),
    // Des règles de compte ne changent pas d'une minute à l'autre : un contrat
    // de prop firm se saisit une fois. Inutile de retourner voir souvent.
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const list = await loadScenarios(accountId).catch(() => []);
      if (list.length === 0) return null;
      const latest = [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      return latest.rules ?? null;
    },
  });
  return q.data ?? null;
}
