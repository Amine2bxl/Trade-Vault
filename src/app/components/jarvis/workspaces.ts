import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { JarvisContext } from "./context";

/**
 * Workspaces Jarvis — la PLATEFORME, pas un chat (Phase 0, verrouillage).
 *
 * Jarvis est un ensemble d'espaces de travail indépendants (Conversation,
 * Réglages, puis Rapports, Analyses, Mémoire…). Le JarvisShell n'affiche QUE
 * le workspace actif — il ne dépend d'aucun module en particulier.
 *
 * L'ACCUEIL A ÉTÉ RETIRÉ. Il s'intercalait entre le trader et Jarvis : on
 * ouvrait l'assistant pour lui parler, et on tombait sur un tableau de
 * suggestions à lire avant de pouvoir écrire. Jarvis s'ouvre désormais sur la
 * Conversation, directement. Le moteur de suggestions (`insights/`) reste — il
 * est pur, testé, et nourrit la conversation.
 *
 * Lazy loading : chaque workspace est un `lazy()` séparé → un espace jamais
 * ouvert n'est jamais téléchargé. Le Shell reste extrêmement léger.
 */

export type JarvisWorkspaceId =
  | "conversation" // Chat (existant, extrait en module)
  | "settings" // Configuration Jarvis (profil, préférences, mémoire)
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
  settings: lazy(() => import("./workspaces/SettingsWorkspace")),
  // reports, analyses, memory, goals, history, tools — à venir
};
