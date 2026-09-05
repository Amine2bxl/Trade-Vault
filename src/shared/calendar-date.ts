/**
 * LA DATE CIVILE DU TRADER — `YYYY-MM-DD`, dans SON fuseau.
 *
 * ── LE PROBLÈME QUE CE MODULE RÈGLE ─────────────────────────────────────────
 *
 * Le produit écrivait `new Date().toISOString().slice(0, 10)` à vingt-quatre
 * endroits. Ce n'est pas « aujourd'hui » : c'est le jour à Greenwich.
 *
 * Pour un trader à New York (UTC−4), dès 20 h locales, cette expression rend
 * DEMAIN. Conséquences concrètes, toutes en pleine séance US :
 *
 *   • le compteur de trades du jour se remet à zéro à 20 h ;
 *   • la série de discipline (« 12 jours d'affilée ») se casse ou se compte
 *     deux fois ;
 *   • le brief quotidien est daté du lendemain ;
 *   • une notification « déjà envoyée aujourd'hui » repart ;
 *   • un objectif créé le soir démarre le lendemain.
 *
 * Pour un trader à Tokyo (UTC+9), le décalage joue dans l'autre sens : entre
 * minuit et 9 h locales, l'expression rend HIER — soit toute la préparation de
 * séance asiatique.
 *
 * Trois définitions d'« aujourd'hui » coexistaient d'ailleurs dans le code :
 * celle-ci (UTC), celle de `utils/aiUsage.ts` (locale) et le fuseau explicite
 * choisi par le trader pour sa checklist. Ce module tient la première.
 *
 * ── POURQUOI DANS `shared/` ─────────────────────────────────────────────────
 *
 * `src/modules/` ne doit jamais importer `src/app/` (règle d'architecture nº 1).
 * Or les moteurs de notifications et de patterns datent eux aussi des journées.
 * Le module est donc neutre : ni React, ni Supabase, ni `process.env`.
 *
 * ── CE QUE CE MODULE NE FAIT PAS ────────────────────────────────────────────
 *
 * Il n'introduit PAS de fuseau configurable. Le fuseau utilisé est celui du
 * navigateur, ce que le produit considérait déjà comme la bonne réponse
 * (`utils/aiUsage.ts`, `utils/sessionDate.ts`). La checklist, elle, garde son
 * fuseau explicite : c'est un réglage de séance, une autre question.
 */

/** La date civile d'un instant, dans le fuseau local. */
export function localDateOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Aujourd'hui, tel que le trader le vit. Horloge injectable pour les tests. */
export function todayLocalDate(now: Date = new Date()): string {
  return localDateOf(now);
}

/**
 * La date civile locale, N jours en arrière.
 *
 * Passe par les composantes de calendrier (`setDate`) et NON par une
 * soustraction de millisecondes : sur un changement d'heure, un jour ne fait
 * pas toujours 24 heures, et « il y a sept jours » doit rester le même jour de
 * la semaine.
 */
export function localDateDaysAgo(days: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return localDateOf(d);
}

/** Le mois civil local, `YYYY-MM`. */
export function localMonthOf(date: Date = new Date()): string {
  return localDateOf(date).slice(0, 7);
}
