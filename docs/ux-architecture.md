# TradeVault — Blueprint UX/UI, Design System & Parcours de Conversion

> Contrainte de cadrage : stack existante inchangée — TanStack Start (SSR) + React 19,
> Tailwind 4 (tokens CSS `@theme`), Supabase (auth/DB/storage/Edge Functions),
> Recharts, lucide-react, cmdk. Chaque bloc ci-dessous s'appuie sur des modules
> déjà présents dans `src/tradevault/` quand ils existent.

---

## Bloc 0 — Design System (fondation transverse)

- **Objectif** — Formaliser le système déjà émergent en contrat unique : tokens couleur (`--tv-*` + ramps cyan/teal oklch régénérées), échelle typographique (Space Grotesk display / Inter texte, chiffres tabulaires), rayons (`rounded-xl` contrôles, `rounded-2xl` cartes, `rounded-3xl` panneaux), hauteur de contrôle unifiée (`h-11` = 44 px tactile), iconographie lucide à trait 1.75 unique.
- **Bénéfice utilisateur** — Interface perçue comme un produit d'équipe senior : chaque écran obéit aux mêmes règles, zéro dissonance.
- **Approche d'implémentation** — Documenter les tokens dans `styles.css` (source de vérité) ; extraire les classes répétées (`fieldBase`, `labelClass` de `TradeModal.tsx`) vers un module partagé `utils/ui.ts` ; auditer les valeurs codées en dur (`#0a0f1e` dans `chartTheme.ts`, fonds tooltip) et les basculer sur variables pour préparer le Bloc 11.
- **Impact UX** — Cohérence systémique ; accélère tous les blocs suivants.
- **Impact performance** — Nul (CSS variables déjà en place, aucune dépendance ajoutée).
- **Priorité** — Critique
- **Dépendances éventuelles** — Aucune ; prérequis des blocs 1, 2, 11.

---

## Bloc 1 — Landing Page haute conversion + logo modernisé

- **Objectif** — Restructurer `routes/index.tsx` en page de conversion : proposition de valeur en 5 secondes, démonstration visuelle réelle du produit, réassurance, CTA répétés.
- **Bénéfice utilisateur** — Le visiteur comprend immédiatement ce que fait TradeVault et pourquoi s'inscrire.
- **Approche d'implémentation** — Structure : (1) hero — titre bénéfice + sous-titre + CTA principal + capture du Dashboard dans un cadre device CSS (aucune lib) ; (2) bande métriques/social proof ; (3) trois sections bénéfice alternées avec captures réelles (Journal, Analytics, Coach IA) ; (4) section confiance — données Supabase chiffrées, export CSV, PWA ; (5) FAQ courte ; (6) CTA final. Auth conservée en carte latérale sur desktop, en route dédiée au scroll mobile. Logo : redessiner le mark en SVG vectoriel (monogramme « TV » fusionné à un chandelier haussier), déclinaisons mono/couleur, remplace `assets/tradevault-logo.png` + icônes PWA.
- **Impact UX** — Première impression premium alignée avec l'intérieur de l'app (mêmes tokens, mêmes polices).
- **Impact performance** — Captures en WebP/AVIF `loading="lazy"` hors hero ; hero LCP optimisé (image préchargée, pas de blur lourd) ; page déjà SSR.
- **Priorité** — Critique
- **Dépendances éventuelles** — Captures produit à jour ; logo SVG à valider avant déclinaison PWA.

---

## Bloc 2 — Onboarding immersif

- **Objectif** — Wizard post-inscription en 4 étapes : type de compte (Personal / Prop Firm / Démo + montant initial), préférences visuelles (thème), langue, premières données (import CSV ou premier trade guidé).
- **Bénéfice utilisateur** — Time-to-value minimal : le trader arrive sur un Dashboard déjà configuré à son image.
- **Approche d'implémentation** — Flag `onboarding_completed` sur le profil Supabase ; wizard plein écran lazy-loadé rendu au-dessus de `App.tsx` tant que le flag est faux ; réutilise tel quel `ThemeSettings` (sélecteur de thème), `ImportCsvModal`, le champ solde de départ de `Profile.tsx` et le sélecteur de langue. Skippable à chaque étape, reprenable depuis Profil.
- **Impact UX** — Réduit l'abandon J1 ; l'étape thème crée l'appropriation émotionnelle immédiate.
- **Impact performance** — Chunk lazy chargé une seule fois par vie de compte ; zéro poids sur l'app courante.
- **Priorité** — Haute
- **Dépendances éventuelles** — Bloc 3 (multicompte) pour l'étape type de compte — livrable en attendant avec compte unique + solde.

---

## Bloc 3 — Gestion multicompte (Personal Funds / Prop Firm / Démo)

- **Objectif** — Comptes multiples par utilisateur, chacun typé et doté d'un solde initial, avec commutateur global.
- **Bénéfice utilisateur** — Séparation propre perso / prop firm / démo — le cas d'usage réel des traders financés, aujourd'hui impossible.
- **Approche d'implémentation** — Table `accounts` (id, user_id, name, type, starting_balance, currency) + colonne `account_id` sur `trades`, RLS alignée sur l'existant ; migration : création d'un compte « Personal » par défaut adoptant les trades existants (zéro perte) ; sélecteur de compte dans le header du shell + action Ctrl+K ; `computeStats`/équity/filtres opèrent sur le compte actif (un seul point de filtrage dans le store).
- **Impact UX** — Fondation silencieuse : l'UI ne change presque pas, la valeur explose.
- **Impact performance** — Index sur `(user_id, account_id)` ; volumes identiques par requête.
- **Priorité** — Critique (fondation — l'onboarding, le classement et les stats en dépendent)
- **Dépendances éventuelles** — Migration Supabase + RLS ; consommé par les blocs 2 et 9.

---

## Bloc 4 — Sidebar fixe PC restructurée par catégories

- **Objectif** — Réorganiser `Sidebar.tsx` en quatre groupes étanches : **Principale** (Dashboard, Journal, Calculateur, Classement) · **Analyse** (Statistiques, Analyse IA, Notes, Calendrier) · **Data** (COT, News Éco, Saisonnalité) · **Paramètres** (Comptes, Profil, Apparence, Langue).
- **Bénéfice utilisateur** — Repérage instantané ; la navigation absorbe les nouvelles pages sans devenir une liste plate illisible.
- **Approche d'implémentation** — Groupes avec libellés de section (style : uppercase 10 px, `tracking-wider`, `text-slate-500` — déjà le motif des labels du produit) ; routes nouvelles enregistrées en lazy (`/calculator`, `/leaderboard`, `/notes`, `/cot`, `/news`, `/seasonality`) avec placeholders « Bientôt » tant que le module n'est pas livré ; mobile : la bottom-nav garde 5 items maximum, le reste passe dans un panneau « Plus ».
- **Impact UX** — Clarté absolue ; l'ordre des items existants ne bouge pas (mémoire musculaire préservée).
- **Impact performance** — Routes code-splittées ; sidebar inchangée en coût de rendu.
- **Priorité** — Haute
- **Dépendances éventuelles** — Blocs 7–10 pour remplir les placeholders ; livrable avant eux.

---

## Bloc 5 — Palette de commandes (Ctrl+K) étendue

- **Objectif** — Étendre `CommandPalette.tsx` (cmdk déjà intégré) : navigation vers toutes les pages, actions rapides (nouveau trade, import CSV, changement de compte, changement de thème), recherche de trades par symbole.
- **Bénéfice utilisateur** — Les power users pilotent l'app sans souris — signature « outil pro ».
- **Approche d'implémentation** — Registre d'actions central typé (`id, label, icône, groupe, raccourci, handler`) alimenté par les contextes existants (thèmes via `useTheme`, comptes via Bloc 3) ; groupes cmdk = les catégories de la sidebar ; actions contextuelles injectées par page.
- **Impact UX** — Vitesse perçue ; découvrabilité des nouvelles fonctions.
- **Impact performance** — Composant déjà chargé ; registre statique, négligeable.
- **Priorité** — Moyenne
- **Dépendances éventuelles** — S'enrichit au fil des blocs 3, 7, 8 ; aucune dépendance bloquante.

---

## Bloc 6 — Micro-interactions HUD (curseur à lueur thématique)

- **Objectif** — Halo lumineux suivant le pointeur, s'intensifiant au survol des éléments interactifs, teinté `var(--tv-accent)` du thème actif.
- **Bénéfice utilisateur** — Signature sensorielle « HUD terminal » unique, cohérente avec le curseur de graphique déjà livré.
- **Approche d'implémentation** — Un seul div fixe composité (`transform: translate3d` via rAF, `mix-blend-mode: screen`, opacité ≤ 0.15) sous le curseur natif — jamais de `cursor: none` (accessibilité) ; interaction détectée par delegation sur `a, button, [role=button]` ; désactivé sur pointeurs tactiles (`(hover: none)`), sous `prefers-reduced-motion`, et via interrupteur dans Apparence.
- **Impact UX** — Différenciateur émotionnel ; réglé bas pour rester sous le seuil de distraction.
- **Impact performance** — 1 élément GPU-composité, transform uniquement — 60 fps ; kill-switch utilisateur.
- **Priorité** — Faible
- **Dépendances éventuelles** — Système de thèmes actuel (déjà en place).

---

## Bloc 7 — Calendrier économique natif (News Éco)

- **Objectif** — Calendrier économique intégré façon Forex Factory : semaine courante, filtres devises et niveau d'impact (codes couleur), heure locale, mise à jour hebdomadaire automatisée, vulgarisation de l'impact de chaque type d'annonce.
- **Bénéfice utilisateur** — Plus d'aller-retour vers un site externe ; le contexte news vit à côté du journal (badge « jour de news » sur les trades du jour).
- **Approche d'implémentation** — Table `economic_events` + Edge Function planifiée (cron hebdo) ingérant une **source de données licite** — API dédiée ou flux public ; ⚠️ ne pas scraper Forex Factory (violation ToS, fragile) : « style FF » = pattern UI, pas la source. UI native : tableau semaine, chips devise, pastilles impact (rouge/orange/jaune), fuseau via `date-fns` (présent), fiche par annonce avec explication statistique simplifiée (dictionnaire statique par type d'événement, i18n).
- **Impact UX** — Transforme le journal en hub de préparation de séance — différenciateur majeur.
- **Impact performance** — Une requête par semaine, cachée (TanStack Query présent) ; rendu tableau trivial.
- **Priorité** — Haute
- **Dépendances éventuelles** — Choix de la source de données (contrainte légale/coût — décision à prendre en premier) ; cron Supabase.

---

## Bloc 8 — Calculateur de positions autonome

- **Objectif** — Promouvoir le calculateur enfoui dans `TradeModal.tsx` (`calcContracts`, `POINT_VALUES`) en page dédiée `/calculator` : risque, dimensionnement lots/contrats, impact PnL pré-exécution.
- **Bénéfice utilisateur** — L'outil du quotidien pré-trade accessible en deux clics, sans ouvrir une saisie de trade.
- **Approche d'implémentation** — Extraire la logique en util partagé (`utils/positionCalc.ts`) consommé par la page et le modal (zéro duplication) ; étendre aux modes forex (valeur pip/lot standard-mini-micro) et actions (risque/action), presets instruments enrichis ; mémorisation du dernier setup (localStorage) ; CTA « Loguer ce trade » ouvrant `TradeModal` pré-rempli (risque, direction).
- **Impact UX** — Boucle complète préparer → exécuter → journaliser dans un seul produit.
- **Impact performance** — Pur client, aucun réseau ; nul.
- **Priorité** — Haute
- **Dépendances éventuelles** — Aucune externe ; réutilise `loadAccountBalance` existant.

---

## Bloc 9 — Classement (score de discipline)

- **Objectif** — Leaderboard opt-in classant les utilisateurs sur un **score de discipline** — jamais sur le PnL.
- **Bénéfice utilisateur** — Gamifie le process (respect du risque, absence d'erreurs, régularité de journalisation) plutôt que la performance — sain et motivant.
- **Approche d'implémentation** — Score serveur (Edge Function quotidienne) : composantes = respect du risque défini, taux de trades sans mistake tags (`behavioral.ts` existant), régularité de tenue du journal, complétude des entrées ; table `leaderboard_scores` + pseudonyme choisi, **opt-in explicite**, RLS stricte (aucune donnée financière exposée) ; UI : podium + rang personnel + décomposition de son propre score (levier pédagogique principal).
- **Impact UX** — Rétention par habitude ; renforce l'ADN « discipline » du produit.
- **Impact performance** — Calcul asynchrone hors requêtes utilisateur ; lecture d'une table indexée.
- **Priorité** — Moyenne
- **Dépendances éventuelles** — Bloc 3 (score par compte ou agrégé — à trancher) ; revue privacy avant lancement.

---

## Bloc 10 — Data avancée : COT & Saisonnalité

- **Objectif** — Deux onglets Data : positionnement institutionnel (rapport COT hebdomadaire CFTC) et tendances de saisonnalité mensuelles par instrument.
- **Bénéfice utilisateur** — Contexte macro et edge statistique au même endroit que le journal — montée en gamme « plateforme d'analyse ».
- **Approche d'implémentation** — COT : données publiques CFTC (fichiers hebdomadaires, licites) ingérées par Edge Function → charts Recharts existants (net positions commercials/non-commercials, historique) réutilisant `chartTheme.ts` ; Saisonnalité : dataset précalculé (moyennes mensuelles sur N années par instrument majeur), stocké statiquement et rafraîchi par cron mensuel ; vulgarisation courte par vue (que lire, que ne pas sur-lire).
- **Impact UX** — Complète la catégorie Data de la sidebar ; cohérence visuelle garantie par le thème de charts partagé.
- **Impact performance** — Datasets petits et cachés ; pages lazy.
- **Priorité** — Moyenne
- **Dépendances éventuelles** — Pipeline d'ingestion CFTC ; Bloc 4 (emplacement nav).

---

## Bloc 11 — Analyse IA comportementale étendue

- **Objectif** — Étendre l'IA existante (`ai-insights.functions.ts`, Insights, Coach flottant) vers l'analyse comportementale proactive : détection de patterns (revenge trading, sur-risque après perte, dérive de discipline) et synthèses périodiques.
- **Bénéfice utilisateur** — Le coach passe de « répond aux questions » à « repère ce que le trader ne voit pas ».
- **Approche d'implémentation** — Réutiliser les agrégats déjà calculés (`quantStats.ts`, `behavioral.ts`) comme contexte structuré du prompt (pas de données brutes superflues) ; prompts dédiés par pattern ; rapport hebdo généré à la demande (pas de cron coûteux au départ) affiché dans Insights ; citations chiffrées obligatoires (règle déjà présente dans le prompt système).
- **Impact UX** — Valeur perçue maximale de la brique IA existante, sans nouveau paradigme d'interface.
- **Impact performance** — Coût API Gemini borné (contexte agrégé, génération à la demande).
- **Priorité** — Moyenne
- **Dépendances éventuelles** — Quotas/clé Gemini ; volume de trades minimal pour pertinence (garde-fou déjà prévu côté prompt).

---

## Bloc 12 — Système de thèmes avancé (full-surface, WCAG AA)

- **Objectif** — Étendre le moteur (`utils/themes.ts`) au-delà des accents : fonds, cartes, bordures, textes et graphiques deviennent thémables.
- **Bénéfice utilisateur** — Personnalisation totale de l'ambiance — de « choisir un accent » à « posséder son terminal ».
- **Approche d'implémentation** — Étendre `ThemeDef` avec tokens de surface optionnels (`bg`, `surface`, `surface2`, `border`, `text`, `textMuted`) ; `computeThemeVars` génère la ramp complète en oklch (la mécanique hue/chroma existe déjà) ; rétro-compatibilité : thèmes existants sans tokens surface héritent des valeurs actuelles ; **garde-fou contraste obligatoire** dans l'éditeur — ratio WCAG calculé en direct, avertissement sous AA et auto-correction de la luminance oklch proposée ; prérequis : tokenisation des valeurs codées en dur (Bloc 0).
- **Impact UX** — Différenciateur premium fort ; les garde-fous empêchent les thèmes illisibles.
- **Impact performance** — Toujours des CSS variables appliquées en un paint ; nul.
- **Priorité** — Moyenne
- **Dépendances éventuelles** — Bloc 0 (audit des couleurs en dur) ; éditeur `ThemeSettings` existant comme socle.

---

## Phasage recommandé

| Phase          | Blocs       | Logique                                                                              |
| -------------- | ----------- | ------------------------------------------------------------------------------------ |
| 1 — Fondations | 0, 3, 1     | Design system + multicompte (migration la plus structurante) + landing (acquisition) |
| 2 — Activation | 2, 4, 8     | Onboarding, sidebar catégorisée, calculateur (valeur quotidienne immédiate)          |
| 3 — Data       | 7, 10, 11   | Calendrier éco, COT/saisonnalité, IA proactive                                       |
| 4 — Signature  | 12, 9, 5, 6 | Thèmes full-surface, classement, Ctrl+K étendu, curseur HUD                          |

**Décisions à trancher avant Phase 3** : source de données du calendrier économique (licite, coût, couverture) ; périmètre privacy du classement (opt-in, pseudonymes, par compte ou agrégé).
