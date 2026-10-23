# Changelog

Journal des changements **structurels** (pas des features ni des correctifs,
qui vivent dans l'historique git et les PR).

## 2026-10-20 — Laboratoire Monte Carlo et projection de stratégie

- Extension pure `modules/probability/strategy.ts` (`strategy_projection_v1`) :
  bootstrap de R nets ou métriques exactes, 10 000 trajectoires reproductibles,
  projection complète distincte du compte arrêté par les règles canoniques.
- Calcul et rasterisation du nuage dans deux Workers annulables ; tableaux
  typés transférés, aucune liste de 10 000 composants SVG.
- La page orchestre les composants de courbe, d'édition et d'explication ;
  import CSV via le parseur partagé. Plans locaux isolés par sous-compte et
  utilisateur, conservation de la distribution empirique pour les variantes.

## 2026-10-19 — Synchro live multi-appareils, palier 1

- Moyeu unique `store/liveSync.ts` : un canal Realtime par compte pour toutes
  les tables du compte, rattrapage après coupure ou retour d'onglet ; les trois
  canaux existants y passent. `hooks/useLiveTable` pour les écrans.
- Profil lu une fois (`store/profileRow.ts`) et remplacé par Realtime ;
  préférences du compte idem (`utils/userPrefs.ts`). Écritures protégées de
  l'écho.
- Notifications : `dedup_key` unique en base, push et popup depuis le seul
  appareil qui crée la ligne, badge en direct (fin du sondage de 30 s), popup
  fermé partout (`data.dismissedAt`).
- Compte actif propre à chaque appareil (`pickActiveAccount`).
- Migration `20261019120000_live_sync_all_tables`. Spec et plan :
  `docs/superpowers/`.

## 2026-10-18 — Pop-up unique, annonces par trade, primitives de saisie et de réglages

- Notifications : un seul pop-up (`policy.shouldInterrupt` — annonce à fort
  impact, une heure avant, devises du trader via `domain/instrumentCurrency`),
  plus de toast automatique ; catégories du compte appliquées par l'adaptateur
  `allow` du moteur (`modules/notifications/preferences.ts`).
- Calendrier économique : historique des semaines passées
  (`modules/economic-calendar/forex-factory-history.ts`, registre
  `economic_calendar_backfill`), rapprochement trade ↔ annonces dans
  `domain/tradeNews`. Crons acceptés en `GET`.
- Primitives `shared/ui` : `FormSection` / `FormLabel` (TradeModal, Missed
  Setups) et `SettingsGroup` / `SettingsRow` / `SettingsAction` / `Toggle`
  (toutes les pages de paramètres).

## 2026-10-17 — Application montée une fois, onboarding qui configure

- `App` est hébergée une seule fois par la racine (`AppHost`, `routes/__root.tsx`) ;
  `/` et `/$page` ne rendent plus que leur contenu serveur. Avant, chaque
  passage par le tableau de bord démontait toute l'application.
- Stockage refusé : repli mémoire de `localStorage`/`sessionStorage` installé
  avant tout module (`__root.tsx`). Voile avant peinture pour un trader déjà
  connecté.
- Erreurs d'authentification classées en codes (`utils/authErrors.ts`) et
  traduites par chaque surface. Alias `/login`, `/signup`, `/register`… vers
  `/?auth=…` (`utils/pageUrl.ts`).
- Onboarding refondu : séquence cinématique avec son, et chaque réponse écrit
  un réglage réel — compte principal (nom, type, capital, devise), règles de
  trading, profil (une seule faiblesse, vocabulaire de la checklist), thème,
  langue (`features/onboarding/onboardingPlan.ts`).

## 2026-10-16 — Chiffres de référence et entrée d'onboarding

- Toutes les valeurs chiffrées et leurs libellés utilisent désormais Inter
  ExtraBold/tabulaire via `--font-figure`, y compris les champs numériques.
- Le vert sémantique des profits est fixé à `#61f8ab`, relevé pixel par pixel
  sur la référence fournie ; il reste indépendant du thème actif.
- L'onboarding adopte une seule entrée verticale séquencée, une progression
  animée par transformation et un accueil final personnalisé avant le
  dashboard, avec mouvement réduit respecté.
- Direction « terminal financier » issue du prototype Lovable Onboarding
  Prime : rail de calibration sur desktop, progression segmentée sur mobile,
  fond de données statique, pulse de marché, verrouillage tracé des choix et
  mini-dashboard dans la séquence finale.

## 2026-10-08 — Synchro broker, sous-comptes, langage Lucid

- Nouveau moteur `src/modules/brokers/` (pur) et frontière serveur
  `backend/brokers.functions.ts`, `broker-sync.server.ts`,
  `tradovate.server.ts`, `broker-crypto.server.ts` ; feature
  `app/features/brokers/` (page `brokers`, section Réglages).
- Migration `20261008120000_broker_sync.sql` : `broker_connections`,
  `broker_accounts`, colonnes d'exécution et d'import sur `trades`, index
  unique `(user_id, external_id)`, recalibrage étendu aux frais.
- Transfert de trades entre comptes : `trading/tradeTransfer.ts` (pur),
  `store/tradeTransfer.ts`, `shell/TransferTradesModal.tsx` ; compte principal
  (`accounts.is_default`) exposé par `AccountContext`.
- Typographie : l'app connectée passe à la pile système de Lucid
  (`--font-lucid`, `body.tv-app-type`) ; accent et vert P&L `#31d68a`.
- `store/trades.ts` lit `*` (colonnes ajoutées tolérées avant migration).
- Synchro broker en **OAuth seul, lecture seule** : plus de connexion par clé
  API ni de colonne `secret_ciphertext` / `auth_mode` ; liste blanche
  `READ_ONLY_ENDPOINTS` + `assertReadOnly` dans `tradovate.server.ts`.
- Offre Pro : capacités `brokerSync`, `accountTransfer`, `recalibration`
  (`domain/plans.ts`) ; garde serveur `requireProPlan` (`require-pro.ts`) ;
  `recalibrate_account` refuse hors Pro (`PLAN_LIMIT_PRO`), retour à l'origine
  excepté ; `PlanLimitError("pro")` côté client.
- Comptes : `features/settings/AccountsManager.tsx` (rubrique « Comptes »),
  `trading/AccountScaleBridge.tsx` partagé par le transfert et le recalibrage,
  `shell/accountVisuals.ts` (icônes et libellés de compte sortis
  d'`AccountSwitcher`).
- Tests SQL : `tests/sql/broker.sql`, branché dans `scripts/test-sql.sh`.
- Connexion Tradovate : `backend/broker-oauth.server.ts` (adresse de retour
  par origine, check-list administrateur) ; colonnes `refresh_token_ciphertext`,
  `api_hosts`, `oauth_redirect_uri` sur `broker_connections` ; copie de trade
  (`copied_from`) réservée au Pro par le trigger `trades_enforce_copy_pro` ;
  cron `broker-sync` déplacé avant la clôture CME (deux créneaux) ; événement
  `tv:open-import` (ouvrir l'import CSV depuis une page).

## 2026-10-02 — Jarvis : chaîne d'intelligence (LOT 2)

- Une seule chaîne pour une question posée à Jarvis :
  `modules/ai/agents/coach.orchestrator.ts` (route → plan de contexte →
  lectures parallèles → modèle du niveau → validation des chiffres → trace).
- Nouveaux modules : `modules/ai/router/route.ts` (routeur unifié, source de
  `app/features/jarvis/intent.ts` et de l'intention mémoire),
  `modules/ai/context-engine.ts`, `modules/ai/validation.ts`,
  `modules/ai/runtime/tiers.ts`, `modules/ai/runtime/pricing.ts`,
  `backend/ai-tools/profile-data.ts`.
- Appels d'outils natifs dans les adaptateurs Gemini, Anthropic et
  OpenAI-compatibles (champs optionnels `toolCalls` / `providerTurn` /
  `toolResults` sur `AIMessage`).
- Migration additive `20261002090000_ai_agent_runs_observability` (colonnes de
  télémétrie ; l'écriture retombe sur les colonnes historiques tant qu'elle
  n'est pas appliquée).

## 2026-09-30 — Restructuration complète du dépôt

Zéro changement fonctionnel : déplacements, imports, chemins lus par les tests,
suppressions prouvées. Base : `79ae1ff`.

**Code**
- `src/app/pages/` et la majorité de `components/`, `hooks/`, `utils/`
  réorganisés en **features** : `src/app/features/<feature>/` (page +
  composants + logique propres).
- `src/app/shell/` : cadre de l'app connectée (App, navigation, Sidebar…).
- `src/app/public/` : landing, pages légales, contact, tarifs, démo.
- `src/app/trading/` : code trading partagé entre features côté client.
- `src/domain/` devient le noyau pur partagé client/serveur : le type `Trade`
  y est unifié (la copie divergente est supprimée, `app/types.ts` ré-exporte)
  et `tradeCalcs`, `quantStats`, `edgeScore`, `behavioral`, `monthlyReport`,
  `ruleCheck` y sont déplacés. `backend/` et `modules/discipline` n'importent
  plus `app/`.
- `utils/monteCarlo.ts` → `features/monte-carlo/monteCarloEngine.ts` (un nom
  ne différant de `MonteCarlo.tsx` que par la casse bloquait `bun test`).
- Supprimés (aucun importeur, aucune référence) : `app/utils/cn.ts`
  (ré-export ; 59 imports pointent sur `@/shared/ui/cn`), le barrel
  `modules/ai/index.ts` et ce qu'il était seul à charger
  (`agents/catalog.ts`, `agents/registry.ts`, `jobs/types.ts`,
  `mcp/types.ts`), `jarvis/insights/copy/{en,fr}.ts`,
  `jarvis/insights/weekly/types.ts`.

**Documentation**
- Remplacée par un jeu court dans `docs/` (un document par sujet) ; `AGENTS.md`
  devient l'unique source d'instructions pour les agents (`CLAUDE.md` y renvoie).
- Supprimés après migration de leur contenu encore valide : `AUDITS/` (13
  audits PDF de juillet 2026, synthèse, master plan, roadmap d'exécution),
  `docs/planning/`, `docs/architecture/`, `docs/development/`,
  `docs/product/`, `docs/seo/`, `docs/CLAUDE.md`, `docs/PRODUCT-BIBLE.md`,
  `docs/AUDIT-*.md`, `docs/GO-LIVE.md`, `docs/POSITIONNEMENT.md`,
  `docs/PHASE_0_INTELLIGENCE_FOUNDATION.md`, `docs/design/LUCID.md`, et à la
  racine `DESIGN.md`, `ECOSYSTEM_WIRING.md`, `MOTION_AND_PERF.md`,
  `NAVIGATION_REFACTOR.md`, `STRIPE_INTEGRATION.md`,
  `TRADEVAULT_PRODUCT_MASTER_PLAN.md`, ainsi que les README locaux de
  `src/routes`, `src/backend`, `src/modules/ai`, `src/shared/ui`.
- Déplacés : `docs/design/lucid/*` → `docs/assets/lucid/`,
  `docs/CONTENT_HOOKS.md` → `content/hooks.md`.
- Pour relire un ancien document : `git show 79ae1ff:<chemin>` (par exemple
  `git show 79ae1ff:ECOSYSTEM_WIRING.md`). Des commentaires de migrations SQL
  déjà appliquées citent encore ces anciens noms ; ils ne sont pas réécrits.
