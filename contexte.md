# Contexte projet — TradeVault

> Fichier de passation à donner à Claude dans une nouvelle conversation.
> Objectif : comprendre en un coup d'œil ce qu'est TradeVault, comment le code
> est organisé, les conventions à respecter, et l'historique des modifications
> récentes (session de refonte UX/UI pré-Sprint 3).

---

## 1. Qu'est-ce que TradeVault ?

Un **AI Trading Operating System** (SaaS) pour traders retail : journal de
trades, analytics, calendrier/heatmap, plan de trading, objectifs, checklist
pre-market, et un coach IA unique appelé **Jarvis**. Architecture pensée pour
des dizaines de milliers d'utilisateurs, propre et évolutive.

La charte permanente de l'équipe est dans **`CLAUDE.md`** (à la racine) — elle
prime sur toute habitude par défaut. Axes de décision, dans l'ordre :
1. Simplicité · 2. Performance (UI optimiste, jamais d'attente) · 3. Sécurité
(RLS owner-only, secrets côté serveur) · 4. Scalabilité · 5. Maintenabilité ·
6. UX · 7. ROI.

## 2. Stack & commandes

- **TanStack Start** (SSR) · **React 19** · **TypeScript** · **Vite** · **Bun**
- **Supabase** (Postgres + RLS owner-only) pour la persistance/auth
- **Tailwind v4** (+ lightningcss) · **Radix UI** · icônes **lucide-react**
- IA **provider-agnostique** (le modèle est une variable d'env, zéro refactor)

Commandes : `bun run dev` · `bun run build` · `bun run lint` · `bun run format`
· `bun test`.

> Note build : dans certains environnements, `bun run build` peut nécessiter
> `nitro` (workaround `npm i --no-save nitro`, **non commité**).

## 3. Organisation du code (sens des dépendances : UI → modules, jamais l'inverse)

```
src/
  app/                → UI (React) : pages, composants, contexts, hooks, i18n
    pages/            → une page par écran (Dashboard, Journal, Analytics, …)
    components/       → composants partagés (Sidebar, MobileNav, AiAssistant, …)
    onboarding/       → parcours d'onboarding (Onboarding.tsx, onboardingCopy.ts)
    contexts/         → Auth, Account, Toast, Confirm, Theme, Language
    hooks/            → useTrades, useTradeStats, useSubscription, usePushNotifications…
    utils/            → tradeCalcs, aiContext, jarvisVoice, persistence, cn…
    i18n/             → translations.ts (EN = source), locales/*.ts (11 autres)
    navigation.ts     → SOURCE UNIQUE de la nav (NAV_GROUPS, MOBILE_BAR)
    store.ts / store/ → couche persistance Supabase (barrel + domaines)
  modules/            → LOGIQUE MÉTIER pure (aucune dépendance React)
    ai/               → agents (coach.agent), context-builder, provider-service…
    notifications/    → moteur de notifications + types
    automation/       → AutomationEngine (post-save : analyse, discipline…)
    trading/          → analyse (behavioral, etc.)
  backend/            → server functions TanStack (coach.functions, tts.functions,
                        push.functions, reports.functions, require-pro…)
  shared/ui/          → DESIGN SYSTEM centralisé (voir §4)
  integrations/       → client Supabase
```

**Règles d'architecture (non négociables) :**
- `src/app/` importe `src/modules/` — **jamais l'inverse**. Aucune logique
  métier dans les composants React.
- Moteurs purs & déterministes (le Trade Analysis Engine ne fait ni IO ni IA ;
  l'IA interprète les scores, ne les recalcule jamais).
- Extension par plug-in (nouvel événement + listener), on n'édite pas un moteur
  pour en brancher un autre.
- Persistance = ce qui doit survivre au runtime → DB avec **RLS owner-only**.
- Migrations additives uniquement.

## 4. Design System (`src/shared/ui`)

Home unique des primitives visuelles, importées via `@/shared/ui` :
`PageHeader`, `SectionHeader`, `EmptyState`, `Metric`, `Card`, `Button`,
`Input`/`Textarea`/`Select`/`Field`, `Table`, `Modal`, `Badge`, `Typography`,
`ChartContainer`, plus `tokens`/`cn`. **Règle : `shared/ui` n'importe jamais
`app/`.** Le look global = cartes « glass »/« glass-strong », dégradés
cyan→teal, `rounded-2xl`, animations globales (`animate-fade-in-up`,
`animate-slide-up`, `animate-slide-in`, `animate-pulse`).

## 5. i18n (12 langues)

- **EN = source de vérité** dans `src/app/i18n/translations.ts` (objet `en`).
- Les 11 autres locales sont des `Dict` **partiels** dans
  `src/app/i18n/locales/*.ts` → toute clé manquante retombe sur l'anglais.
- Ajouter une clé = l'ajouter au moins en `en` (+ `fr` de préférence).
  `TKey` est l'union typée des clés.

## 6. Jarvis — l'IA unique

Une seule identité IA dans tout le produit (fini « AI Coach » / « Assistant » /
« Insights »).
- **Persona** centralisée dans `src/modules/ai/agents/coach.agent.ts`
  (`coachIdentity`) : intelligent, calme, professionnel, honnête, exigeant ;
  récompense la discipline, confronte les erreurs, zéro compliment vide, zéro
  ton support ; réponses courtes et orientées action. Grounding strict
  (`ANTI_HALLUCINATION`) : ne cite que les données fournies.
- **Server function** : `backend/coach.functions.ts` → `askCoach` (Zod,
  `requireProAccess`, secrets côté serveur).
- **Page Jarvis** : `src/app/pages/Jarvis.tsx` (ex-Insights) — briefing du jour
  déterministe, KPI live (Metric), forces/faiblesses, chat persistant, voix.
- **Widget flottant** : `src/app/components/AiAssistant.tsx` (mêmes appels).
- **Voix** : `src/app/utils/jarvisVoice.ts` (`useJarvisVoice`,
  `pickEnglishMaleVoice`) + `backend/tts.functions.ts` (ElevenLabs, voix
  `IKne3meq5aSn9XLyUdCD`, modèle `eleven_multilingual_v2`). **Voix toujours en
  anglais** ; fallback silencieux sur une voix masculine navigateur si la clé
  `ELEVENLABS_API_KEY` manque ou en cas d'échec. Réponses écrites = langue UI.

## 7. Checklist Pre-Market (`src/app/pages/Checklist.tsx`) — pièce centrale

Refondue pour être **native au Design System** tout en gardant une **identité
holographique légère** (fichier `checklist.css` minuscule et scopé `tvchk-*` :
grille + scanline discrètes, waveform vocale, sheen). **Aucune logique métier ne
doit être modifiée lors d'un travail purement UI** (états, handlers, effets,
moteur vocal, wiring Jarvis restent identiques).

Structure d'écran :
- **Header** : icône Jarvis + titre + chips de statut (date/heure, fenêtre de
  session, ready/standby/locked, streak) + bouton **« Demander à Jarvis »**
  (le composant IA unique) + boutons voix / éditeur / personnaliser.
- **Progression en 5 étapes** numérotées :
  `Préparation → Validation → Mental → Verrouillage → Trade`.
- **Panneau « Personnaliser »** (état `showConfig`) : quand il est ouvert, les
  5 étapes sont **masquées** (`{!showConfig && …}`) ; navigation **par onglets**
  (`cfgTab` : Critères · Session · Modèles · Avancé) pour ne montrer qu'une
  chose à la fois.
- **Overlays** : compte à rebours, « Edge Locked », widget vocal (pilule
  premium centrée en bas, `z-[60]`, jamais cachée par la navbar).

Fichiers liés :
- `ChecklistWizard.tsx` → **setup adaptatif** : questionnaire court (style ·
  marché · lecture · plus grosse fuite · garde-fous · session). Chaque réponse
  porte les checks exacts qu'elle ajoute → checklist ciblée sur le profil, pas
  générique. Contrat `onApply(WizardResult{items,startTime,timeZone})`.
- `checklistDefaults.ts` → `defaultConfigFor`, `templatesFor` (modèles ICT /
  Essentiel / Swing / Prop), `generateChecklist`, `coachPromptsFor`,
  `isItemOn`, `ranksFor`. Critères concrets « retail humain » (ex. « Risque ≤
  0.5% », « Max 2 trades », « SL sur structure », « R:R ≥ 3 »).
- `checklist/helpers.ts` (FOMO_ICONS, pad, timezone…), `checklist/voice.ts`
  (LINES, TONES).

## 8. Autres domaines utiles

- **Navigation** : `src/app/navigation.ts` = source unique. Groupes
  `Home · Préparation · Journal · Analyse · Jarvis · Compte`. Sidebar, MobileNav
  et CommandPalette en dérivent (ajouter/déplacer une page = 1 seule édition).
- **Plan 6 mois (Goals)** : `src/app/utils/goalPlan.ts` — plan déterministe ;
  la tâche mensuelle partagée cible la **fuite récurrente réelle** du trader
  (lue dans `stats.mistakeStats`) sans changer le nombre/clé des tâches
  (invariant testé dans `tests/goalPlan.test.ts`).
- **Abonnement** : page `Subscription.tsx` = **statut seul** (plan, essai, jours
  restants), **aucun prix ni logique Stripe**. Le flux de paiement réel
  (`SubscriptionSection.tsx`) n'est plus monté sur Profile.
- **Notifications** : opt-in demandé **dans l'onboarding** (étape « notify ») et
  réglable dans **Réglages** — plus de bannière sur le Dashboard. Moteur
  `modules/notifications` (titres localisés, anti-spam push par jour).
- **Données « live » ?** : Economic News (`utils/economicEvents.ts`) et
  Seasonality (`utils/assetSeasonality.ts`) sont des jeux **déterministes/curés,
  pas live**, avec un point d'insertion propre (`EventProvider` /
  `ASSET_SEASONALITY`) pour brancher une API licenciée plus tard.

## 9. Garde-fous / zones sensibles

- **Zone Trustpilot** dans `store.ts` : **gelée, ne pas toucher**.
- `.env` gitignoré ; `ELEVENLABS_API_KEY` **server-only** (`process.env`),
  jamais exposée au client. Aucun secret commité.
- Pas de breaking change ; migrations additives ; RLS owner-only partout.

## 10. Après chaque implémentation (checklist qualité)

1. `bun run lint` (0 erreur) · `bun test` (55 verts) · `bun run build`.
2. Pas de régression perçue, pas de N+1, pas de blocage UI.
3. Sécurité (RLS, auth, validation d'entrée, aucun secret fuité).
4. Compat IA future (moteurs découplés, provider-agnostique).

## 11. État Git / PR

- Branche de travail : **`claude/tradevault-refactor-foundation-e6j7hq`**.
- **PR #63** (`Amine2bxl/Trade-Vault`) — sert surtout à visualiser via la
  preview Vercel (URL de branche stable postée par le bot Vercel en commentaire
  de la PR). Base actuelle : la branche DS `claude/tradevault-audit-design-system-e6j7hq`.
- Commits : identité **`Claude <noreply@anthropic.com>`** (sinon GitHub les
  marque « Unverified » — `git commit --amend --no-edit --reset-author`).

## 12. Journal des modifications récentes (session refonte pré-Sprint 3)

Résumé chronologique de ce qui a été fait (toutes sur la branche ci-dessus) :

1. **Navigation** réorganisée par déroulé d'une session de trading (source
   unique `navigation.ts`), sidebar densifiée.
2. **Jarvis unifié** : persona unique, page Jarvis reconstruite (briefing, KPI,
   forces/faiblesses, chat, voix), voix mutualisée `jarvisVoice.ts`.
3. **Plan 6 mois personnalisé** (goalPlan) sur la fuite réelle ; **Subscription**
   statut-seul ; **navbar jamais transparente** sur la checklist ; **Appearance**
   aperçus de thèmes entièrement visibles ; **Profile** hero premium.
4. **Checklist** : suppression des sections inutiles, puis **réécriture native
   DS** (suppression de ~2640 lignes de CSS bespoke), progression 5 étapes,
   **identité holographique légère**, **pop-up vocal premium** centré/visible,
   **setup adaptatif** (wizard), **critères concrets** (retail humain).
5. **Onboarding** : étape de demande de **notifications** (opt-in) + retrait de
   la bannière du Dashboard ; réglable dans Réglages.
6. **Panneau Personnaliser** : navigation **par onglets** (Critères/Session/
   Modèles/Avancé) et **masquage des 5 étapes** quand il est ouvert.
7. **Dashboard** : carte checklist enrichie (barre de progression + badge
   « Ready »).

**Toujours vérifier** : `tsc --noEmit` clean, `bun test` vert, `bun run build`
OK, lint 0 erreur, avant de commit/push.
