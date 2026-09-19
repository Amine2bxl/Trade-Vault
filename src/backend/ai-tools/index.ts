import { getTool, registerTool } from "@/modules/ai/tools/types";
import { JARVIS_TOOL_DEFS } from "./tools";

export { JARVIS_TOOL_DEFS } from "./tools";
export { loadTrades, rowToTrade, TRADE_COLS } from "./trades";

/**
 * L'enregistrement des outils de Jarvis dans le registre de `modules/ai/tools`.
 *
 * ── POURQUOI UNE FONCTION, ET PAS UN EFFET D'IMPORT ────────────────────────
 * Un `registerTool()` au niveau du module s'exécuterait au chargement, donc
 * aussi dans un test qui importe `tools.ts` pour lire un schéma, et dans un
 * bundle qui n'appelle jamais le coach. Un registre global rempli par un effet
 * de bord d'import est impossible à raisonner : on ne sait plus qui l'a rempli
 * ni dans quel ordre. Ici, l'appelant le demande — une fois, explicitement.
 *
 * IDEMPOTENT : `askCoach` l'appelle à chaque requête, et une instance serveur en
 * sert des milliers. Réenregistrer dix mille fois le même outil marcherait
 * (le registre est une Map), mais vérifier coûte moins et dit l'intention.
 */
export function ensureJarvisTools(): readonly string[] {
  for (const tool of JARVIS_TOOL_DEFS) {
    if (!getTool(tool.name)) registerTool(tool);
  }
  return JARVIS_TOOL_NAMES;
}

/** Les noms, dans l'ordre du manifeste remis au modèle. L'ordre compte un peu :
 *  les modèles sondent volontiers le premier outil de la liste, et commencer par
 *  les statistiques donne le cadrage avant le détail. */
export const JARVIS_TOOL_NAMES: readonly string[] = JARVIS_TOOL_DEFS.map((t) => t.name);
