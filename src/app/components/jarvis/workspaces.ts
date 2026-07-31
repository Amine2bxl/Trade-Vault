import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { JarvisContext } from "./context";

/**
 * Workspaces Jarvis — la PLATEFORME, pas un chat (Phase 0, verrouillage).
 *
 * Jarvis est un ensemble d'espaces de travail indépendants (Accueil,
 * Conversation, Rapports, Analyses, Mémoire, Objectifs, Historique, Outils).
 * Le JarvisShell n'affiche QUE le workspace actif — il ne dépend d'aucun
 * module en particulier.
 *
 * Lazy loading : chaque workspace est un `lazy()` séparé → un espace jamais
 * ouvert n'est jamais téléchargé. Le Shell reste extrêmement léger.
 */

export type JarvisWorkspaceId =
  | "home" // Accueil intelligent (Phase 1)
  | "conversation" // Chat (existant, extrait en module)
  | "reports" // à venir
  | "analyses" // à venir
  | "memory" // à venir
  | "goals" // à venir
  | "history" // à venir
  | "tools"; // à venir

/** Props que chaque workspace reçoit du Shell (jamais de props métier). */
export interface JarvisWorkspaceProps {
  context: JarvisContext;
  /** Prompt fourni par une page externe (`tv:ask-coach`), consommé à l'ouverture. */
  initialPrompt?: string;
  /** Navigation entre espaces (colonne gauche, Phase P3). */
  openWorkspace: (id: JarvisWorkspaceId) => void;
}

/**
 * Registre des workspaces — lazy, ajoutables sans toucher au Shell.
 * Un id déclaré dans `JarvisWorkspaceId` mais absent du registre affiche le
 * fallback du Shell (espace « à venir »).
 */
export const JARVIS_WORKSPACES: Partial<
  Record<JarvisWorkspaceId, LazyExoticComponent<ComponentType<JarvisWorkspaceProps>>>
> = {
  conversation: lazy(() => import("./workspaces/ConversationWorkspace")),
  // home (Phase 1), reports, analyses, memory, goals, history, tools — à venir
};
