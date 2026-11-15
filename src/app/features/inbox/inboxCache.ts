import { loadNotifications } from "@/modules/notifications";
import type { AppNotification } from "@/modules/notifications/types";

/**
 * LE DERNIER ÉTAT CONNU DE LA BOÎTE, par trader — pour une page « en un temps ».
 *
 * La boîte s'ouvrait sur un squelette, puis la liste arrivait : deux temps,
 * que le propriétaire a demandé de supprimer (2026-11-15). La liste est
 * maintenant préchargée quand l'app est au repos (`prefetchInbox`, appelé par
 * `shell/App.tsx`) et gardée ici : la page s'ouvre directement dessus, puis se
 * met à jour en silence. Mémoire de l'onglet seulement — rien n'est écrit sur
 * l'appareil.
 */
const dernier = new Map<string, AppNotification[]>();

export function cachedInbox(userId: string | undefined): AppNotification[] | undefined {
  return userId ? dernier.get(userId) : undefined;
}

export function rememberInbox(userId: string, notifs: AppNotification[]): void {
  dernier.set(userId, notifs);
}

/** Charge et retient la boîte. Silencieux : un échec sera rejoué à l'ouverture. */
export function prefetchInbox(userId: string): Promise<void> {
  return loadNotifications(userId)
    .then((n) => rememberInbox(userId, n))
    .catch(() => {});
}
