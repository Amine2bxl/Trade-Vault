import { z } from "zod";
import {
  AI_CONTEXT_TOO_LARGE,
  AI_LIMITS,
  AI_MAX_CONTEXT_BYTES_DEFAULT,
  contextByteSize,
} from "@/domain/ai-limits";

/**
 * La validation des charges utiles IA — les briques partagées.
 *
 * `ai.functions.ts` et `coach.functions.ts` décrivaient chacun leur propre
 * `TradeSummary`, avec les mêmes champs et les mêmes plafonds recopiés. Deux
 * copies d'une règle de coût, c'est une copie qui finira par ne plus être
 * resserrée quand l'autre l'est. Elles vivent ici, une fois.
 */

/** Le plafond global, lu à l'exécution pour rester réglable sans redéploiement. */
export function maxContextBytes(): number {
  const raw = Number(process.env.AI_MAX_CONTEXT_BYTES);
  return Number.isFinite(raw) && raw > 0 ? raw : AI_MAX_CONTEXT_BYTES_DEFAULT;
}

/**
 * Le résumé d'un trade tel que le modèle le reçoit.
 *
 * `notes` est le champ qui portait tout le risque de coût : dix mille
 * caractères × cinq cents trades, c'était cinq mégaoctets de texte pour une
 * seule question. La note complète reste intacte en base et dans le journal —
 * c'est la COPIE envoyée au modèle qui est bornée.
 */
export const TradeSummarySchema = z.object({
  date: z.string().max(10),
  symbol: z.string().max(20),
  direction: z.string().max(10),
  pnl: z.number(),
  rMultiple: z.number(),
  strategy: z.string().max(50),
  mistakes: z.array(z.string().max(100)).max(20),
  setupQuality: z.number(),
  confluences: z.array(z.string().max(100)).max(30),
  notes: z.string().max(AI_LIMITS.tradeNote).optional(),
});

export const TradesSchema = z.array(TradeSummarySchema).max(AI_LIMITS.trades);

export const StatsSchema = z.record(z.string(), z.union([z.number(), z.string(), z.null()]));

export const GoalsSchema = z
  .array(z.object({ kind: z.string().max(40), target: z.number(), current: z.number() }))
  .max(AI_LIMITS.goals);

export const RulesSchema = z
  .array(
    z.object({
      kind: z.string().max(40),
      text: z.string().max(AI_LIMITS.ruleText),
      enabled: z.boolean(),
    }),
  )
  .max(AI_LIMITS.rules);

export const MemorySchema = z
  .array(z.object({ kind: z.string().max(20), content: z.string().max(AI_LIMITS.memoryContent) }))
  .max(AI_LIMITS.memory);

export const ConversationSchema = z
  .array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().max(AI_LIMITS.conversationContent),
    }),
  )
  .max(AI_LIMITS.conversation);

/**
 * Applique le PLAFOND GLOBAL d'octets à un schéma déjà validé champ par champ.
 *
 * POURQUOI EN PLUS des plafonds par champ. Les plafonds par champ sont une
 * multiplication : cinq cents trades fois la taille d'un trade. Chaque borne
 * peut sembler raisonnable isolément et leur produit ne l'est pas — et le jour
 * où quelqu'un ajoute un tableau au contexte, il n'aura aucune raison de
 * repenser au total. Cette borne-ci ne dépend d'aucun champ : elle survit à
 * l'évolution du schéma.
 *
 * REFUSE plutôt que de tronquer. Tronquer en silence ferait raisonner le coach
 * sur des données amputées sans que personne ne le sache — un coach qui affirme
 * « tu n'as jamais tradé le lundi » parce que les lundis ont été coupés est
 * pire qu'une erreur franche.
 */
export function withGlobalByteCeiling<T extends z.ZodTypeAny>(schema: T): z.ZodEffects<T> {
  return schema.superRefine((value, ctx) => {
    const size = contextByteSize(value);
    const max = maxContextBytes();
    if (size > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${AI_CONTEXT_TOO_LARGE}: ${size} bytes exceeds the ${max}-byte ceiling`,
      });
    }
  });
}
