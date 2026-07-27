# TradeVault — Blueprint UX/UI & parcours de conversion

> **Blueprint de propositions UX** (12 blocs) sur la stack existante — TanStack
> Start (SSR) · React 19 · Tailwind v4 (tokens `@theme`) · Supabase · Recharts ·
> lucide-react · cmdk. Chaque bloc s'appuie sur des modules déjà présents dans
> `src/app/` quand ils existent.
>
> Principes UX **en vigueur** (mobile-first, optimistic UI, états gérés) :
> [`project-context.md`](project-context.md) §11. Design system mesuré :
> [`design-system.md`](design-system.md). Priorités transverses :
> [`roadmap.md`](roadmap.md).
>
> **Format d'un bloc** : objectif · implémentation clé · priorité. Priorités
> internes à ce blueprint (Critique/Haute/Moyenne/Faible), distinctes de la grille
> P0→P3 de la roadmap.

---

## Bloc 0 — Design System (fondation transverse) · Critique

Formaliser le système émergent en contrat unique : tokens `--tv-*` (+ rampes
cyan/teal oklch), échelle typo (**Sora** display / **Manrope** texte, chiffres
tabulaires), rayons (`rounded-xl` contrôles, `2xl` cartes, `3xl` panneaux),
hauteur de contrôle `h-11` (44 px tactile), icônes lucide trait 1.75.
**Impl.** : documenter les tokens dans `styles.css` (source unique), extraire les
classes répétées vers un module UI partagé, tokeniser les couleurs en dur.
Prérequis des blocs 1, 2, 11, 12. Détail chiffré : [`design-system.md`](design-system.md).

## Bloc 1 — Landing haute conversion + logo · Critique

Restructurer `routes/index.tsx` en page de conversion : hero (valeur en 5 s + CTA
+ capture Dashboard), bande social proof, 3 sections bénéfice (Journal, Analytics,
Jarvis), section confiance, FAQ courte, CTA final. Logo redessiné en SVG (mono/couleur,
icônes PWA). Auth en carte latérale desktop / route dédiée mobile.
**Perf** : captures WebP/AVIF `lazy`, hero LCP optimisé, page déjà SSR.

## Bloc 2 — Onboarding immersif · Haute

Wizard post-inscription en 4 étapes (type de compte, thème, langue, premières
données via import CSV ou premier trade). Flag `onboarding_completed` sur le profil ;
réutilise `ThemeSettings`, `ImportCsvModal`, champ solde, sélecteur de langue.
Skippable et reprenable depuis Profil. Dépend du Bloc 3 (multicompte).

## Bloc 3 — Gestion multicompte · Critique (fondation)

Comptes multiples typés (Personal / Prop Firm / Démo) + solde initial + commutateur
global. Table `accounts` + `account_id` sur `trades`, RLS alignée ; migration
additive (compte « Personal » par défaut adopte les trades existants). `computeStats`,
équité et filtres opèrent sur le compte actif (un seul point de filtrage).
Index `(user_id, account_id)`. Consommé par les blocs 2 et 9.

## Bloc 4 — Sidebar PC par catégories · Haute

Regrouper `Sidebar.tsx` : **Principale** · **Analyse** · **Data** · **Paramètres**.
Labels de section (uppercase 10 px), routes nouvelles en lazy avec placeholders
« Bientôt » ; bottom-nav mobile ≤ 5 items, reste dans « Plus ». L'ordre des items
existants ne bouge pas. Remplit les blocs 7–10.

> Statut : la **navigation est désormais centralisée** dans `src/app/navigation.ts`
> (source unique par déroulé de session) — cf. [`project-context.md`](project-context.md) §8.

## Bloc 5 — Palette de commandes (Ctrl+K) étendue · Moyenne

Étendre `CommandPalette.tsx` (cmdk déjà intégré) : navigation vers toutes les pages,
actions rapides (nouveau trade, import CSV, changement de compte/thème), recherche de
trades par symbole. Registre d'actions typé alimenté par les contextes existants ;
groupes cmdk = catégories de nav. S'enrichit au fil des blocs 3, 7, 8.

## Bloc 6 — Micro-interactions HUD (curseur à lueur) · Faible

Halo lumineux suivant le pointeur, teinté `var(--tv-accent)`. Un seul div composité
GPU (`translate3d` via rAF, `mix-blend-mode: screen`, opacité ≤ 0.15), jamais
`cursor: none`. Désactivé au tactile, sous `prefers-reduced-motion`, et via
interrupteur Apparence. 60 fps, kill-switch utilisateur.

## Bloc 7 — Calendrier économique natif · Haute

Calendrier intégré (style Forex Factory) : semaine courante, filtres devise/impact,
heure locale, refresh hebdo. Table `economic_events` + Edge Function cron hebdo
ingérant une **source licite** (⚠️ ne pas scraper Forex Factory — « style FF » = UI,
pas la source). Fiche par annonce avec explication (dictionnaire statique i18n).
**Décision préalable** : choix de la source (légal/coût).

## Bloc 8 — Calculateur de positions autonome · Haute

Promouvoir le calculateur enfoui dans `TradeModal.tsx` (`calcContracts`, `POINT_VALUES`)
en page `/calculator`. Extraire la logique en `utils/positionCalc.ts` (zéro duplication),
étendre forex/actions, presets instruments, mémorisation du dernier setup, CTA
« Loguer ce trade » ouvrant `TradeModal` pré-rempli. Pur client, réutilise `loadAccountBalance`.

## Bloc 9 — Classement (score de discipline) · Moyenne

Leaderboard **opt-in** classant sur un **score de discipline** — jamais le PnL.
Score serveur (Edge Function quotidienne) : respect du risque, taux de trades sans
mistake (`behavioral.ts`), régularité de journalisation, complétude. Table
`leaderboard_scores` + pseudonyme, RLS stricte (aucune donnée financière exposée),
podium + rang + décomposition de son score. Revue privacy avant lancement.

## Bloc 10 — Data avancée : COT & Saisonnalité · Moyenne

Deux onglets Data : positionnement COT (fichiers hebdo publics CFTC, licites) et
saisonnalité mensuelle par instrument (dataset précalculé, cron mensuel). Ingestion
Edge Function → charts Recharts existants (`chartTheme.ts`). Datasets petits, cachés,
pages lazy. Complète la catégorie Data de la nav.

## Bloc 11 — Analyse IA comportementale étendue · Moyenne

Étendre Jarvis (`ai-insights.functions.ts`, page + widget) vers le proactif :
détection de patterns (revenge trading, sur-risque après perte, dérive de discipline)
et synthèses périodiques. Réutiliser les agrégats (`quantStats.ts`, `behavioral.ts`)
comme contexte de prompt ; prompts dédiés par pattern ; rapport hebdo à la demande
affiché dans la page Jarvis ; citations chiffrées obligatoires. Recouvre roadmap P0 #2.

## Bloc 12 — Thèmes avancés (full-surface, WCAG AA) · Moyenne

Étendre le moteur (`utils/themes.ts`) au-delà des accents (fonds, cartes, bordures,
textes, graphiques). `ThemeDef` + tokens de surface optionnels, `computeThemeVars`
génère la rampe oklch ; rétro-compatibilité (thèmes sans tokens surface héritent).
**Garde-fou contraste** dans l'éditeur : ratio WCAG en direct, avertissement sous AA
+ auto-correction de luminance. Prérequis : Bloc 0 (tokenisation).

---

## Phasage recommandé

| Phase | Blocs | Logique |
|---|---|---|
| 1 — Fondations | 0, 3, 1 | Design system + multicompte (migration structurante) + landing (acquisition) |
| 2 — Activation | 2, 4, 8 | Onboarding, sidebar catégorisée, calculateur (valeur quotidienne) |
| 3 — Data | 7, 10, 11 | Calendrier éco, COT/saisonnalité, IA proactive |
| 4 — Signature | 12, 9, 5, 6 | Thèmes full-surface, classement, Ctrl+K étendu, curseur HUD |

**À trancher avant la Phase 3** : source de données du calendrier économique
(licite, coût, couverture) ; périmètre privacy du classement (opt-in, pseudonymes,
par compte ou agrégé).
