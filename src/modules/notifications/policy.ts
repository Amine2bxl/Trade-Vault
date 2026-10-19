import type { AppNotification, NotificationKind } from "./types";

/**
 * LA POLITIQUE DE LA BOÎTE DE RÉCEPTION — ce qui reste, ce qui s'éteint.
 *
 * Le compteur affichait « 99+ » parce que rien ne sortait jamais de la boîte :
 * chaque règle ré-émettait chaque jour, chaque appareil dédupliquait pour lui
 * seul, et une alerte non lue restait « à lire » pour toujours. Une
 * notification a pourtant une durée de vie : un rappel d'annonce économique
 * ne vaut plus rien le lendemain, un bilan de la veille plus rien la semaine
 * suivante. Passé ce délai, elle est ARCHIVÉE (marquée lue, gardée dans
 * l'historique) — elle ne gonfle plus le compteur et ne réclame plus rien.
 */

const DAY = 86_400_000;

/** Jours pendant lesquels une notification non lue reste « à lire ». */
export const UNREAD_LIFETIME_DAYS: Partial<Record<NotificationKind, number>> = {
  economic_event: 1,
  daily_brief: 2,
  daily_review: 3,
  discipline_success: 3,
  discipline_warning: 7,
  discipline_limit: 7,
  after_trade_insight: 7,
  activity_lull: 7,
  weekly_review: 7,
};
/** Tout le reste : deux semaines. Au-delà, une alerte n'est plus actionnable. */
export const DEFAULT_UNREAD_LIFETIME_DAYS = 14;

/** L'historique lu est purgé après ce délai — le stockage reste borné. */
export const PRUNE_READ_AFTER_DAYS = 90;

export function unreadLifetimeDays(kind: NotificationKind): number {
  return UNREAD_LIFETIME_DAYS[kind] ?? DEFAULT_UNREAD_LIFETIME_DAYS;
}

type Candidate = Pick<AppNotification, "id" | "kind" | "title" | "body" | "createdAt" | "readAt">;

/**
 * Ce qu'il faut archiver parmi les non lues :
 *   1. les EXPIRÉES (plus vieilles que la durée de vie de leur kind) ;
 *   2. les DOUBLONS — même kind, même titre, même texte : seule la plus
 *      récente reste à lire. Ce sont les répétitions quotidiennes d'un fait
 *      qui n'avait pas bougé, héritées de l'ancienne cadence.
 */
export function planArchive(unread: Candidate[], now: Date = new Date()): string[] {
  const out = new Set<string>();
  const newest = new Map<string, Candidate>();
  for (const n of unread) {
    if (n.readAt) continue;
    const age = now.getTime() - new Date(n.createdAt).getTime();
    if (Number.isNaN(age)) continue;
    if (age > unreadLifetimeDays(n.kind) * DAY) {
      out.add(n.id);
      continue;
    }
    const sig = `${n.kind}\u0000${n.title}\u0000${n.body}`;
    const prev = newest.get(sig);
    if (!prev) newest.set(sig, n);
    else if (n.createdAt > prev.createdAt) {
      out.add(prev.id);
      newest.set(sig, n);
    } else out.add(n.id);
  }
  return [...out];
}

/**
 * UN SEUL POPUP DANS TOUT LE PRODUIT : L'ANNONCE MAJEURE, UNE HEURE AVANT.
 *
 * Avant, une alerte grave (`error`) s'ouvrait si un trade venait d'être
 * enregistré, et chaque règle de discipline partait aussi en toast. Le trader
 * était interrompu pour des faits qu'il pouvait lire plus tard. Désormais rien
 * de cela ne s'ouvre : tout attend dans la boîte de réception, sauf l'alerte
 * économique marquée `popup` — une annonce à fort impact, sur une devise qu'il
 * trade vraiment, dans une heure (`economic.ts`). C'est la seule information
 * du produit qui porte une heure limite.
 */
export function shouldInterrupt(n: Pick<AppNotification, "kind" | "data">): boolean {
  return n.kind === "economic_event" && n.data?.popup === true;
}

/**
 * LA CLÉ ANTI-DOUBLON ÉCRITE EN BASE (`notifications.dedup_key`, unique par
 * compte). Deux appareils ouverts évaluent les mêmes règles : sans elle,
 * chacun écrivait son exemplaire.
 *
 *  • Règle codée (`data.codedRule`) : la clé telle quelle. Elle porte déjà sa
 *    période (`weekly_review:2026-10-12`, `risk_leak:…:semaine`), et le runner
 *    la tient déjà pour unique d'un appareil à l'autre (`loadRecentDedupKeys`).
 *  • Alerte de l'engine : une par JOUR (`seenToday`), d'où la date en tête.
 *  • Sans clé : aucune contrainte (`null` — les NULL sont distincts en base).
 */
export function notificationDedupKey(
  n: Pick<AppNotification, "data">,
  today: string,
): string | null {
  const key = n.data?.dedupKey;
  if (typeof key !== "string" || key === "") return null;
  return n.data?.codedRule === true ? key : `${today}:${key}`;
}

/**
 * L'adaptateur `persist` de l'engine : écrire, puis ouvrir le popup — mais
 * SEULEMENT si la ligne a été créée ici. Un doublon refusé par la base veut
 * dire qu'un autre appareil l'a déjà créée ; ce poste-ci recevra la ligne par
 * Realtime et ouvrira le MÊME popup (même id), que fermer d'un côté ferme
 * de l'autre.
 */
export function createPersistAdapter(deps: {
  persist: (n: AppNotification) => Promise<boolean>;
  open: (n: AppNotification) => void;
}): (n: AppNotification) => Promise<boolean> {
  return async (n) => {
    const created = await deps.persist(n);
    if (created && shouldInterrupt(n)) deps.open(n);
    return created;
  };
}

/**
 * Le popup ouvert ici doit-il se fermer, au vu d'une ligne arrivée d'ailleurs ?
 * Seulement si un appareil l'a FERMÉ (`data.dismissedAt`). Être « lue » ne
 * suffit pas : l'ouverture du popup marque déjà la notification lue — fermer
 * sur `read_at` refermerait chaque popup à l'instant où il s'ouvre.
 */
export function shouldClosePopup(openId: string | null, row: Record<string, unknown>): boolean {
  if (!openId || row.id !== openId) return false;
  const data = row.data as { dismissedAt?: unknown } | null | undefined;
  return typeof data?.dismissedAt === "string";
}

/** Le badge : le vrai nombre. Au-delà de 999, la place manque — et seulement là. */
export function badgeLabel(count: number): string {
  return count > 999 ? "999+" : String(count);
}
