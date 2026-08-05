/**
 * Série de jours de checklist — le levier de rétention du rituel.
 *
 * POURQUOI
 * --------
 * La checklist pré-market est la seule surface du produit qui intervient AVANT
 * le trade, et la seule dont le déclencheur est naturellement quotidien
 * (l'ouverture des marchés). Il lui manquait la mécanique qui transforme une
 * habitude fragile en engagement : voir sa série grandir, et ne pas vouloir la
 * casser.
 *
 * AUCUNE NOUVELLE DONNÉE N'EST STOCKÉE. La complétion quotidienne est déjà
 * écrite par la page Checklist sous `tv-chk-{userId}-{ISO}` et déjà relue par
 * l'Edge Score du Dashboard. La série est une LECTURE de cet historique — ce
 * qui évite une table, une migration, et surtout un second endroit où la
 * vérité pourrait diverger.
 */

/** Contrat de stockage minimal — `localStorage` le satisfait tel quel. */
export interface ChecklistStore {
  getItem(key: string): string | null;
}

/**
 * Profondeur maximale explorée. 180 jours ≈ 6 mois : au-delà, la série n'a
 * plus de valeur motivationnelle et la boucle coûterait plus qu'elle ne rapporte.
 */
export const MAX_LOOKBACK_DAYS = 180;

export function checklistKey(userId: string, iso: string): string {
  return `tv-chk-${userId}-${iso}`;
}

function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Samedi ou dimanche — marchés fermés. */
function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

/** Un jour compte quand la checklist a été VERROUILLÉE, pas simplement ouverte. */
function wasCompleted(store: ChecklistStore, userId: string, iso: string): boolean {
  try {
    const raw = store.getItem(checklistKey(userId, iso));
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { locked?: unknown };
    return parsed?.locked === true;
  } catch {
    // Entrée absente ou corrompue : le jour ne compte pas, mais on ne lève pas.
    return false;
  }
}

export interface StreakResult {
  /** Jours de bourse consécutifs avec checklist complétée. */
  current: number;
  /** La checklist d'aujourd'hui est-elle déjà faite ? */
  doneToday: boolean;
  /**
   * `true` quand la série tient encore mais que le jour courant n'est pas
   * validé — c'est l'état qui justifie de pousser le trader à agir MAINTENANT.
   */
  atRisk: boolean;
}

/**
 * Calcule la série en remontant le temps depuis `today`.
 *
 * DEUX RÈGLES PRODUIT, qui sont l'essentiel :
 *
 * 1. **Les week-ends ne cassent jamais la série.** Les marchés sont fermés :
 *    reprocher au trader de ne pas avoir fait sa routine un dimanche serait
 *    absurde et le découragerait de la tenir en semaine.
 *
 * 2. **Le jour courant bénéficie d'un sursis.** Tant qu'aujourd'hui n'est pas
 *    terminé, ne pas l'avoir encore fait ne remet pas la série à zéro — on
 *    repart de la veille. Une série qui tombe à 0 à 9h du matin punirait le
 *    trader pour un jour qu'il n'a pas encore eu l'occasion de vivre.
 */
export function computeChecklistStreak(
  store: ChecklistStore,
  userId: string,
  today: Date = new Date(),
): StreakResult {
  const todayIso = isoOf(today);
  const doneToday = wasCompleted(store, userId, todayIso);

  let count = 0;
  const cursor = new Date(today);

  // Règle 2 : si aujourd'hui n'est pas fait, on démarre l'examen à la veille.
  if (!doneToday) cursor.setDate(cursor.getDate() - 1);

  for (let i = 0; i < MAX_LOOKBACK_DAYS; i++) {
    // Règle 1 : un jour de week-end est sauté, ni compté ni rupteur.
    if (isWeekend(cursor)) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    if (!wasCompleted(store, userId, isoOf(cursor))) break;
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { current: count, doneToday, atRisk: count > 0 && !doneToday };
}
