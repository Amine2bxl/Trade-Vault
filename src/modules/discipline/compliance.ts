/**
 * LA CONFORMITÉ AU PLAN — règle par règle, puis un verdict qui ne s'invente pas.
 *
 * Même entrée que la qualité d'exécution (`ExecutionInput`) : le P&L n'y est
 * pas, donc un gain ne rend jamais un trade conforme. Chaque règle du plan
 * reçoit son propre état :
 *   • `respected`      — comparée et tenue ;
 *   • `violated`       — comparée et enfreinte (avec sa preuve : observée ou déclarée) ;
 *   • `unverifiable`   — le plan la pose, mais la donnée manque (ou n'est
 *                        qu'une question : sortie avant cible) ;
 *   • `not_applicable` — le plan ne la pose pas.
 *
 * VERDICT :
 *   • une correction manuelle l'emporte ;
 *   • une règle CRITIQUE enfreinte → `violated` ; seulement des règles
 *     mineures → `partial` ;
 *   • toutes les règles applicables tenues → `respected` ;
 *   • sinon (rien de comparé, ou une règle invérifiable) → `undetermined` :
 *     jamais « respecté » par défaut.
 *
 * Pour chaque écart : la catégorie d'erreur proposée (vocabulaire du journal)
 * et s'il faut demander une explication courte au trader — seulement quand
 * l'écart est observé et que rien n'a été déclaré.
 *
 * Module PUR.
 */

import { stopDistance, type Side } from "@/domain/executionPlan";
import {
  CHASE_FRACTION,
  OVER_RISK_TOLERANCE,
  type Certainty,
  type ExecutionInput,
} from "./execution";

export type RuleState = "respected" | "violated" | "unverifiable" | "not_applicable";
export type ComplianceVerdict = "respected" | "partial" | "violated" | "undetermined";

export type ComplianceRule =
  | "direction"
  | "entry_zone"
  | "stop"
  | "risk"
  | "trade_count"
  | "observation"
  | "exit"
  | "confluence"
  | "declared";

export interface RuleCheck {
  rule: ComplianceRule;
  state: RuleState;
  /** D'où vient l'état quand il est tranché (observé dans les données ou déclaré). */
  certainty?: Certainty;
  /** La confluence concernée, le prix, l'erreur cochée… */
  detail?: string;
  /** Catégorie d'erreur proposée (vocabulaire de `MISTAKE_OPTIONS`) quand la règle est enfreinte. */
  mistake?: string;
}

export interface ComplianceAssessment {
  verdict: ComplianceVerdict;
  source: "calculated" | "manual";
  checks: RuleCheck[];
  /** Un écart observé sans rien de déclaré : une question courte au trader. */
  needsExplanation: boolean;
}

/** Ce qui ne se rattrape pas : prendre l'autre sens, risquer plus, élargir l'invalidation, trader en trop, renier son plan. */
const CRITICAL = new Set<ComplianceRule>(["direction", "stop", "risk", "trade_count", "declared"]);

const MISTAKE_OF: Partial<Record<ComplianceRule, string>> = {
  direction: "Ignored plan",
  entry_zone: "Chased entry",
  stop: "Ignored plan",
  risk: "Size too large",
  trade_count: "Overtrading",
  observation: "Ignored plan",
  exit: "Premature exit",
  confluence: "Ignored plan",
};

// ── Confluences exigées par un setup écrit ─────────────────────────────────

/** Mots du trader → confluence canonique. L'ordre compte : IFVG avant FVG. */
const CONFLUENCE_WORDS: readonly [string, RegExp][] = [
  ["Liquidity Sweep", /\b(liquidity\s*sweep|sweep|raid|prise\s+de\s+liquidit[ée])\b/i],
  ["Displacement", /\bdisplacement\b/i],
  ["MSS", /\b(mss|market\s+structure\s+shift)\b/i],
  ["CISD", /\bcisd\b/i],
  ["IFVG", /\b(ifvg|inverse\s+fvg|inversion\s+fvg)\b/i],
  ["FVG", /\b(?<!i)fvg\b|\bfair\s+value\s+gap\b/i],
  ["Order Block", /\b(order\s*block|ob)\b/i],
  ["Breaker", /\bbreaker\b/i],
  ["Premium/Discount", /\b(premium|discount)\b/i],
  ["Killzone", /\b(killzone|kill\s+zone)\b/i],
  ["Silver Bullet", /\bsilver\s+bullet\b/i],
  ["SMT", /\bsmt\b/i],
];

/** Les confluences qu'un setup écrit exige, lues dans ses règles (« Sweep + MSS + FVG »). */
export function requiredConfluences(rules: string | null | undefined): string[] {
  if (!rules) return [];
  return CONFLUENCE_WORDS.filter(([, re]) => re.test(rules)).map(([label]) => label);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export interface ComplianceExtras {
  /** Les règles écrites du setup du trade (plan de trading), si le setup y figure. */
  setupRules?: string | null;
  /** Confluences portées par le trade (déclarées ou validées depuis une capture). */
  confluences?: readonly string[];
}

export function assessCompliance(
  input: ExecutionInput,
  extras: ComplianceExtras = {},
): ComplianceAssessment {
  const side: Side | null = input.direction === "be" ? null : input.direction;
  const p = input.planned;
  const checks: RuleCheck[] = [];
  const add = (c: RuleCheck) =>
    checks.push(
      c.state === "violated" && MISTAKE_OF[c.rule] ? { mistake: MISTAKE_OF[c.rule], ...c } : c,
    );
  const breaches = input.sessionBreaches;

  // Sens : le plan de séance (figé) ou le contrôle de séance.
  if (breaches?.includes("direction"))
    add({ rule: "direction", state: "violated", certainty: "observed" });
  else if (p?.direction)
    add(
      side
        ? {
            rule: "direction",
            state: side === p.direction ? "respected" : "violated",
            certainty: "observed",
          }
        : { rule: "direction", state: "unverifiable" },
    );
  else if (breaches) add({ rule: "direction", state: "respected", certainty: "observed" });
  else add({ rule: "direction", state: "not_applicable" });

  // Zone d'entrée.
  if (p?.entry != null && side && p.direction === side) {
    const zone = stopDistance(side, p.entry, p.stop);
    if (input.entryPrice == null || zone == null)
      add({ rule: "entry_zone", state: "unverifiable" });
    else {
      const worse = side === "long" ? input.entryPrice - p.entry : p.entry - input.entryPrice;
      add({
        rule: "entry_zone",
        state: worse > zone * CHASE_FRACTION ? "violated" : "respected",
        certainty: "observed",
        detail: String(input.entryPrice),
      });
    }
  } else add({ rule: "entry_zone", state: "not_applicable" });

  // Invalidation : le stop posé ne va pas au-delà de celle du plan.
  if (p?.stop != null && side) {
    if (input.initialStop == null) add({ rule: "stop", state: "unverifiable" });
    else {
      const beyond = side === "long" ? input.initialStop < p.stop : input.initialStop > p.stop;
      add({
        rule: "stop",
        state: beyond ? "violated" : "respected",
        certainty: "observed",
        detail: String(input.initialStop),
      });
    }
  } else add({ rule: "stop", state: "not_applicable" });

  // Risque par trade.
  if (input.plannedRisk != null && input.plannedRisk > 0) {
    if (input.riskAmount == null) add({ rule: "risk", state: "unverifiable" });
    else
      add({
        rule: "risk",
        state:
          input.riskAmount > input.plannedRisk * (1 + OVER_RISK_TOLERANCE)
            ? "violated"
            : "respected",
        certainty: "observed",
        detail: String(input.riskAmount),
      });
  } else add({ rule: "risk", state: "not_applicable" });

  // Nombre de trades et observation : seulement avec un plan de séance comparé.
  if (breaches) {
    add({
      rule: "trade_count",
      state: breaches.includes("extra") ? "violated" : "respected",
      certainty: "observed",
    });
    add({
      rule: "observation",
      state: breaches.includes("observation") ? "violated" : "respected",
      certainty: "observed",
    });
  } else {
    add({ rule: "trade_count", state: "not_applicable" });
    add({ rule: "observation", state: "not_applicable" });
  }

  // Sortie : entre stop et cible = une QUESTION, jamais une infraction prouvée.
  const stop = input.initialStop ?? p?.stop ?? null;
  const target = input.initialTarget ?? p?.target ?? null;
  if (side && stop != null && target != null) {
    if (input.exitPrice == null) add({ rule: "exit", state: "unverifiable" });
    else {
      const [low, high] = side === "long" ? [stop, target] : [target, stop];
      const inside = input.exitPrice > low && input.exitPrice < high;
      add(
        inside
          ? {
              rule: "exit",
              state: "unverifiable",
              certainty: "to_confirm",
              detail: String(input.exitPrice),
            }
          : { rule: "exit", state: "respected", certainty: "observed" },
      );
    }
  } else add({ rule: "exit", state: "not_applicable" });

  // Confluences exigées par le setup écrit. Absente des confluences du trade ≠
  // absente du marché : c'est invérifiable, pas enfreint.
  const required = requiredConfluences(extras.setupRules);
  const have = new Set((extras.confluences ?? []).map(norm));
  for (const c of required) {
    add(
      have.has(norm(c))
        ? { rule: "confluence", state: "respected", certainty: "declared", detail: c }
        : { rule: "confluence", state: "unverifiable", detail: c },
    );
  }

  // Ce que le trader a déclaré lui-même.
  const declaredBad =
    input.planRespected === "no"
      ? "plan_not_respected"
      : input.mistakes.length
        ? input.mistakes[0]
        : null;
  if (declaredBad) {
    add({
      rule: "declared",
      state: "violated",
      certainty: "declared",
      detail: declaredBad,
      mistake: input.mistakes[0] ?? "Ignored plan",
    });
  } else if (input.planRespected === "yes") {
    add({ rule: "declared", state: "respected", certainty: "declared" });
  }

  const applicable = checks.filter((c) => c.state !== "not_applicable");
  const violated = applicable.filter((c) => c.state === "violated");
  const hasDeclaration =
    input.planRespected !== null || !!input.reflectionReason || input.mistakes.length > 0;
  const needsExplanation =
    (violated.some((c) => c.certainty === "observed") && !hasDeclaration) ||
    applicable.some((c) => c.certainty === "to_confirm");

  if (input.override) {
    return {
      verdict: input.override === "good_execution" ? "respected" : "violated",
      source: "manual",
      checks,
      needsExplanation: false,
    };
  }

  let verdict: ComplianceVerdict;
  if (violated.some((c) => CRITICAL.has(c.rule))) verdict = "violated";
  else if (violated.length) verdict = "partial";
  else if (applicable.length && applicable.every((c) => c.state === "respected"))
    verdict = "respected";
  else verdict = "undetermined";
  return { verdict, source: "calculated", checks, needsExplanation };
}
