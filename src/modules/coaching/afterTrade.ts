import type { Trade } from "@/domain";
import type { AfterTradeInput, AfterTradeObservation, CoachingPriority } from "./types";

/**
 * Observation d'après-trade (Step 6B) — la boucle « intent vs exécution ».
 *
 * Après chaque trade, Jarvis compare ce que le trader PENSAIT (intention) à ce
 * qu'il a FAIT (résultat + réflexion). Le signal le plus parlant n'est pas la
 * perte : c'est l'ÉCART entre un plan clair et une exécution qui ne l'a pas
 * suivi. C'est précisément ce qu'aucune stat agrégée ne peut voir.
 *
 * RÈGLE D'HONNÊTETÉ. La récurrence (« ça ressemble à X occurrences ») n'est
 * affirmée que si elle est réellement disponible : ici, les pertes consécutives
 * DU JOUR. Pas de corrélation historique inventée à partir de réflexions
 * qu'on n'a pas chargées. Sous le seuil, on le dit (« signal encore faible »).
 *
 * Pur et déterministe : aucune IO, aucune IA. Le moteur d'automation l'appelle
 * après `tradeSaved` ; le moteur de notifications lit le résultat.
 */

/** États émotionnels qui rendent un écart de plan grave. */
const EMOTIONAL = new Set(["frustrated", "overconfident"]);

/** Raisons de type « j'ai forcé » — plus graves qu'une erreur de timing. */
const REVENGE_REASONS = new Set(["revenge", "fomo"]);

/** Raisons d'exécution (timing/setup/risque) — un problème, mais maîtrisé. */
const EXECUTION_REASONS = new Set([
  "early_entry",
  "late_entry",
  "wrong_setup",
  "wrong_timing",
  "wrong_risk",
]);

/**
 * Priorité d'intervention (Step 6G).
 *  - HIGH  : plan non respecté + émotion/raison de tilt, ou ≥3 pertes d'affilée ;
 *  - MEDIUM: plan non/partiellement respecté, ou raison d'exécution ;
 *  - LOW   : signal informatif (raison/émotion sans écart de plan) ;
 *  - null  : rien qui mérite d'être dit.
 */
export function classifyPriority(
  planRespected: "yes" | "partial" | "no" | null | undefined,
  reason: string | null | undefined,
  emotion: string | null | undefined,
  consecutiveLossesToday: number,
): CoachingPriority | null {
  if (consecutiveLossesToday >= 3) return "high";
  if (planRespected === "no") {
    if (reason && REVENGE_REASONS.has(reason)) return "high";
    if (emotion && EMOTIONAL.has(emotion)) return "high";
    return "medium";
  }
  if (planRespected === "partial") return "medium";
  if (reason && EXECUTION_REASONS.has(reason)) return "medium";
  if (reason || emotion) return "low";
  return null;
}

/** Séquence du jour (ce trade inclus), ordonnée par heure puis id. */
function sameDaySequence(trade: Trade, previousTrades: Trade[]): Trade[] {
  const list = previousTrades.filter((t) => t.date === trade.date);
  list.push(trade);
  list.sort(
    (a, b) => (a.entryTime || "").localeCompare(b.entryTime || "") || a.id.localeCompare(b.id),
  );
  return list;
}

/** Pertes consécutives du jour, en remontant depuis ce trade. */
function trailingLosses(seq: Trade[], tradeId: string): number {
  const idx = seq.findIndex((t) => t.id === tradeId);
  if (idx < 0) return 0;
  let count = 0;
  for (let i = idx; i >= 0 && seq[i].pnl < 0; i--) count += 1;
  return count;
}

/** Le trade immédiatement précédent du jour était une perte. */
function afterLoss(seq: Trade[], tradeId: string): boolean {
  const idx = seq.findIndex((t) => t.id === tradeId);
  if (idx <= 0) return false;
  const prev = seq[idx - 1];
  return prev.direction !== "be" && prev.pnl < 0;
}

function kindOf(consecutive: number, reason: string | null | undefined): string {
  if (consecutive >= 3) return "loss_streak";
  if (reason && REVENGE_REASONS.has(reason)) return "revenge_entry";
  return "intent_execution_gap";
}

export function buildAfterTradeObservation(input: AfterTradeInput): AfterTradeObservation | null {
  const { trade, intent, reflection, previousTrades } = input;
  const planRespected = reflection?.planRespected ?? null;
  const reason = reflection?.reason ?? null;
  const emotion = intent?.emotion ?? null;

  const seq = sameDaySequence(trade, previousTrades);
  const consecutive = trailingLosses(seq, trade.id);

  const priority = classifyPriority(planRespected, reason, emotion, consecutive);
  // LOW ne devient jamais une notification ; null ne produit rien. On ne garde
  // ici que ce qui peut vivre une observation (high/medium) — le reste (LOW)
  // appartient à la review, pas au flux proactif.
  if (priority === null || priority === "low") return null;

  const affected = consecutive >= 2 ? seq.slice(Math.max(0, seq.length - consecutive)) : [trade];

  return {
    priority,
    kind: kindOf(consecutive, reason),
    claim: "intent_execution_gap",
    evidence: {
      pnl: trade.pnl,
      confidence: trade.confidence ?? undefined,
      planRespected,
      reason,
      emotion,
      consecutiveLossesToday: consecutive,
      afterLoss: afterLoss(seq, trade.id),
    },
    affectedTradeIds: affected.map((t) => t.id),
    recurrence: consecutive >= 2 ? { count: consecutive, lowSample: consecutive < 3 } : null,
  };
}

/** Copie localisée de l'observation — la seule prose produite par ce module. */
export function afterTradeCopy(
  obs: AfterTradeObservation,
  fr: boolean,
): { title: string; body: string; plan: string } {
  const e = obs.evidence;
  const money = `${e.pnl >= 0 ? "+" : ""}${Math.round(e.pnl)} $`;
  if (fr) {
    const plan =
      e.planRespected === "no"
        ? "Revois ce trade : note à quel moment tu as quitté ton plan, et ce que tu ferais différemment au prochain signal identique."
        : "Revois ce trade à la lumière de ce qui était prévu, et note un seul ajustement pour le prochain.";
    let body = `Résultat ${money}.`;
    if (e.planRespected === "no") {
      body += ` Tu avais ${e.confidence ?? 0} % de confiance et un plan, mais tu ne l'as pas suivi. Le problème n'est pas le résultat — c'est l'écart entre ton intention et ton exécution.`;
    } else if (e.planRespected === "partial") {
      body += ` Tu n'as suivi ton plan qu'en partie — l'écart entre intention et exécution se creuse.`;
    }
    if (obs.recurrence && obs.recurrence.count >= 2) {
      body += ` C'est ta ${obs.recurrence.count}e perte d'affilée aujourd'hui.`;
      if (obs.recurrence.lowSample) body += ` Signal encore faible.`;
    }
    return { title: "Ce trade mérite ton attention", body, plan };
  }
  const plan =
    e.planRespected === "no"
      ? "Review this trade: note exactly where you left your plan, and what you would change on the next identical signal."
      : "Review this trade against what was planned, and write down one single adjustment for next time.";
  let body = `Result ${money}.`;
  if (e.planRespected === "no") {
    body += ` You had ${e.confidence ?? 0}% confidence and a plan, but you didn't follow it. The problem isn't the result — it's the gap between your intent and your execution.`;
  } else if (e.planRespected === "partial") {
    body += ` You only partly followed your plan — the intent-to-execution gap is widening.`;
  }
  if (obs.recurrence && obs.recurrence.count >= 2) {
    body += ` That's your ${obs.recurrence.count}th straight loss today.`;
    if (obs.recurrence.lowSample) body += ` Signal still weak.`;
  }
  return { title: "This trade deserves your attention", body, plan };
}
