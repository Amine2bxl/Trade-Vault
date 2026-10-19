import type { LiveStatus } from "../store/liveSync";

/** En dessous, une coupure ne s'affiche pas : un retour d'onglet ou un
 *  changement de réseau se reconnecte d'ordinaire en moins d'une seconde. */
export const LIVE_STATUS_GRACE_MS = 2_000;

/**
 * Ce que l'indicateur de connexion doit dire — ou `null` pour se taire.
 *
 * `since` : instant où le statut courant a commencé. « Hors ligne » n'est dit
 * que si le NAVIGATEUR l'est ; un canal tombé avec un réseau présent est une
 * reconnexion (Realtime réessaie seul). Et la connexion initiale se fait en
 * silence : on ne parle de reconnexion qu'après avoir été en direct.
 */
export function liveStatusMessage(
  status: LiveStatus,
  since: number,
  now: number,
  { everOnline, browserOnline }: { everOnline: boolean; browserOnline: boolean },
): "liveStatus.offline" | "liveStatus.connecting" | null {
  if (status === "online" || now - since < LIVE_STATUS_GRACE_MS) return null;
  if (!browserOnline) return "liveStatus.offline";
  return everOnline ? "liveStatus.connecting" : null;
}
