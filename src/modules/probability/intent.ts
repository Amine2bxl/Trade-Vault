/**
 * Intention « et si… ? » — module PUR.
 *
 * POURQUOI. Jarvis lit la dernière simulation enregistrée. C'est déjà mieux que
 * d'inventer un chiffre, mais ça ne répond pas à la question posée : « et si je
 * risquais moitié moins ? » mérite un calcul avec le risque divisé par deux, pas
 * le rappel du scénario d'hier.
 *
 * Ce module lit la question et en extrait, quand c'est possible, le changement
 * demandé. Le moteur fait ensuite le calcul ; le modèle ne fait toujours rien
 * d'autre que lire le résultat.
 *
 * ── UNE RECONNAISSANCE VOLONTAIREMENT ÉTROITE ──────────────────────────────
 * On ne reconnaît que ce qui est explicite et sans ambiguïté. Deviner large
 * serait le pire des deux mondes : le trader poserait une question, recevrait
 * un chiffre calculé sur une intention qu'il n'a pas exprimée, et le croirait.
 * Quand le doute existe, on rend `null` et Jarvis répond avec le scénario
 * enregistré — ou dit qu'il n'en a pas.
 */

import type { Lever } from "./sensitivity";

/** Nettoie la question pour une comparaison stable (accents, casse). */
function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Extrait le levier demandé par la question, ou `null`.
 *
 * Reconnu aujourd'hui :
 *   - « moitié moins », « la moitié », « half »        → risque ×0,5
 *   - « deux fois plus », « double »                    → risque ×2
 *   - « 25 % de moins », « 50 % de plus »               → risque ×0,75 / ×1,5
 *   - « stop après 2 pertes », « stop after 3 losses »  → arrêt journalier
 *
 * Le pourcentage est borné : au-delà d'un facteur 3, la simulation extrapole
 * bien plus loin que ce que l'historique peut soutenir, et le chiffre rendu
 * serait faussement précis.
 */
export function detectWhatIf(question: string): Lever | null {
  const q = normalize(question);

  // Un arrêt journalier est reconnu en premier : « stop après 2 pertes » ne
  // doit pas être capté par la recherche de nombre du bloc « risque ».
  const stop = q.match(/(?:stop|arrete|arreter|arret)[^0-9]{0,20}(\d+)\s*(?:perte|loss)/);
  if (stop) {
    const n = Number(stop[1]);
    if (n >= 1 && n <= 10) {
      return { kind: "stopAfterLosses", value: n, id: `stop.${n}` };
    }
  }

  const mentionsRisk = /risqu|risk|taille|size|lot|position/.test(q);
  if (!mentionsRisk) return null;

  if (/moitie moins|la moitie|moiti|half|deux fois moins/.test(q)) {
    return { kind: "risk", value: 0.5, id: "risk.half" };
  }
  // `doubl` et non `double` : « doublais », « doubler », « doublement ».
  if (/deux fois plus|doubl|twice/.test(q)) {
    return { kind: "risk", value: 2, id: "risk.double" };
  }

  const pctMatch = q.match(/(\d{1,3})\s*%\s*(?:de\s*)?(moins|plus|less|more)/);
  if (pctMatch) {
    const pct = Number(pctMatch[1]);
    if (pct > 0 && pct <= 200) {
      const direction = /moins|less/.test(pctMatch[2]) ? -1 : 1;
      const value = 1 + (direction * pct) / 100;
      // Un risque nul n'est pas un scénario, et au-delà de ×3 le
      // rééchantillonnage extrapole plus loin que ce que l'historique porte.
      if (value > 0 && value <= 3) {
        return { kind: "risk", value, id: `risk.pct${direction > 0 ? "+" : "-"}${pct}` };
      }
    }
  }

  return null;
}
