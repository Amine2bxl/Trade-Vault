import type { LiveTable } from "../store/liveSync";
import { useLiveTable } from "./useLiveTable";

/**
 * Abonnement live à une table scopée `user_id`, pour les écrans qui gardent
 * leurs lignes dans un `useState` local : à chaque changement venu d'un AUTRE
 * appareil (ou d'un autre onglet), `onChange` est appelé pour recharger.
 *
 * Passe par le moyeu unique (`store/liveSync.ts`) — voir `useLiveTable`.
 * Conservé pour ses appelants ; rien n'est ouvert sans utilisateur.
 */
export function useRealtimeTable(
  table: LiveTable,
  userId: string | undefined | null,
  onChange: () => void,
): void {
  useLiveTable(table, onChange, { enabled: !!userId });
}
