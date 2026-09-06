/**
 * La langue du HTML SERVI — avant toute exécution de JavaScript.
 *
 * ── POURQUOI UN MODULE À DEUX LIGNES ────────────────────────────────────────
 *
 * Cette constante est lue par `routes/__root.tsx` (attribut `lang` de `<html>`)
 * ET par `app/pages/landing/i18n.tsx` (état initial du fournisseur de langue).
 * La déclarer dans le second et l'importer depuis le premier faisait entrer le
 * dictionnaire complet de la landing — une vingtaine de kilo-octets — dans le
 * chunk d'entrée, chargé sur CHAQUE route, y compris celles d'un trader
 * connecté qui ne verra jamais la page de vente. Mesuré : +24 Ko sur l'entrée.
 *
 * Un module sans dépendance résout le problème : il ne coûte que ce qu'il
 * pèse.
 *
 * ── CE QU'ELLE ENGAGE ───────────────────────────────────────────────────────
 *
 * Quatre choses doivent dire la MÊME langue, sinon un moteur de recherche lit
 * un document qui se contredit :
 *
 *   1. `<html lang>`                        — `routes/__root.tsx`
 *   2. le corps rendu côté serveur          — `LandingLangProvider`
 *   3. le titre et la description           — `routes/index.tsx`
 *   4. `og:locale`                          — `shared/seo.ts`
 *
 * Elles ne l'étaient pas : `lang="fr"`, `og:locale = fr_FR` et un titre
 * français, pour un corps rendu en ANGLAIS — parce que la détection de langue
 * s'exécutait dans l'initialiseur d'état et rendait « en » côté serveur.
 *
 * ── LA LANGUE « PAR DÉFAUT » DE LA VITRINE ──────────────────────────────────
 *
 * Anglais, pour TOUT le monde, quelle que soit la langue du navigateur. Même
 * règle que l'app une fois connectée (voir `LanguageContext`) : la langue ne
 * change que si le visiteur la choisit EXPLICITEMENT (sélecteur EN/FR de la
 * landing, persisté en localStorage). Pas d'auto-détection navigateur.
 *
 * Après hydratation, le choix explicite du visiteur est appliqué avant la
 * première peinture — voir `LandingLangProvider`.
 */

export type SiteLang = "en" | "fr";

export const SSR_LANG: SiteLang = "en";

/**
 * LA VITRINE FRANÇAISE A MAINTENANT UNE ADRESSE.
 *
 * Elle n'en avait pas. Le dictionnaire français existait — plusieurs centaines
 * de chaînes, entièrement traduites — mais il ne s'affichait qu'après un clic
 * sur le sélecteur EN/FR, À LA MÊME URL. Or un moteur de recherche n'indexe pas
 * un état d'interface : il indexe des adresses. Tout le contenu français du
 * produit était donc, littéralement, introuvable — sur le marché que le produit
 * adresse (les CGU, la politique de confidentialité et la voix du produit sont
 * en français).
 *
 * `/fr` sert désormais la même page, rendue en français DÈS LE SSR, et les deux
 * versions se déclarent mutuellement par `hreflang`. L'anglais reste à `/` et
 * reste `x-default` : c'est la langue servie par défaut à qui n'a rien choisi.
 *
 * Le préfixe est volontairement UNIQUE et exhaustif. Toute autre route — les
 * pages légales, les écrans authentifiés — n'existe qu'en une seule langue et
 * n'a donc pas d'alternative à déclarer.
 */
export const FR_PREFIX = "/fr";

/**
 * La langue à SERVIR pour un chemin donné, avant toute exécution de JavaScript.
 *
 * Lue par `routes/__root.tsx` pour l'attribut `lang` de `<html>`. Sans elle, la
 * page française était servie sous `<html lang="en">` — le document se
 * contredisait sur sa propre langue, ce qui est exactement le défaut que
 * `SSR_LANG` avait été créé pour corriger.
 */
export function langForPath(pathname: string): SiteLang {
  return pathname === FR_PREFIX || pathname.startsWith(`${FR_PREFIX}/`) ? "fr" : SSR_LANG;
}
