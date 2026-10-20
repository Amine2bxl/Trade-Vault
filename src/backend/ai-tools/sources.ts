import { registerContextSource } from "@/modules/ai/context-engine";
import { currenciesForSymbol } from "@/domain/instrumentCurrency";
import { newYorkDay } from "./market";

/**
 * LES SOURCES DE CONTEXTE BRANCHÉES — le point d'extension prévu par le
 * Context Engine (`registerContextSource`), enfin utilisé.
 *
 * Le domaine « marché » produisait un avertissement « non branché » : Jarvis
 * répondait à « quelles news aujourd'hui ? » qu'il ne voyait pas le calendrier,
 * alors que la page Actualités éco le lisait dans la même base. Brancher la
 * source lève l'avertissement et prépare la lecture AVANT le premier appel
 * modèle — sans toucher au moteur.
 *
 * Appelé par `askCoach` seulement : un enregistrement au chargement du module
 * remplirait le registre global dans chaque test qui importe les outils.
 */
let debrancher: (() => void) | null = null;

/** Idempotent. Rend la fonction qui débranche (tests : le registre est global). */
export function ensureJarvisSources(): () => void {
  if (!debrancher) debrancher = brancherCalendrier();
  return () => {
    debrancher?.();
    debrancher = null;
  };
}

function brancherCalendrier(): () => void {
  return registerContextSource({
    domain: "market",
    tools: ["get_economic_calendar"],
    prefetch: (route) => {
      const p = route.entities.period;
      // Sans période nommée : aujourd'hui et demain à New York — « les
      // prochaines heures » franchissent souvent minuit.
      const since = p?.since ?? newYorkDay(0);
      const until = p?.until ?? newYorkDay(1);
      // Un symbole nommé cible ses devises (NQ → USD) et garde l'impact moyen ;
      // sans symbole, seules les annonces à fort impact, toutes devises.
      const currencies = [...new Set(route.entities.symbols.flatMap(currenciesForSymbol))];
      return [
        {
          tool: "get_economic_calendar",
          args: {
            since,
            until,
            impact: currencies.length ? "medium" : "high",
            ...(currencies.length ? { currencies } : {}),
          },
          label: `economic calendar ${since}..${until} (New York time)`,
        },
      ];
    },
  });
}
