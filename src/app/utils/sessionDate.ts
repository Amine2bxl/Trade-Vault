/**
 * La date d'une séance, telle que le TRADER la vit.
 *
 * La DÉFINITION vit désormais dans `shared/calendar-date.ts` : les moteurs de
 * `src/modules/` datent eux aussi des journées, et ils n'ont pas le droit
 * d'importer `src/app/` (règle d'architecture nº 1). Ce fichier reste le point
 * d'entrée historique des appelants côté application.
 *
 * `new Date().toISOString()` bascule de jour à minuit UTC. Pour un trader à
 * Bruxelles, une séance ouverte à 01 h du matin serait donc datée de la veille
 * et les trades du matin se rattacheraient à la mauvaise journée — un décalage
 * silencieux qui fausserait ensuite toute corrélation calculée sur les séances.
 */
export {
  localDateDaysAgo,
  localDateOf,
  localMonthOf,
  todayLocalDate,
} from "@/shared/calendar-date";
