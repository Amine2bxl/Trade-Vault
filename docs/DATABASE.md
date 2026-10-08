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
| Motifs et Jarvis | `mistake_clusters`, `mistake_taxonomy`, `detected_patterns`, `agent_proposals`, `ai_memory`, `ai_agent_runs` (télémétrie, 90 j), `ai_reports`, `ai_rate_limits`, `simulation_scenarios` |
| Facturation | `subscriptions`, `processed_webhook_events`, `promo_codes`, `promo_redemptions`, `comp_grants`, `email_log`, `push_subscriptions` |
| Calendrier économique | `economic_events`, `economic_calendar_sync` — **lecture publique**, écriture service-role (cron) |
| Synchro broker | `broker_connections` (une par login broker ; identifiants et jetons **chiffrés AES-256-GCM** par le serveur, `sync_cursor`), `broker_accounts` (comptes du login → compte TradeVault cible) |
| Fondation IA sans code consommateur | `ai_embeddings` (pgvector `vector(1536)`), `ai_jobs` |

Colonnes de `trades` (mapping vers le type `Trade` dans `store/trades.ts`) :
`symbol`, `direction` (`long`/`short`/`be`, contrainte CHECK), `pnl`,
`risk_amount`, `r_multiple`, `strategy`, `mistakes[]`, `confluences[]`,
`setup_quality` (1–5), `confidence`, `notes`, `screenshots[]` (chemins
Storage), `trade_date` (→ `Trade.date`), `entry_time`, `exit_time`, `mae`,
`mfe`, `slippage`, `is_example`, `account_id`, `session_id`, et depuis
`broker_sync` : `quantity`, `entry_price`, `exit_price`, `fees` (exécution),
`broker`, `external_id`, `broker_account`, `review_pending` (import broker),
`copied_from` (transfert entre comptes). **`(user_id, external_id)` est
unique** : c'est la déduplication de la synchro. `is_default` sur `accounts`
désigne le **compte principal**.

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
| `effective_tier`, `enforce_trade_quota`, `enforce_account_quota`, `count_trades_in_month` | Limites de plan appliquées **en base** |
| `enforce_proposal_budget` | Budget des propositions de Jarvis (3 en attente, 1 par jour) |
| `apply_subscription_event` | Transitions d'abonnement idempotentes (webhooks) |
| `redeem_promo_code`, `release_promo_redemption` | Codes promo |
| `recalibrate_account`, `recalibrate_account_trades` | Recalibrage atomique de l'échelle d'un compte (frais compris depuis `broker_sync`) |
| `adjust_memory_confidence` | Confiance des souvenirs de Jarvis |
| `handle_new_user`, `handle_new_user_billing` | Initialisation à l'inscription (triggers) |
| `users_with_trades_since`, `find_user_id_by_email` | Balayages de cron, administration |
| `set_updated_at` | Triggers `updated_at` |

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
