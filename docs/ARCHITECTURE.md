# Architecture

Source de vérité de la structure du code. Pour trouver une feature précise :
[`FEATURES.md`](FEATURES.md).

## 1. Carte des dossiers

```
src/
├── routes/        Routes d'URL TanStack (fichier = route). routeTree.gen.ts est GÉNÉRÉ.
├── app/           Tout le client React
│   ├── shell/     Cadre de l'app connectée : App, navigation, Sidebar, MobileNav,
│   │              CommandPalette, AccountSwitcher, écrans de chargement/erreur
│   ├── features/  Une feature = un dossier : sa page, ses composants, sa logique propre
│   ├── public/    Surface publique SSR : landing, légal, contact, tarifs, démo
│   ├── trading/   Code trading PARTAGÉ entre features côté client (graphes, filtres,
│   │              règles, hooks de trades)
│   ├── components/ Composants génériques partagés (Lightbox, MarkdownAnswer, Skeleton)
│   ├── hooks/     Hooks génériques (hauteur disponible, realtime, abonnement…)
│   ├── contexts/  Auth, Account, Theme, Toast, Confirm, PageActions
│   ├── store/     Accès Supabase (REST) : trades, comptes, profil, sessions… (+ store.ts, façade)
│   ├── i18n/      Traductions de l'app (LanguageContext, translations.ts, locales/)
│   ├── utils/     Helpers transverses (persistance, URL de page, thèmes, prix, limites de plan)
│   └── types.ts   Pages, sections, catalogues ; ré-exporte le type Trade de domain/
├── domain/        Noyau métier PUR partagé client ET serveur : Trade, calculs de stats,
│                  Edge Score, comportement, rapport mensuel, règles, plans, entitlement
├── modules/       Moteurs purs sans React : events, trading/analysis, discipline,
│                  automation, notifications, patterns, probability, coaching,
│                  economic-calendar, voice, ai, ai-provider
├── backend/       Frontière serveur : *.functions.ts (appelables par l'UI),
│                  *.server.ts (internes), ai-tools/, gardes d'accès
├── integrations/supabase/  Client typé, middleware d'auth, types GÉNÉRÉS
├── shared/        Helpers neutres (dates, devises, SEO, erreurs…) + shared/ui (primitives)
├── assets/        Ressources importées par le bundle (logo, captures produit)
├── server.ts      Entrée serveur : endpoints HTTP bruts, robots/sitemap, enveloppe d'erreur SSR
├── start.ts · router.tsx · styles.css
supabase/          migrations/ (additives) · functions/delete-account (RGPD)
tests/             Tests transverses bun:test (+ tests co-localisés dans src/**/tests)
scripts/           Preview, captures produit, image OG, voix, test SQL
public/            Fichiers statiques (voix de Jarvis, llms.txt, service worker push)
video/             Sous-projet Remotion indépendant (vidéos marketing)
content/           Contenus marketing (TikTok, hooks)
```

## 2. Règles de dépendance

```
routes ──▶ app (shell · features · public) ──▶ app/trading · components · hooks · store
   │                  │                                │
   │                  └──▶ backend/*.functions.ts      ▼
   │                                          domain · modules · shared
backend ──▶ domain · modules · integrations · shared
modules ──▶ domain · shared            (jamais app/, jamais React)
domain  ──▶ shared                     (pur : ni React, ni Supabase, ni navigateur)
shared  ──▶ rien de métier             (shared/ui : React, mais jamais app/)
```

| Couche | Peut importer | Ne doit pas importer |
| --- | --- | --- |
| `app/features/<x>` | tout `app/` partagé, une autre feature **quand il consomme sa donnée publique** (ex. `useGoalProgress`), `domain`, `modules`, `backend/*.functions.ts`, `shared` | `backend/*.server.ts` |
| `app/shell` | features (chargement paresseux), `app/` partagé | — |
| `app/trading`, `components`, `hooks`, `store`, `utils` | `domain`, `modules`, `shared`, `integrations` | une feature |
| `domain` | `shared` | `app`, `modules`, React, Supabase, `process.env` |
| `modules` | `domain`, `shared`, autres `modules` | `app`, React |
| `backend` | `domain`, `modules`, `integrations`, `shared`, `process.env` | `app` |

**Exception connue, documentée** : `modules/patterns` importe
`app/trading/mistakeClusters` (qui dépend des traductions de l'app). La corriger
demande de sortir les libellés de clusters des traductions ; non fait pour ne
rien changer au comportement.

`src/backend/ai.functions.ts` (catalogue historique de services IA) n'est
importé par aucune surface ; il est conservé car `tests/httpPerimeter.test.ts`
le vérifie.

## 3. Frontend

**Deux niveaux de routage.**
1. *URL* (`src/routes/`) : `/` monte l'app (`shell/App.tsx`) ou la landing ;
   `/$page` donne une URL à chaque écran authentifié (`/journal`,
   `/analytics`…, jamais indexé) ; pages publiques `/fr`, `/pricing`,
   `/privacy`, `/terms`, `/cgu`, `/cookies`, `/contact` ; utilitaires `/demo`,
   `/demo-site`, `/reset-password`, `/dev/ui`, `/dev/ai`.
2. *Écran* : `PAGES` et `SECTIONS` (`app/types.ts`) sont la source unique ;
   `shell/navigation.ts` en dérive la sidebar, la barre mobile et la palette ⌘K.
   Ajouter un écran = l'ajouter à `PAGES`, à une section, et à
   `shell/pageModules.ts` (chargement paresseux, préchargé au survol).

**État et données.**
- Trades : React Query (`app/trading/useTrades`, clé
  `["trades", userId, accountId]`), écriture **optimiste** avec restauration
  du snapshot en cas d'échec.
- Statistiques : **calculées en mémoire côté client** par les fonctions pures
  de `domain/` (`computeStats`, `computeQuantStats`, `computeEdgeScore`…) via
  `useTradeStats` — aucune requête, aucun N+1.
- Contextes React : Auth, Account (sous-comptes), Language, Theme, Toast,
  Confirm, PageActions.
- `localStorage` namespacé par utilisateur (`utils/persistence.ts`,
  `nsKey`) ; tout est purgé à la déconnexion (`utils/session-purge.ts`).
- Pages plein écran (non défilantes) : `hooks/useAvailableHeight.ts`.

**Surface publique.** `/`, `/fr`, les pages légales, `/contact`, `/pricing`
se rendent en SSR complet, **hors de l'arbre de l'app** (pas de
`LanguageProvider`) ; elles lisent la langue via `public/usePersistedLang`.
Toute nouvelle route publique indexable s'ajoute à `PUBLIC_ROUTES`
(`src/server.ts`) — voir [`SEO.md`](SEO.md).

## 4. Moteurs (`src/modules/`)

Purs, déterministes, testables, reliés par un bus d'événements typé.
**Étendre = ajouter un événement, un listener ou un step** ; ne jamais éditer un
moteur pour en brancher un autre.

| Moteur | Rôle |
| --- | --- |
| `events` | Bus in-process typé (`DomainEvents`), par runtime ; handlers isolés en erreur, `emit` attend les listeners |
| `trading/analysis` | `analyzeTrade` → 4 sous-scores, note A→F, flags stables |
| `discipline` | Seul décideur de discipline (via `domain/ruleCheck`) → événements `DISCIPLINE_*` |
| `automation` | Chaîne « trade sauvegardé » : `validate → analyze → discipline` (steps ordonnés) |
| `notifications` | Entonnoir unique vers dashboard / toast / push / e-mail ; règles codées dédupliquées une fois par jour |
| `patterns` | Détection de motifs déterministe → propositions (voir [`AI.md`](AI.md)) |
| `probability` | Monte Carlo seedable, scénarios, sensibilité, objectifs |
| `coaching` | Observations d'après-trade et sécurité statistique |
| `economic-calendar` | Source Forex Factory (fournisseur interchangeable) |
| `voice` | Voix unique de Jarvis (clips, voix locale, prosodie) |
| `ai`, `ai-provider` | Plateforme IA — [`AI.md`](AI.md) |

## 5. Cycle de vie d'un trade

1. `features/journal/TradeModal` → `shell/App.tsx` met le cache React Query à
   jour immédiatement.
2. `store/trades.ts` persiste dans Supabase ; échec → snapshot restauré + toast.
3. `AutomationEngine.tradeSaved()` émet `TradeCreated/Updated` puis déroule le
   pipeline ; les moteurs ne se parlent que par le bus.
4. `NotificationEngine` route vers le bon canal ; ce qui doit survivre est
   persisté (RLS owner-only).

## 6. Build et déploiement

- Vite via `@lovable.dev/vite-tanstack-config` (inclut déjà TanStack Start,
  React, Tailwind, alias `@`, Nitro) : **ne pas réajouter ces plugins**.
- Nitro preset `vercel` ; `bun run preview` produit un bundle node local.
- Toutes les pages sauf le Dashboard sont chargées paresseusement ; les
  dictionnaires i18n non anglais sont découpés.
- En-têtes de sécurité et crons : `vercel.json`. Pousser `main` déploie.

## 7. Où placer un nouveau fichier

1. Utilisé par **une seule feature** → `app/features/<feature>/` (page,
   composant, hook, logique, test dans `tests/`). Pas de sous-dossier sans
   nécessité réelle.
2. Utilisé par **plusieurs features**, lié au trading → `app/trading/`.
   Générique (UI, hook, helper) → `app/components/`, `app/hooks/`, `app/utils/`.
3. **Calcul pur** dont le serveur a (ou aura) besoin → `domain/`.
4. **Moteur** autonome avec son vocabulaire d'événements → `modules/<nom>/`
   (`index.ts` public, `engine.ts`, `types.ts`).
5. Code serveur → `backend/` (`*.functions.ts` si appelé par l'UI,
   `*.server.ts` sinon). Secret → `process.env`, jamais côté client.
6. Primitive visuelle réutilisable → `shared/ui/` (n'importe jamais `app/`).
7. Nouvelle route → `src/routes/`, puis `bun run build` régénère
   `routeTree.gen.ts` (à committer).

**Nommage** : composant `PascalCase.tsx` · hook `useXxx.ts` · logique
`camelCase.ts` au nom précis (pas de `helpers.ts`/`utils.ts` génériques pour du
nouveau code) · contexte `XxxContext.tsx` · migration
`AAAAMMJJHHMMSS_description.sql`. Imports : relatifs à l'intérieur d'un dossier,
`@/` au-delà (pas de `../../`).

**Supprimer un fichier** : seulement avec la preuve qu'il n'a aucun importeur
(statique, dynamique, `lazyPage`, `import.meta.glob`), aucune référence en
chaîne (tests qui lisent les sources, scripts, config) et aucun effet de bord.
Sans preuve, on garde.
