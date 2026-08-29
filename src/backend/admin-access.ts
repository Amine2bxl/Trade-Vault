/**
 * QUI EST ADMINISTRATEUR — la réponse, et rien d'autre.
 *
 * Module volontairement SANS DÉPENDANCE : il ne lit que `process.env`. La
 * décision vivait dans `admin.server.ts`, qui importe le client Supabase et
 * tout le module de facturation ; chaque endroit voulant seulement demander
 * « cette adresse est-elle administratrice ? » traînait donc Stripe et
 * PostgREST dans son graphe. Ici, la question coûte un `split(",")`.
 *
 * `ADMIN_EMAILS` est la SEULE source d'autorité. Pas de colonne `is_admin` en
 * base : un drapeau en base, c'est une élévation de privilège à un `update` de
 * distance. Devenir administrateur demande la main sur les variables
 * d'environnement du déploiement, ce qui est exactement la barrière voulue.
 */

/** Les adresses administratrices, normalisées en minuscules. */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Cette adresse est-elle administratrice ?
 *
 * FERMÉ PAR DÉFAUT : sans `ADMIN_EMAILS`, la liste est vide et personne ne
 * l'est. Une adresse absente ou vide ne passe jamais — `"".toLowerCase()` ne
 * peut pas correspondre puisque `filter(Boolean)` a retiré les entrées vides
 * de la liste.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}
