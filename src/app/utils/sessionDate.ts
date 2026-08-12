/**
 * La date d'une séance, telle que le TRADER la vit.
 *
 * Module PUR et séparé du store : c'est la seule façon de le tester sans
 * traîner le client Supabase, et le fuseau est une règle métier, pas un détail
 * de persistance.
 *
 * `new Date().toISOString()` bascule de jour à minuit UTC. Pour un trader à
 * Bruxelles, une séance ouverte à 01 h du matin serait donc datée de la veille
 * et les trades du matin se rattacheraient à la mauvaise journée — un décalage
 * silencieux qui fausserait ensuite toute corrélation calculée sur les séances.
 * On compose la date à partir des composantes LOCALES.
 */
export function todayLocalDate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
