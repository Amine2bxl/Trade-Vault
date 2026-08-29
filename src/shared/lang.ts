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
 * Basculer la vitrine en anglais demande donc de changer les quatre, pas
 * celle-ci seule.
 *
 * Après hydratation, la langue réelle du visiteur est appliquée avant la
 * première peinture — voir `LandingLangProvider`.
 */

export type SiteLang = "en" | "fr";

export const SSR_LANG: SiteLang = "fr";
