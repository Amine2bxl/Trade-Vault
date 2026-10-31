# Base de données — Supabase

Postgres via Supabase (projet `tjikygsipblatubyzbrt`, constante
`SUPABASE_PROJECT_REF` dans `src/shared/site.ts`). L'app de développement parle
à la base **réelle** : jamais de SQL destructif ; comptes de test jetables
(`tv*@test.dev`) supprimés après usage.

## 1. Principes

- **RLS owner-only sur toute table utilisateur** : chaque ligne est isolée par
  `auth.uid() = user_id` (`id` pour `profiles`). C'est la dernière ligne de
  défense, indépendante du code.
- **Migrations additives uniquement** (`supabase/migrations/`,
  `AAAAMMJJHHMMSS_description.sql`) : `if not exists`, nouvelles colonnes,
  nouveaux index. On ne réécrit jamais les trades existants.
- **Types générés, jamais édités** : `src/integrations/supabase/types.ts`.
- **Les statistiques ne sont pas stockées** : elles sont recalculées en mémoire
  côté client depuis les trades (`domain/`).
- Accès client : `src/app/store/*` (façade `src/app/store.ts`). Accès serveur :
  client portant le token de l'appelant, ou **service-role** dans les seuls
  crons et webhooks ([`BACKEND.md`](BACKEND.md)).

## 2. Tables

| Famille | Tables |
| --- | --- |
| Cœur trading | `profiles` (profil, langue, devise, plan et règles JSON, `checklist_config`, compte actif), `trades`, `accounts` (sous-comptes, calibrage), `missed_opportunities` |
| Séances et réflexion | `trading_sessions` (+ `trades.session_id`), `trade_intent`, `trade_reflection` |
| Discipline, objectifs, rapports | `goal_plans` (par compte), `six_month_goals`, `habits`, `monthly_reports`, `notifications`, `user_preferences` |
| Motifs et Jarvis | `mistake_clusters`, `mistake_taxonomy`, `detected_patterns`, `agent_proposals`, `ai_memory`, `ai_agent_runs` (télémétrie, 90 j — niveau, outils, tokens de réflexion/cache, coût estimé, validation : migration `20261002090000_ai_agent_runs_observability`), `ai_reports`, `ai_rate_limits`, `simulation_scenarios` |
| Facturation | `subscriptions`, `processed_webhook_events`, `promo_codes`, `promo_redemptions`, `comp_grants`, `email_log`, `push_subscriptions` |
| Calendrier économique | `economic_events`, `economic_calendar_sync` — **lecture publique**, écriture service-role (cron) ; `economic_calendar_backfill` (semaines passées récupérées, service-role uniquement) |
| Synchro broker | `broker_connections` (une par login broker ; seuls les **jetons** OAuth — accès et renouvellement — **chiffrés AES-256-GCM** par le serveur, aucun identifiant ni mot de passe ; `api_hosts` (hôte d'API dédié), `oauth_redirect_uri` (adresse de retour de la tentative en cours), `sync_cursor`), `broker_accounts` (comptes du login → compte TradeVault cible) |
| Fondation IA sans code consommateur | `ai_embeddings` (pgvector `vector(1536)`), `ai_jobs` |
| Expériences (lot 4, `20261030200000_progress_experiments`) | `progress_experiments` (protocole immuable — `PROGRESS_EXPERIMENT_FROZEN` ; clôture définitive — `PROGRESS_EXPERIMENT_CLOSED` ; `supersedes` relie une version modifiée à la précédente) |
| Recherche (lot 2, `20261030160000_research_notebook`) | `research_notes` (protocole d'une hypothèse ; champs du protocole immuables — déclencheur `RESEARCH_NOTE_FROZEN` ; seuls `archived` et `note` évoluent), `research_note_results` (évaluations successives, insert-only pour le client) |
| Intégrité des données (lot 1, `20261028140000_data_integrity_provenance`) | `import_batches` (un lot d'import ; le client ne met à jour que ses compteurs), `raw_ingest_events` (chaque ligne CSV et chaque exécution / relevé de frais broker reçus, **insert-only** — déclencheur `RAW_INGEST_IMMUTABLE` ; même `source_key` + autre empreinte → statut `conflict` forcé en base), `cash_ledger` (dépôts, retraits, frais hors trades, payouts, ajustements justifiés ; signe contraint par la nature), `account_snapshots` (soldes observés datés). Sources `user` / `broker` / `statement` : le client n'écrit que `user` |

Colonnes de `trades` (mapping vers le type `Trade` dans `store/trades.ts`) :
`symbol`, `direction` (`long`/`short`/`be`, contrainte CHECK), `pnl`,
`risk_amount`, `r_multiple`, `strategy`, `mistakes[]`, `confluences[]`,
`setup_quality` (1–5), `confidence`, `notes`, `screenshots[]` (chemins
Storage), `trade_date` (→ `Trade.date`), `entry_time`, `exit_time`, `mae`,
`mfe`, `slippage`, `is_example`, `account_id`, `session_id`, et depuis
`broker_sync` : `quantity`, `entry_price`, `exit_price`, `fees` (exécution),
`broker`, `external_id`, `broker_account`, `review_pending` (import broker),
`copied_from` (transfert entre comptes — garanti indépendamment du broker par
`20261016221756_account_transfer_schema` ; une nouvelle copie exige le palier
Pro, vérifié par le trigger `trades_enforce_copy_pro`). **`(user_id,
external_id)` est unique** : c'est la déduplication de la synchro, la clé
portant l'environnement (`tradovate:<live|demo>:<compte>:<exécution>`). `is_default` sur `accounts`
désigne le **compte principal**.

Provenance (lot 1, colonnes **inconnues = NULL**, jamais rétro-remplies) :
`source` (`manual`/`csv`/`broker`/`copy`), `risk_source` (`user`/`csv`/
`broker_stop`/`broker_default` — le forfait ne mesure pas de R), `source_timezone`
(fuseau d'écriture des heures), `entry_at`/`exit_at` (instants UTC **prouvés**),
`import_key` (idempotence d'un import, **unique par compte** ; un index partiel
couvre les trades sans compte). Lecture et écriture : `domain/tradeProvenance`
(repli sans ces colonnes tant que la migration n'est pas passée). `fees` NULL
sur un trade broker = frais inconnus, P&L brut.

## 3. RLS — motif et exceptions

Motif standard : quatre policies `select/insert/update/delete` sur
`auth.uid() = user_id`.

| Exception | Raison |
| --- | --- |
| `subscriptions` | Lecture propre seulement ; écriture serveur (webhooks, trigger d'inscription) |
| `ai_agent_runs`, `ai_embeddings`, `ai_jobs` | Lecture propre ; écriture service-role (un client ne peut pas fabriquer de métriques) |
| `ai_rate_limits` | Aucune policy : seul écrivain `consume_ai_quota*` (`SECURITY DEFINER`) |
| `processed_webhook_events`, `comp_grants`, `promo_codes`, `promo_redemptions` | RLS active sans policy : service-role (ou fonctions `SECURITY DEFINER`) uniquement |
| `economic_*` | Lecture publique (`anon` + `authenticated`) |

Toute fonction `SECURITY DEFINER` voit son `EXECUTE` révoqué pour
`public/anon/authenticated` si elle ne doit pas être appelable via PostgREST.

## 4. Fonctions SQL

| Fonction | Rôle |
| --- | --- |
| `consume_ai_quota`, `consume_ai_quota_scoped` | Quota IA atomique en fenêtre fixe |
| `effective_tier`, `enforce_trade_quota`, `enforce_account_quota`, `count_trades_in_month` | Limites de plan appliquées **en base**. `effective_tier` et `count_trades_in_month` : un utilisateur connecté n'interroge que lui-même, `anon` n'exécute rien, le rôle de service garde l'accès ; les fonctions de déclencheur ne sont pas appelables en RPC (`20261030220000`) |
| `enforce_proposal_budget` | Budget des propositions de Jarvis (3 en attente, 1 par jour) |
| `apply_subscription_event` | Transitions d'abonnement idempotentes (webhooks) |
| `redeem_promo_code`, `release_promo_redemption` | Codes promo |
| `recalibrate_account`, `recalibrate_account_trades` | Recalibrage atomique de l'échelle d'un compte (frais compris depuis `broker_sync`). Palier Pro exigé (`PLAN_LIMIT_PRO`), sauf le retour au capital d'origine |
| `adjust_memory_confidence` | Confiance des souvenirs de Jarvis |
| `handle_new_user`, `handle_new_user_billing` | Initialisation à l'inscription (triggers) |
| `users_with_trades_since`, `find_user_id_by_email` | Balayages de cron, administration |
| `set_updated_at` | Triggers `updated_at` |

## 4 bis. Realtime

Publication `supabase_realtime` : les tables du compte qu'un écran affiche
(`trades`, `missed_opportunities`, `profiles`, `accounts`, `goal_plans`,
`notifications`, `user_preferences`, `agent_proposals`, `ai_memory`,
`broker_connections`, `broker_accounts`, `monthly_reports`, `trade_intent`,
`trade_reflection`, `subscriptions`), toutes en `replica identity full` (sans
elle, une suppression n'atteint pas les autres appareils). Migrations
`20260826120000_enable_realtime_sync` et `20261019120000_live_sync_all_tables`.
Realtime applique la RLS : chacun ne reçoit que ses lignes. Ajouter une table
= la publier ET l'ajouter à `LIVE_TABLES` (`src/app/store/liveSync.ts`) ;
`tests/liveSync.test.ts` exige un écran qui la suive.

`notifications.dedup_key` + index unique `(user_id, dedup_key)` : une alerte
évaluée par deux appareils n'est écrite qu'une fois (`on conflict do
nothing`) ; la clé vient de `policy.notificationDedupKey`.

## 5. Storage

Bucket `trade-screenshots` (créé par migration) : policies restreintes au rôle
`authenticated` et au dossier `auth.uid()`. Client : `store/storage.ts`
(upload, URLs signées, suppression).

## 6. RGPD — suppression de compte

Edge function `supabase/functions/delete-account/` (Deno) : vérifie le JWT
(un utilisateur ne supprime que lui-même), puis efface en service-role ses
fichiers Storage et ses lignes. **Toute nouvelle table utilisateur doit être
ajoutée à la liste de cette fonction.**

## 7. Tests SQL

`bash scripts/test-sql.sh` (Postgres 16 réel, job CI séparé) vérifie les
garanties de facturation et de quota (`tests/sql/`).
