/**
 * CE QUI RESTE SUR LE DISQUE QUAND ON SE DÉCONNECTE.
 *
 * ── LE PROBLÈME ─────────────────────────────────────────────────────────────
 *
 * `AuthContext.logout()` appelait `supabase.auth.signOut()` et rien d'autre.
 * Supabase efface SON jeton ; tout le reste survivait à la déconnexion, sur la
 * machine, en clair, lisible par le suivant qui ouvre les outils de
 * développement — ou simplement par le suivant qui se connecte :
 *
 *   • `tv:jarvis:conv:{uid}:*`  — l'historique COMPLET des conversations
 *     Jarvis. C'est le pire de la liste : un trader y décrit ses pertes, son
 *     capital, ses positions ouvertes, ses doutes.
 *   • `tv-chk-{uid}-*`          — les réponses de checklist, jour par jour.
 *   • `tv.{uid}.*`              — l'espace de noms de `utils/persistence.ts` :
 *     brouillons de trades, état d'écrans en cours.
 *   • `tv.journal.filters`, `tv.dashboard.period`, `tv-lot-calc`,
 *     `tv.notif.*`              — non nommés par utilisateur : le compte
 *     SUIVANT sur le même appareil héritait de la taille de position, du
 *     capital saisi dans la calculatrice et des filtres du précédent.
 *
 * L'incohérence était par ailleurs déjà écrite dans le dépôt : `useTrades.ts`
 * refuse explicitement `localStorage` pour le P&L au motif qu'il serait
 * « lisible sur une machine partagée » — pendant que les conversations, elles,
 * y étaient écrites en entier.
 *
 * ── LE CHOIX : EFFACER PAR DÉFAUT ───────────────────────────────────────────
 *
 * Ce module purge TOUTE clé du préfixe `tv` SAUF une liste explicite. Le sens
 * du défaut est délibéré : une clé ajoutée demain par quelqu'un qui n'aura pas
 * lu ce fichier sera effacée. Se tromper coûte alors une préférence
 * d'affichage ; se tromper dans l'autre sens laisse des données de trading sur
 * un poste partagé.
 *
 * Les clés `sb-*` (le jeton Supabase) ne sont JAMAIS touchées : `signOut()` en
 * a la charge, et marcher dessus casserait la déconnexion elle-même.
 *
 * ── CE QUI SURVIT, ET POURQUOI ──────────────────────────────────────────────
 *
 * Ce ne sont pas des données du trader : ce sont des réglages de l'APPAREIL,
 * qui n'apprennent rien sur lui et dont l'effacement dégraderait le produit.
 *
 *   • `tv.cookie-consent`   — un consentement est un fait juridique attaché au
 *     navigateur. L'effacer reposerait la question à chaque déconnexion, et
 *     ferait perdre la trace du refus précédent.
 *   • `tv.lang`, `tv.landing.lang`, `tv:jarvis:lang` — la langue.
 *   • `tv:sidebar-collapsed` — la mise en page.
 *   • `tv-themes`, `tv-theme-vars` — les thèmes PERSONNALISÉS n'existent nulle
 *     part ailleurs : aucune table ne les sauvegarde. Les purger ne serait pas
 *     une mesure de confidentialité, ce serait une suppression de données que
 *     le trader a créées et qu'il ne pourrait pas récupérer.
 *   • `tv-chunk-reload-at`   — garde-fou de rechargement après déploiement.
 *     L'effacer rouvrirait une boucle de rechargement.
 *   • `tv.last-pwd-reset`    — la limite d'un envoi de réinitialisation par
 *     minute. L'effacer ne protégerait personne : ça affaiblirait un frein.
 */

/** Le préfixe de toutes les clés du produit. */
const PREFIX = "tv";

/**
 * Les clés d'APPAREIL, conservées. Voir l'en-tête pour la justification de
 * chacune — ajouter une entrée ici, c'est décider qu'une donnée a le droit de
 * survivre à la déconnexion sur un poste partagé.
 */
export const KEPT_ON_LOGOUT: readonly string[] = [
  "tv.cookie-consent",
  "tv.lang",
  "tv.landing.lang",
  "tv:jarvis:lang",
  "tv:sidebar-collapsed",
  "tv-themes",
  "tv-theme-vars",
  "tv-chunk-reload-at",
  "tv.last-pwd-reset",
];

/** Une clé appartient-elle au produit, et n'est-elle pas explicitement gardée ? */
export function shouldPurge(key: string): boolean {
  if (!key.startsWith(PREFIX)) return false;
  return !KEPT_ON_LOGOUT.includes(key);
}

/**
 * Les clés à purger dans un magasin donné.
 *
 * La liste est constituée AVANT toute suppression : `Storage.key(i)` est
 * indexé, et supprimer pendant l'itération décale les suivants — on en
 * sauterait un sur deux.
 */
function keysToPurge(store: Storage): string[] {
  const out: string[] = [];
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i);
    if (key && shouldPurge(key)) out.push(key);
  }
  return out;
}

/**
 * Efface les données locales de la session qui vient de se terminer.
 *
 * Best-effort et sans exception : elle s'exécute pendant la déconnexion, et une
 * navigation privée qui refuse l'accès au stockage ne doit pas empêcher un
 * trader de se déconnecter.
 */
export function purgeLocalSessionData(): void {
  for (const store of [
    typeof localStorage !== "undefined" ? localStorage : null,
    typeof sessionStorage !== "undefined" ? sessionStorage : null,
  ]) {
    if (!store) continue;
    try {
      for (const key of keysToPurge(store)) {
        try {
          store.removeItem(key);
        } catch {
          /* une clé qui résiste ne doit pas arrêter les autres */
        }
      }
    } catch {
      /* stockage inaccessible (navigation privée) */
    }
  }
}
