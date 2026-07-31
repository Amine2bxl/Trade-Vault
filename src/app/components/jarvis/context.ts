import type { Trade } from "../../types";
import type { JarvisProfile, OnboardingData } from "../../store";

/**
 * JarvisContext — l'AGRÉGATEUR de contexte (Phase 0, verrouillage d'architecture).
 *
 * Jarvis peut recevoir plusieurs contextes simultanément (compte actif, page
 * courante, trade sélectionné, objectifs, checklist, news, notifications…).
 * Ce n'est PAS une prop passée de page en page : c'est une structure agrégée
 * construite par l'ouvreur de Jarvis (AiAssistant / App) et consommée par les
 * workspaces. Chaque module pourra plus tard fournir sa part via un registre
 * (Phase P4) sans dépendance forte.
 *
 * Règle : le JarvisShell ne connaît que ce type — jamais l'implémentation.
 */
export interface JarvisContext {
  userId?: string;
  trades: Trade[];
  /** Profil « mémorisé par Jarvis » (prénom, style, faiblesse, force, objectif). */
  profile?: JarvisProfile | null;
  /** Réponses d'onboarding (objectif, style, pain…). */
  onboarding?: OnboardingData | null;
  /** Page TradeVault depuis laquelle Jarvis a été ouvert (P4 : contexte dynamique). */
  page?: string;
  /** Compte actif (id + solde) — P4. */
  activeAccount?: { id?: string | null; balance?: number } | null;
  /** Conversation active (workspace Conversation). */
  conversationId?: string | null;
  /**
   * Prompt fourni par une page externe (`tv:ask-coach`) : le workspace actif
   * le consomme à l'ouverture, sans refonte.
   */
  pendingPrompt?: string;
}

export function emptyJarvisContext(): JarvisContext {
  return { trades: [] };
}
