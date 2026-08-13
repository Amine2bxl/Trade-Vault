import { z } from "zod";
import { checkCausalLanguage } from "./language";

/**
 * Ce qu'une proposition a le droit de contenir.
 *
 * POURQUOI UN SCHÉMA PAR ACTION. `payload` est un `jsonb` : la base accepte
 * n'importe quoi. Ce fichier est l'endroit où l'on refuse. Un objet de forme
 * libre produit par un modèle n'est pas une donnée de confiance — il a la forme
 * que le modèle a bien voulu lui donner ce jour-là, et il finira par contenir
 * une clé qu'on n'attendait pas, une chaîne de 40 000 caractères, ou un nombre
 * là où on lisait un identifiant.
 *
 * La règle du spec est nette : **valider côté serveur, avec zod, avant de créer
 * quoi que ce soit**. Un payload refusé ne crée rien et se journalise.
 */

/** Bornes communes : rien de ce que Jarvis propose n'a besoin d'être long. */
const shortText = z.string().trim().min(3).max(120);
const longText = z.string().trim().min(3).max(600);

const createRule = z.object({
  text: shortText,
  /** Règle mesurable ou simple rappel — le moteur ne fabrique que du mesurable. */
  metric: z.enum(["max_risk_pct", "max_trades_per_day", "max_consecutive_losses", "none"]),
  threshold: z.number().finite().nonnegative().max(1000).optional(),
});

const createGoal = z.object({
  text: shortText,
  targetR: z.number().finite().min(-100).max(100).optional(),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "deadline must be YYYY-MM-DD")
    .optional(),
});

const addChecklistItem = z.object({
  text: shortText,
  /** Où l'insérer. Borné : une checklist de 200 items ne se coche pas. */
  position: z.number().int().min(0).max(40).optional(),
});

const createMission = z.object({
  title: shortText,
  items: z.array(shortText).min(1).max(5),
});

const addTag = z.object({
  tag: z
    .string()
    .trim()
    .min(2)
    .max(24)
    .regex(/^[\p{L}\p{N} _-]+$/u, "tag must not contain punctuation or markup"),
});

const addNote = z.object({ text: longText });

export const PROPOSAL_PAYLOAD_SCHEMAS = {
  create_rule: createRule,
  create_goal: createGoal,
  add_checklist_item: addChecklistItem,
  create_mission: createMission,
  add_tag: addTag,
  add_note: addNote,
} as const;

export type ProposalActionType = keyof typeof PROPOSAL_PAYLOAD_SCHEMAS;

export function isProposalActionType(value: unknown): value is ProposalActionType {
  return typeof value === "string" && value in PROPOSAL_PAYLOAD_SCHEMAS;
}

export interface ValidationResult {
  ok: boolean;
  /** Motif du refus, journalisable tel quel. */
  reason: string | null;
  /** Le payload nettoyé par zod — jamais l'objet brut du modèle. */
  value: unknown;
}

/**
 * Valide une proposition complète : type d'action, payload, et justification.
 *
 * La justification passe par `checkCausalLanguage` ICI, sur le chemin
 * d'écriture. Le prompt réduit la fréquence des formulations causales ; ce
 * contrôle est ce qui les arrête. Une justification qui promet une cause part
 * chez l'utilisateur quelle que soit la couleur de la CI — c'est le seul
 * endroit où elle peut encore être refusée.
 */
export function validateProposal(input: {
  actionType: unknown;
  payload: unknown;
  rationale: unknown;
}): ValidationResult {
  if (!isProposalActionType(input.actionType)) {
    return { ok: false, reason: `unknown action_type: ${String(input.actionType)}`, value: null };
  }

  if (typeof input.rationale !== "string" || input.rationale.trim().length < 10) {
    return { ok: false, reason: "rationale missing or too short", value: null };
  }
  if (input.rationale.length > 600) {
    return { ok: false, reason: "rationale too long", value: null };
  }

  const causal = checkCausalLanguage(input.rationale);
  if (!causal.ok) {
    return { ok: false, reason: `causal wording in rationale: "${causal.matched}"`, value: null };
  }

  const parsed = PROPOSAL_PAYLOAD_SCHEMAS[input.actionType].safeParse(input.payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      reason: `payload rejected: ${first?.path.join(".") || "root"} ${first?.message ?? "invalid"}`,
      value: null,
    };
  }

  return { ok: true, reason: null, value: parsed.data };
}
