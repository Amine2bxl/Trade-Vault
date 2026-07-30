# TradeVault — Base de données

> **Document propriétaire du schéma de données** : tables Supabase, colonnes,
> RLS, index, fonctions SQL, triggers, Storage, extensions, et politique de
> migration.
>
> Accès serveur : [`BACKEND.md`](BACKEND.md) · Persistance IA :
> [`AI_ARCHITECTURE.md`](AI_ARCHITECTURE.md).
>
> Dernière vérification contre les migrations et les types générés :
> **2026-07-28**.

---

## 1. Principes

- **Postgres via Supabase.** Ref projet : `tjikygsipblatubyzbrt`.
- **RLS owner-only sur toute table utilisateur.** Chaque ligne est isolée par
  `user_id = auth.uid()` (ou `id = auth.uid()` pour `profiles`). C'est le pilier
  de sécurité n°3 de la charte — la dernière ligne de défense, indépendante du
  code applicatif.
- **Migrations additives uniquement.** Une migration ne casse jamais une table
  ni une donnée : `add column if not exists`, `create table if not exists`,
  nouveaux index. Nommage `AAAAMMJJHHMMSS_description.sql`.
- **Types générés, jamais édités à la main** :
  `src/integrations/supabase/types.ts` est le miroir TypeScript du schéma.
- **Ce qui doit survivre au runtime va en DB.** Le bus d'événements
  (`modules/events`) est par-runtime et n'est **jamais** persisté.

---

## 2. Cartographie des tables

20 tables applicatives, en quatre familles.

### 2.1 Cœur trading

| Table | Contenu | Notes |
| --- | --- | --- |
| `profiles` | Profil trader (1 ligne / utilisateur, clé `id = auth.uid()`) | Langue, soldes, plan et règles de trading (JSON), réponses d'onboarding, état Trustpilot, `active_account_id` |
| `trades` | Trades — l'entité centrale | Voir §3 |
| `accounts` | Sous-comptes de trading | `type`, `currency`, `color`, `starting_balance`, `is_default` |
| `missed_opportunities` | Setups manqués | `estimated_r`, `reason_not_taken`, `what_happened`, `lesson_learned`, `next_time_plan`, `account_id` |

### 2.2 Discipline, objectifs et rapports

| Table | Contenu | Notes |
| --- | --- | --- |
| `six_month_goals` | Objectifs typés | `kind`, `start_value`, `target_value`, `started_at` |
| `goal_plans` | Plans de progression | `horizon_months`, `goals` (JSON), `tasks_done` (JSON) |
| `habits` | Suivi d'habitudes / streaks | `cadence`, `streak`, `last_done` |
| `monthly_reports` | Rapports mensuels générés | `month`, `report` (JSON) |
| `notifications` | Inbox persistée (canal `dashboard`) | `kind`, `severity`, `url`, `data` (JSON), `read_at` |
| `user_preferences` | Préférences diverses | `prefs` (JSON) |

### 2.3 IA, plateforme et facturation

| Table | Contenu | État |
| --- | --- | --- |
| `ai_memory` | Mémoire du coach : `profile` / `fact` / `lesson` / `conversation` | 🟢 en prod (lecture/écriture) |
| `ai_reports` | Rapports IA persistés (`kind`, `period_key`, `content` JSON) | 🟢 schéma en prod |
| `ai_rate_limits` | Compteur horaire par utilisateur | 🟢 écrit par `consume_ai_quota` |
| `subscriptions` | Abonnement / plan | Stripe + crypto ; `status`, `trial_ends_at`, `source` |
| `email_log` | Idempotence des e-mails (`user_id`, `email_key`) | 🟢 |
| `push_subscriptions` | Souscriptions web-push (`endpoint`, `p256dh`, `auth`) | 🟢 |
| `processed_webhook_events` | Idempotence webhooks (`provider`, `event_id`) | 🟢 service-role only |
| `ai_embeddings` | Vecteurs pgvector `vector(1536)` (RAG) | ⚪ migration prête, **non appliquée** |
| `ai_jobs` | File de tâches async (statut, payload, retry) | ⚪ migration prête, **non appliquée** |
| `ai_agent_runs` | Journal d'audit par invocation d'agent | ⚪ migration prête, **non appliquée** |

> **`monthly_reports` vs `ai_reports`** : deux tables distinctes. Les rapports
> mensuels actuels vivent dans `monthly_reports` (générés par le cron et le
> bouton « générer »). `ai_reports` est le schéma prévu pour les briefs/reviews
> IA à venir (Daily Brief, Weekly Review). La fusion des deux chaînes de
> génération est un chantier planifié ([`ROADMAP.md`](ROADMAP.md)).

### 2.4 Calendrier économique

Modèle atypique : **lecture publique** (`anon` + `authenticated`), **écriture
service-role uniquement** (cron `economic-calendar`). Aucune donnée par
utilisateur, donc pas de RLS owner-only ici.

| Table | Contenu | Notes |
| --- | --- | --- |
| `economic_events` | Événements Forex Factory (impact, devise, valeurs) | Lecture publique ; index `economic_events_starts_at_idx` sur `starts_at` |
| `economic_calendar_sync` | État de la dernière synchro (curseur, horodatage) | Lecture publique ; écrit par le cron |

Migration : `20260729120000_economic_calendar.sql`.

---

## 3. Table `trades` (détail)

Entité centrale. Colonnes (types générés) :

| Colonne | Type | Note |
| --- | --- | --- |
| `id` | uuid | PK |
| `user_id` | uuid | Propriétaire (RLS) |
| `account_id` | uuid \| null | Sous-compte (null = compte par défaut / legacy) |
| `symbol` | text | |
| `direction` | text | `long` / `short` / `be` |
| `pnl` | number | P&L réalisé |
| `risk_amount` | number | Risque en devise du compte |
| `r_multiple` | number | R réalisé |
| `strategy` | text | |
| `mistakes` | text[] | Erreurs taguées |
| `confluences` | text[] | |
| `setup_quality` | number | 1–5, grading du trader |
| `confidence` | number | |
| `notes` | text | |
| `screenshots` | text[] | Chemins Storage |
| `trade_date` | text | Date du trade (⚠️ colonne `trade_date`, mappée sur `Trade.date` côté client) |
| `entry_time` · `exit_time` | text | |
| `mae` · `mfe` · `slippage` | number \| null | Champs quant optionnels (surtout imports courtier) |
| `is_example` | boolean | Trade de démo, badgé jusqu'à édition |
| `created_at` · `updated_at` | timestamptz | |

Le mapping DB ↔ `Trade` (client) est assuré par `store/trades.ts` (ex.
`trade_date` → `date`, `r_multiple` → `rMultiple`).

---

## 4. Row-Level Security

**Motif standard**, appliqué à quasi toutes les tables utilisateur — quatre
policies (`select` / `insert` / `update` / `delete`), chacune sur
`auth.uid() = user_id` :

```sql
alter table public.<t> enable row level security;
create policy "<t>_select_own" on public.<t> for select using (auth.uid() = user_id);
create policy "<t>_insert_own" on public.<t> for insert with check (auth.uid() = user_id);
create policy "<t>_update_own" on public.<t> for update using (auth.uid() = user_id);
create policy "<t>_delete_own" on public.<t> for delete using (auth.uid() = user_id);
```

**Exceptions volontaires :**

| Table | RLS | Raison |
| --- | --- | --- |
| `profiles` | policies sur `auth.uid() = id` | La clé primaire *est* l'identifiant utilisateur |
| `subscriptions` | **select-own seulement** | Écriture réservée au serveur (webhooks Stripe/crypto + trigger de signup), en service-role |
| `ai_embeddings`, `ai_jobs`, `ai_agent_runs` | **select-own seulement** | Écriture réservée aux jobs serveur (service-role) |
| `ai_rate_limits` | **aucune policy** | Seul l'écrivain est la fonction `SECURITY DEFINER` `consume_ai_quota` |
| `processed_webhook_events` | **aucune policy** | Écrit uniquement en service-role par les handlers de webhook |
| `email_log` | idempotence e-mail | Écrit en service-role par les crons |

---

## 5. Fonctions et triggers SQL

| Objet | Type | Rôle |
| --- | --- | --- |
| `consume_ai_quota(p_limit int, p_window_seconds int) → boolean` | `SECURITY DEFINER` | Rate-limit atomique en fenêtre fixe. Incrémente le bucket courant de l'appelant (`auth.uid()`) et renvoie `count <= p_limit`. `EXECUTE` révoqué à `public`/`anon`, accordé à `authenticated`. Un appel sans utilisateur authentifié renvoie `true` (ce n'est pas son rôle de gater) |
| `handle_new_user_billing()` | trigger `SECURITY DEFINER` | À la création d'un `auth.users`, initialise la ligne `subscriptions`. `EXECUTE` **révoqué à `public`/`anon`/`authenticated`** (durcissement advisor 0028/0029) : le trigger s'exécute en tant que définisseur, l'appel RPC direct est impossible |
| `on_auth_user_created_billing` | trigger `after insert on auth.users` | Branche la fonction ci-dessus |
| `set_*_updated_at` | triggers | Maintiennent `updated_at` (ex. `missed_opportunities`) |

> **Note de sûreté** : les deux fonctions `SECURITY DEFINER` ont vu leur
> `EXECUTE` explicitement révoqué pour ne jamais être appelables directement via
> PostgREST. C'est le patron à suivre pour toute future fonction `DEFINER`.

---

## 6. Index

| Index | Table | Usage |
| --- | --- | --- |
| `trades_user_account_date_idx` | `trades (user_id, account_id, trade_date desc)` | Chemin de lecture chaud : trades du compte actif, triés par date |
| `missed_user_account_date_idx` | `missed_opportunities (user_id, account_id, opportunity_date desc)` | Idem pour les setups manqués |
| `missed_opportunities_user_date_idx` | `missed_opportunities (user_id, opportunity_date)` | Lecture antérieure aux sous-comptes |
| `push_subscriptions_user_id_idx` | `push_subscriptions (user_id)` | Envoi de push |
| `ai_rate_limits_window_idx` | `ai_rate_limits (window_start)` | Nettoyage / lecture de la fenêtre |
| `ai_embeddings_user_idx` · `ai_embeddings_vec_idx` (IVFFlat cosine) | `ai_embeddings` | Recherche top-k RAG (⚪ non appliqué) |
| `ai_jobs_due_idx` | `ai_jobs (scheduled_for) where status = 'queued'` | File de tâches (⚪ non appliqué) |
| `ai_agent_runs_user_idx` | `ai_agent_runs (user_id, created_at desc)` | Audit (⚪ non appliqué) |

---

## 7. Storage

- **Bucket `trade-screenshots`** — captures d'écran des trades et setups
  manqués.
- **RLS storage owner-only** : quatre policies (`select` / `insert` / `update` /
  `delete`) restreignant `bucket_id = 'trade-screenshots'` **et** le premier
  segment de dossier à `auth.uid()::text`. Un utilisateur ne voit et ne modifie
  que ses propres fichiers.
- Accès côté client : upload et URLs signées via `store/storage.ts`
  (`uploadScreenshot`, `getScreenshotUrls`, `removeScreenshotFiles`).
- Migration des captures legacy vers le bucket : gérée par
  `store/trades.ts` (`migrateLegacyTradeScreenshots`) et déclenchée par
  `useTrades`.

---

## 8. Extensions

- **`vector`** (pgvector) — créée par la migration `ai_os_foundation`
  (⚪ **non appliquée**). Dimension `vector(1536)` = **le seul nombre couplé au
  modèle** d'embeddings ; changer de provider d'embeddings implique d'ajuster
  cette dimension et le provider correspondant.

---

## 9. Historique des migrations (`supabase/migrations/`, chronologique)

| Fichier | Apport |
| --- | --- |
| `…201359_*` | `profiles`, `trades` (schéma initial + RLS) |
| `…201416_*` · `…201443_*` · `…082130_*` | Ajustements RLS profil/trades, policies Storage |
| `…165855_*` · `…165928_*` | Refonte `profiles`/`trades`, policies Storage |
| `…110510_*` | `missed_opportunities` (+ trigger `updated_at`) |
| `…153834_*` | `push_subscriptions`, colonnes `language`/`starting_balance` |
| `…add_missed_opportunities_index` | Index `missed_opportunities (user_id, date)` |
| `…093000_onboarding` | Colonnes `onboarding_*` sur `profiles` |
| `…090000_sub_accounts` | `accounts` + `account_id` sur `trades`, `active_account_id` |
| `…100000_billing` | `subscriptions`, `email_log`, trigger de signup billing |
| `…110000_goals_rules` | `six_month_goals`, `onboarding_monthly_target`, `trading_rules` (JSON) |
| `…150000_trading_plan_goal_plans` | `goal_plans`, `trading_plan` (JSON) |
| `…120000_engines_foundation` | `ai_memory`, `ai_reports`, `notifications`, `habits`, `user_preferences` |
| `…130000_perf_composite_indexes` | Index composites `(user_id, account_id, date)` |
| `…140000_security_gating` | `ai_rate_limits` + `consume_ai_quota()`, `processed_webhook_events` |
| `…150000_lockdown_trigger_functions` | Révocation `EXECUTE` sur `handle_new_user_billing()` |
| `…160000_ai_os_foundation` | ⚪ `ai_embeddings`, `ai_jobs`, `ai_agent_runs`, extension `vector` — **prête, non appliquée** |
| `20260729120000_economic_calendar` | `economic_events`, `economic_calendar_sync` (lecture publique, écriture service-role) |

> ⚠️ **`monthly_reports` sans migration.** La table est utilisée en production
> (`store/reports.ts`, cron `monthly-reports`) et présente dans les types
> générés, mais **aucun fichier `create table monthly_reports` n'existe** dans
> `supabase/migrations/` — un environnement neuf ne la recrée pas. Migration
> additive à ajouter (suivi dans [`ROADMAP.md`](ROADMAP.md) /
> [`MASTER_PLAN_TRADEVAULT.md`](MASTER_PLAN_TRADEVAULT.md)).

---

## 10. Flux de données (résumé)

Le cycle de vie complet d'un trade (écriture optimiste → persistance → moteurs →
notifications) et les lectures dérivées côté client sont décrits dans
[`ARCHITECTURE.md` §6](ARCHITECTURE.md). Point clé côté données : **les
statistiques ne sont pas stockées** — elles sont recalculées en mémoire à partir
du tableau de trades. La bascule des agrégats en SQL/RPC est un chantier de scale
planifié ([`ROADMAP.md`](ROADMAP.md)).

---

## 11. RGPD — suppression de compte

Edge function Supabase `supabase/functions/delete-account/` (Deno) : vérifie le
JWT de l'appelant (un utilisateur ne peut supprimer que **lui-même**), puis
efface en service-role les fichiers Storage, toutes les lignes de données, et
enfin l'enregistrement `auth.users`. **Irréversible.**
