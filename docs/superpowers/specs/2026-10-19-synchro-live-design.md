# Synchronisation live multi-appareils — design

Date : 2026-10-19 · Statut : design validé, spec en relecture.

## 1. Objectif

Un même compte ouvert sur plusieurs appareils et navigateurs (PC, téléphone,
navigation privée) ne forme qu'**un seul état**. Ce qu'un appareil écrit, les
autres le voient en moins d'une seconde, sans rafraîchir — jusqu'à la frappe :
une note tapée sur le PC apparaît lettre par lettre sur le téléphone si le même
formulaire y est ouvert. Aucune donnée du trader ne vit seulement dans un
navigateur : une fenêtre privée montre exactement les mêmes données.

Valeur produit : rétention et confiance (le journal « suit » le trader), un
argument de différenciation face aux journaux qui ne synchronisent qu'au
rechargement.

### Critères de réussite

1. Une modification enregistrée (trade, règle, réglage, notification lue,
   message Jarvis…) apparaît sur un autre appareil connecté en **< 1 s**.
2. Une frappe dans un formulaire ouvert sur deux appareils apparaît sur l'autre
   en **100–300 ms**, sans faire sauter le curseur du receveur.
3. Une fenêtre privée fraîchement connectée affiche les mêmes conversations
   Jarvis, réponses de checklist, thèmes personnalisés, brouillons et
   préférences que l'appareil principal.
4. Après une coupure réseau, l'appareil rattrape tout ce qu'il a manqué sans
   rechargement manuel.
5. Une notification n'est jamais créée deux fois, même déclenchée par deux
   appareils à la même seconde.

## 2. Décisions prises avec le trader

| Sujet | Décision |
| --- | --- |
| Frappe simultanée dans le même champ | **Miroir live, la dernière frappe gagne** (pas de co-édition CRDT) |
| Écran affiché | **Données seulement** : chaque appareil navigue librement |
| Brouillon d'un trade non enregistré | **Partagé** : stocké côté serveur, visible et éditable partout |
| Reste propre à chaque appareil | Barre latérale repliée, **thème actif**, lecture vocale de Jarvis, **filtres et périodes** (journal, dashboard, saisonnalité), **compte de trading actif** (au premier lancement d'un appareil : le dernier compte utilisé) |
| Moteur | **Supabase Realtime** (déjà en place), pas de fournisseur tiers |
| Livraison | **3 paliers**, une PR chacun, CI verte à chaque palier |
| Formulaire ouvert ailleurs quand on enregistre | **Se ferme** avec un toast « enregistré depuis un autre appareil » |
| Historique local existant | **Fusionné** dans le compte au premier lancement (identifiants conservés, aucun doublon) |

Restent aussi locaux, sans question : consentement cookies (fait juridique lié
au navigateur), garde-fous techniques (`tv-chunk-reload-at`,
`tv.last-pwd-reset`), état d'écran (`tv.page`, section ouverte du plan).

## 3. État actuel (vérifié le 2026-10-19)

- Publication `supabase_realtime` de la base réelle : **3 tables** —
  `trades`, `missed_opportunities`, `profiles`.
- Abonnés client : `useRealtimeTrades` (cache React Query des trades),
  `useRealtimeTable` (Setups manqués), `useRealtimeProfile` (**seule la
  langue** est appliquée). Trois canaux distincts.
- Profil : une vingtaine de consommateurs appellent chacun leur `loadX`
  (`store/profile.ts`, `trading/tradingRules.ts`, `trading/tradingPlan.ts`) une
  fois au montage ; aucun ne réagit à un changement distant.
- Notifications : badge relu toutes les 30 s (`inbox/useUnreadCount`), boîte
  chargée au montage ; journaux anti-doublon en `localStorage`
  (`tv.notif.pushed`, `tv.notif.persisted`, `tv.notif.coded`, `tv.notif.once`)
  complétés par une lecture des clés en base, sans garantie atomique.
- Données du trader **uniquement dans le navigateur** :

| Donnée | Clé / fichier |
| --- | --- |
| Conversations Jarvis | `tv:jarvis:conv:{uid}:*` — `features/jarvis/conversations.ts` |
| Brouillon du compositeur Jarvis | `ConversationWorkspace.tsx` (`readDraft`/`writeDraft`) |
| Réponses du jour de la checklist | `tv-chk-{uid}-{date}` — `Checklist.tsx`, lu aussi par `trading/useEdgeScore.ts` |
| Config checklist (copie) | `tv-chk-config-{uid}` (la vérité existe déjà : `profiles.checklist_config`) |
| Assistant checklist vu | `tv-chk-wizard-{uid}` |
| Brouillons trade / setup manqué | `tv.{uid}.draft.*` — `hooks/useDraftAutosave.ts` |
| Thèmes personnalisés | `tv-themes-v2.custom` — `utils/themes.ts` |
| Compteur Jarvis du jour | `tv:jarvis:usage:{uid}` — `features/jarvis/aiUsage.ts` |
| Onboarding terminé (cache) | `tv.onboarded.{uid}` — `shell/App.tsx` |
| Bienvenue vue | `shell/FirstSessionWelcome.tsx` |
| Alerte broker déjà vue | `tv.{uid}.brokers.alerted` — `brokers/useBrokerSync.ts` |
| Entretien quotidien de la boîte | `tv.notif.maint.{uid}` — `shell/App.tsx` |
| Profil Jarvis (cache) | `tv:jarvis:profile:{uid}` — `store/profile.ts` |

- Les tables `discipline_days` et `replay_sessions` existent en base sans
  migration ni code dans le dépôt : **hors périmètre**, non utilisées.
- Projet Supabase sur le **plan gratuit** (voir §9).

## 4. Architecture

### 4.1 Le moyeu `app/store/liveSync.ts`

Module unique, sans React, propriétaire de la connexion live d'un compte.

```ts
startLiveSync(userId: string): void        // appelé par AuthContext à la connexion
stopLiveSync(): void                       // déconnexion (avant la purge locale)
onTable(table: LiveTable, h: (e: LiveChange) => void): () => void
onBroadcast<E extends LiveEvent>(event: E, h: (p: LivePayload<E>) => void): () => void
sendBroadcast<E extends LiveEvent>(event: E, payload: LivePayload<E>): void
onResync(h: () => void): () => void        // après reconnexion ou retour d'onglet
getLiveStatus(): LiveStatus; subscribeLiveStatus(h): () => void
DEVICE_ID: string                          // id de l'onglet, en mémoire
```

> **Réalisé au palier 1** (voir le plan) : le canal des changements de base
> est `db:{uid}`, non privé — Realtime y applique la RLS des tables. Le canal
> privé `user:{uid}` et ses policies `realtime.messages` arrivent avec le
> premier `broadcast` (palier 2). `trading_sessions` et `simulation_scenarios`
> ne sont pas diffusées (aucun écran monté ne les affiche). Fermeture d'un
> popup partagée par `data.dismissedAt` (l'ouverture marque déjà « lu »).

- **Un canal privé par compte** : `user:{uid}`, `config.private = true`. Il porte
  les `postgres_changes` de toutes les tables `LiveTable` (filtre
  `user_id=eq.{uid}`, `id=eq.{uid}` pour `profiles`) et les événements
  `broadcast` (frappes, « Jarvis réfléchit »). Les `broadcast` n'ont pas d'écho
  vers l'émetteur (`self: false`).
  *Repli prévu* : si Realtime refuse la combinaison `postgres_changes` + canal
  privé, le moyeu ouvre deux canaux internes (`db:{uid}` public protégé par la
  RLS des tables, `user:{uid}` privé pour le broadcast). L'API publique ne
  change pas. À trancher par la première tâche du palier 1.
- **Rattrapage** : à chaque passage `SUBSCRIBED` après une coupure
  (`CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`) et à chaque retour d'onglet visible
  après plus de 30 s caché, le moyeu appelle les `onResync` : chaque
  consommateur relit sa source. Pas d'horodatage d'événements à tenir.
- **Statut** : `online | connecting | offline` dérivé de l'état du canal et de
  `navigator.onLine`.
- `LiveTable` est une union fermée (palier 1 : 17 tables, paliers 2 et 3 : les
  nouvelles tables). Ajouter une table = l'ajouter à l'union **et** à la
  publication (migration).

### 4.2 Les hooks consommateurs (`app/hooks/`)

- `useLiveTable(table, onChange, { debounceMs = 150 })` : remplace
  `useRealtimeTable` (même contrat : rafales regroupées, `onChange` lu par ref),
  rappelle aussi `onChange` sur `onResync`.
- `useRealtimeProfile` et `useRealtimeTrades` gardent leur signature et
  passent par le moyeu (plus de canal propre).
- `useLiveStatus()` : statut pour l'indicateur du cadre.

### 4.3 Sécurité

- RLS des tables inchangée : Realtime l'applique, chacun ne reçoit que ses
  lignes.
- Canal privé : policies sur `realtime.messages` (migration additive) :

```sql
create policy "live: le proprietaire ecoute son canal"
  on realtime.messages for select to authenticated
  using (realtime.topic() = 'user:' || auth.uid()::text);
create policy "live: le proprietaire diffuse sur son canal"
  on realtime.messages for insert to authenticated
  with check (realtime.topic() = 'user:' || auth.uid()::text);
```

  Sans elles, quiconque connaît un `user_id` pourrait écouter les frappes.
- Aucun secret côté client ; aucune fonction `SECURITY DEFINER` appelable en
  écriture ; toute nouvelle table ajoutée à `supabase/functions/delete-account`.

## 5. Palier 1 — ce qui est déjà en base devient live

### 5.1 Migration `…_live_sync_all_tables.sql`

Même motif idempotent que `20260826120000_enable_realtime_sync.sql` :
`replica identity full` + ajout à `supabase_realtime` pour `accounts`,
`goal_plans`, `notifications`, `user_preferences`, `trading_sessions`,
`agent_proposals`, `ai_memory`, `simulation_scenarios`, `broker_connections`,
`broker_accounts`, `monthly_reports`, `trade_intent`, `trade_reflection`,
`subscriptions`. Plus les policies `realtime.messages` (§4.3).

Notifications — anti-doublon atomique :

```sql
alter table public.notifications add column if not exists dedup_key text;
create unique index if not exists notifications_user_dedup_key
  on public.notifications (user_id, dedup_key) where dedup_key is not null;
```

`dedup_key` = `{date locale}:{clé}` pour les règles à cadence quotidienne,
`{clé}` pour les règles `once`. `persistNotification` passe en
`upsert(..., { onConflict: "user_id,dedup_key", ignoreDuplicates: true })`.
Les journaux `localStorage` restent un **cache** qui évite un aller-retour, plus
la garantie.

### 5.2 Profil : une ligne, un cache, zéro requête en plus

`store/profile.ts` gagne `loadProfileRow(uid)` (promesse mémorisée de la ligne
`profiles` entière) ; les `loadX` existants (`loadStartingBalance`,
`loadOnboarding`, `loadChecklistConfig`, `loadCurrency`, `loadJarvisProfile`,
`loadConfluences`, `loadAccountBalance`, `loadTradingRules`,
`loadTradingPlan`…) en dérivent au lieu de faire chacun leur `select`. Le
moyeu remplace la ligne en cache par le `payload.new` complet (replica identity
full) puis émet `profiles`. Les consommateurs s'abonnent avec
`useLiveTable("profiles", reload)` — `reload` relit le cache, donc **aucune
requête réseau** sur un changement distant. Le bus `tv-rules-updated` existant
est aussi émis quand `trading_rules` change.

Consommateurs à brancher : `TradeModal`, `Onboarding` (lecture seule),
`Goals`, `useGoalProgress`, `Settings`, `Analytics`, `shell/App.tsx`,
`useEdgeScore`, `Jarvis` (`SettingsWorkspace`, `aiContext`, `Jarvis.tsx`,
`AiAssistant.tsx`), `FirstSessionWelcome`, `Checklist`, `TradingPlan`,
`TradingRulesSection`, `ConversationWorkspace`, `Dashboard`,
`LanguageContext` (déjà), monnaie (`shared/currency.ts` via `App.tsx`).

`active_account_id` est **ignoré** par la synchro (compte actif par appareil) :
`AccountContext` garde la valeur locale en priorité et n'écrit la colonne que
comme « dernier compte utilisé » pour un nouvel appareil.

### 5.3 Autres tables

| Table | Consommateur | Réaction |
| --- | --- | --- |
| `notifications` | `useUnreadCount`, `Inbox`, popup | Badge et liste live ; **suppression du sondage 30 s** ; `read_at` posé ailleurs ferme le popup ici |
| `accounts` | `AccountContext` | Liste rechargée ; compte actif supprimé ailleurs → bascule sur le principal |
| `goal_plans` | `Goals`, `useGoalProgress` | Rechargement |
| `user_preferences` | `utils/userPrefs.ts` | Cache `current` remplacé par `payload.new.prefs` ; nouvel abonnement `useUserPref(key)` |
| `broker_connections`, `broker_accounts` | `Brokers`, `useBrokerSync` | Rechargement |
| `agent_proposals` | `jarvis/proposals.ts` | Rechargement |
| `ai_memory` | Jarvis (mémoire) | Rechargement |
| `monthly_reports` | `Reports` | Rechargement |
| `trade_intent`, `trade_reflection` | `TradeModal`, `TradeDetailModal` | Rechargement du trade affiché |
| `trading_sessions`, `simulation_scenarios` | stores existants | Rechargement |
| `subscriptions` | `useSubscription` | Palier mis à jour partout après paiement |

Les captures d'un trade **enregistré** suivent déjà (`trades.screenshots`
passe par `useRealtimeTrades`) ; on vérifie que `useScreenshotUrls` signe les
nouveaux chemins à l'arrivée.

### 5.4 Indicateur de connexion

Petit libellé dans le cadre (`shell/`), visible seulement hors de l'état
nominal : « Hors ligne — tes modifications partiront au retour du réseau » /
« Reconnexion… ». Primitives `shared/ui`, tokens `--tv-*`, aucun halo, aucune
animation au-delà des keyframes autorisées. Clés i18n `en` + `fr`.

## 6. Palier 2 — ce qui vit dans le navigateur passe en base

### 6.1 Migration `…_live_sync_device_data.sql`

```sql
create table if not exists public.jarvis_conversations (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.jarvis_messages (
  id text primary key,                 -- JarvisMessage.id (déjà généré côté client)
  conversation_id uuid not null references public.jarvis_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','error')),
  blocks jsonb not null,
  created_at timestamptz not null
);
create index if not exists jarvis_messages_conv_created
  on public.jarvis_messages (conversation_id, created_at);
create table if not exists public.checklist_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
```

RLS owner-only (4 policies), trigger `set_updated_at`, `replica identity full`,
ajout à la publication, ajout à `delete-account`.

Aucune nouvelle fonction SQL : le compteur Jarvis passe par
`user_preferences` (§6.2). Lire `ai_rate_limits` aurait demandé une fonction
`SECURITY DEFINER` de plus, et ce compteur ne compte que lorsque la
monétisation est active (`AI_REQUIRE_PRO`) — l'affichage actuel, lui, compte
toujours.

### 6.2 Jarvis

- `SupabaseConversationStore implements ConversationStore` remplace
  `JarvisConversationStore` derrière `jarvisConversationStore(userId)`.
  `saveMessages` n'écrit que les messages absents (upsert par `id`) et met à
  jour `updated_at`/`title`. Plus d'éviction à 60 (limite du `localStorage`,
  pas du produit).
- `useConversations` et la conversation ouverte s'abonnent à
  `jarvis_conversations` / `jarvis_messages`.
- « Jarvis réfléchit » sur les autres appareils : broadcast `jarvis:pending
  { conversationId }` à l'envoi, `jarvis:settled` à la réponse ; l'indicateur
  s'éteint seul après 120 s sans réponse.
- Reprise : au premier montage d'un appareil, les conversations locales sont
  envoyées (upsert, ids conservés → idempotent), puis les clés locales
  supprimées. Échec réseau → on retentera au prochain lancement, rien n'est
  effacé.
- Compteur « il te reste X analyses » (`aiUsage.ts`, affichage de confort ; la
  barrière réelle reste `backend/require-pro.ts`) : la valeur
  `{ date, count }` passe de `localStorage` à `user_preferences`
  (`jarvis.usage`), donc partagée et live. Même remise à zéro à minuit local.
  Deux incréments au même instant sur deux appareils peuvent n'en compter
  qu'un : accepté pour un affichage, documenté.

### 6.3 Checklist

- Réponses du jour : `checklist_days` (upsert regroupé 400 ms). Reprise des
  jours locaux au premier montage.
- Config : `profiles.checklist_config` devient l'unique source ; la copie
  locale est supprimée.
- `useEdgeScore` lit les jours de checklist par **une seule** requête sur la
  période (`day between …`), jamais un appel par jour.

### 6.4 `user_preferences` (live depuis le palier 1)

Nouvelles clés : `customThemes` (le thème actif reste local), `jarvis.usage`, `flags.onboarded`,
`flags.checklistWizardSeen`, `flags.welcomeSeen`, `brokers.alerted`,
`notifications.maintainedOn`. Reprise des valeurs locales au premier montage
(union pour les listes, `true` l'emporte pour les drapeaux).

## 7. Palier 3 — frappe live, brouillons partagés, file hors ligne

### 7.1 Migration `…_live_drafts.sql`

```sql
create table if not exists public.live_drafts (
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_key text not null,             -- 'trade:new', 'trade:{id}', 'missed:new', 'missed:{id}', 'jarvis:composer:{conv}'
  fields jsonb not null,
  device_id text,
  updated_at timestamptz not null default now(),
  primary key (user_id, draft_key)
);
```

RLS owner-only, realtime, `delete-account`.

### 7.2 `useLiveDraft` (`app/hooks/useLiveDraft.ts`)

Remplace `useDraftAutosave` (même contrat : `key`, `form`, `dirty`, `guard`)
et ajoute `setForm` pour appliquer l'extérieur.

- **Émission** : à chaque changement, diff champ par champ contre le dernier
  état émis ; broadcast `draft:patch { key, fields, deviceId, at }` regroupé
  toutes les ~100 ms.
- **Persistance** : upsert `live_drafts` toutes les ~800 ms, et immédiatement
  sur `visibilitychange` caché / `pagehide` / démontage. Copie locale gardée
  comme filet hors ligne, renvoyée au retour du réseau.
- **Réception** : un patch d'un autre `deviceId` pour la même clé est appliqué
  au formulaire (dernière frappe gagne). Le champ qui a le focus conserve la
  position du curseur (sélection recalculée sur la différence de texte).
- **Ouverture tardive** : lecture de `live_drafts` puis écoute des patchs.
- **Badge** : `useHasTradeDraft` lit `live_drafts` (live) au lieu du
  `localStorage`.
- **Enregistrement ailleurs** : suppression de la ligne `live_drafts` +
  broadcast `draft:closed { key, reason: "saved" }` → l'autre appareil ferme
  la popup et affiche un toast. `trade:new` sauvegardé ne peut donc pas être
  enregistré deux fois.
- **Captures** : incluses dans le brouillon (chemins Storage déjà envoyés).
  Brouillon abandonné → fichiers supprimés via `removeScreenshotFiles`.

Formulaires branchés : `TradeModal`, modale des Setups manqués, compositeur
Jarvis.

### 7.3 Éditeurs auto-enregistrés

`TradingPlan`, `TradingRulesSection`, configuration de la `Checklist` :
`useLiveText(key, value, setValue)` diffuse la frappe (broadcast seul, même
regroupement) en plus de l'enregistrement débouncé existant ; l'écriture en
base reste la vérité, le broadcast ne fait qu'avancer l'affichage.

### 7.4 File hors ligne (`app/store/offlineQueue.ts`)

Écritures idempotentes uniquement (upsert par clé, delete par id) : trades,
`live_drafts`, `checklist_days`, `user_preferences`, champs du profil,
messages Jarvis. Une écriture qui échoue pour cause réseau est mise en file
(`localStorage` namespacé, purgé à la déconnexion) avec son horodatage ; au
retour (`online` + canal `SUBSCRIBED`), la file est rejouée dans l'ordre. Une
entrée est **abandonnée** si la ligne en base a un `updated_at` plus récent
que l'écriture en file (la plus récente gagne). Les trades gardent leur
écriture optimiste ; le toast d'échec devient « enregistré hors ligne, envoi au
retour du réseau ».

## 8. Purge et déconnexion

`stopLiveSync()` avant `purgeLocalSessionData()`. Les données étant désormais
en base, la purge ne fait plus perdre de travail. `KEPT_ON_LOGOUT` inchangée.

## 9. Performance et quotas

- Un canal par appareil (contre trois aujourd'hui), cache corrigé en place,
  aucune requête par changement de profil, aucun N+1 (checklist de l'Edge Score
  en une requête).
- Frappe : ≤ 10 messages/s par appareil qui tape, aucun quand rien ne change.
- Plan gratuit Supabase : connexions simultanées et messages Realtime
  plafonnés (ordre de grandeur : quelques centaines d'appareils connectés en
  même temps, quelques millions de messages par mois — **à revérifier sur la
  grille Supabase en vigueur au moment du palier 3**). Suffisant aujourd'hui ;
  le passage Pro est à documenter dans `BACKEND.md` comme seuil de croissance.

## 10. Tests

- Unitaires (`bun test`) : moyeu (abonnements, rattrapage, statut — client
  Supabase simulé), diff/fusion des brouillons et curseur, file hors ligne
  (rejeu, abandon si plus récent), reprise de l'historique local Jarvis et
  checklist (idempotence), clés `dedup_key`.
- SQL (`scripts/test-sql.sh`) : RLS des nouvelles tables, index unique
  `dedup_key`, policies `realtime.messages` (un compte ne peut ni écouter ni
  diffuser sur le canal d'un autre).
- Bout en bout : deux contextes Playwright (dont un « privé » sans stockage)
  sur un compte `tv*@test.dev` jetable, supprimé après usage — trade, note
  tapée, notification lue, message Jarvis, réglage. Exécuté à la main par
  palier (base réelle), pas en CI.
- Portes à chaque palier : typecheck → lint → build → test, sous les TZ de la
  CI.

## 11. Documentation à mettre à jour

`ARCHITECTURE.md` (§3 état et données : moyeu live, ce qui reste par
appareil), `DATABASE.md` (tables, publication, policies `realtime.messages`,
`dedup_key`, liste RGPD), `FEATURES.md` (Jarvis,
checklist, journal), `AI.md` (stockage des conversations), `BACKEND.md`
(quota Realtime), `CHANGELOG.md`.

## 12. Hors périmètre

Co-édition CRDT ; synchro de l'écran affiché ; tables orphelines
`discipline_days` / `replay_sessions` ; persistance serveur des réponses Jarvis
par le backend (le client reste l'écrivain, derrière `ConversationStore`).

## 13. Risques

| Risque | Parade |
| --- | --- |
| Canal privé + `postgres_changes` refusé | Repli à deux canaux, API inchangée (§4.1) |
| Écho de ses propres écritures | Idempotent : même ligne réinjectée ; broadcast sans écho |
| Rejeu hors ligne qui écrase plus récent | Comparaison `updated_at` avant rejeu (§7.4) |
| Quota Realtime du plan gratuit | Regroupement des frappes, seuil documenté |
| Fichiers orphelins de captures | Nettoyage à l'abandon du brouillon |
| Tests qui lisent les sources | Suite complète à chaque palier, aucune assertion affaiblie |
