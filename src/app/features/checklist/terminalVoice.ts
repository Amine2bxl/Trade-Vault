/**
 * Ce que Jarvis DIT au Mode Terminal — module PUR (l'heure et le tirage sont
 * passés par l'appelant, pour que chaque réplique se teste).
 *
 * Deux sortes de répliques :
 *   - fixes (`LINES`, voice.ts) : en anglais, elles correspondent mot pour mot
 *     aux clips pré-rendus de la voix clonée, donc jouées sans coût ;
 *   - le résumé du plan : variable, construit depuis les valeurs ÉCRITES par
 *     le trader — aucun chiffre ajouté, aucune interprétation.
 */

import { JARVIS_GREETINGS } from "@/modules/voice/brief";
import { LINES } from "./voice";
import { activePlan, type SessionDay } from "./sessionPlan";

export type VoiceLang = "fr" | "en";
export type LineKey = keyof typeof LINES;

const FR_GREETINGS = ["Bonjour", "Bon après-midi", "Bonsoir"] as const;

/** Matin avant 12 h, après-midi avant 18 h, soir ensuite — comme `brief.ts`. */
export function greeting(lang: VoiceLang, hour: number): string {
  const i = hour < 12 ? 0 : hour < 18 ? 1 : 2;
  return lang === "fr" ? FR_GREETINGS[i] : JARVIS_GREETINGS[i];
}

/**
 * Une réplique du catalogue. `pick` ∈ [0, 1) choisit la variante (l'appelant
 * passe `Math.random()`) ; `%G` devient la salutation de l'heure.
 */
export function line(key: LineKey, lang: VoiceLang, hour: number, pick: number): string {
  const variants = LINES[key][lang];
  const text = variants[Math.min(variants.length - 1, Math.floor(pick * variants.length))];
  return text.replace("%G", greeting(lang, hour));
}

/**
 * Le plan du jour, lu à voix haute : sens, cible, zone, invalidation, risque,
 * trades et perte max — ce qui est écrit, rien de plus. Un champ vide est tu.
 */
export function planSummary(day: Pick<SessionDay, "plan" | "scenario">, lang: VoiceLang): string {
  const p = activePlan(day);
  const fr = lang === "fr";
  if (p.bias === "none") {
    return fr
      ? "Journée d'observation. Aucun trade prévu aujourd'hui."
      : "Observation day. No trade planned today.";
  }
  if (p.bias === null) {
    return fr ? "Le plan du jour n'est pas encore écrit." : "Today's plan is not written yet.";
  }
  const parts: string[] = [];
  const side = fr ? (p.bias === "long" ? "achat" : "vente") : p.bias;
  parts.push(fr ? `Plan du jour : ${side}` : `Today's plan: ${side}`);
  if (day.scenario === "B") parts.push(fr ? "scénario B" : "scenario B");
  const say = (label: string, v: string) => {
    if (v.trim()) parts.push(`${label} ${v.trim()}`);
  };
  say(fr ? "Cible" : "Target", p.target);
  say(fr ? "Entrée" : "Entry", p.entry);
  say("Invalidation", p.invalidation);
  say(fr ? "Risque" : "Risk", p.risk);
  // « trade(s) maximum » s'écrit pareil dans les deux langues.
  parts.push(`${p.maxTrades} trade${p.maxTrades > 1 ? "s" : ""} maximum`);
  say(fr ? "Perte maximale du jour" : "Daily max loss", p.maxLoss);
  return `${parts.join(". ")}.`;
}
