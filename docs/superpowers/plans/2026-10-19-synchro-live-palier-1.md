# Synchro live — palier 1 : tout ce qui est déjà en base devient live

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** chaque donnée déjà stockée en base (profil complet, notifications,
comptes, objectifs, préférences, broker, propositions, mémoire, rapports,
intention/réflexion, abonnement) se met à jour en direct sur tous les appareils
connectés, sans rafraîchir.

**Architecture :** un moyeu sans React (`src/app/store/liveSync.ts`) ouvre un
canal Realtime par compte et redistribue les changements par table ; des caches
(`profileRow`, `userPrefs`) absorbent les changements de profil et de
préférences sans requête supplémentaire ; chaque écran s'abonne par
`useLiveTable`. Les trois canaux existants fusionnent dans le moyeu.

**Tech stack :** React 19, `@supabase/supabase-js` ^2.107 (Realtime
`postgres_changes`), React Query 5, Bun test, Postgres 16 (tests SQL).

**Spec :** `docs/superpowers/specs/2026-10-19-synchro-live-design.md` (§4, §5).

## Décisions prises dans ce plan (écarts assumés avec la spec)

1. **Canal du palier 1 = `db:{uid}`, non privé.** Les `postgres_changes` sont
   protégés par la RLS des tables (comme aujourd'hui). Le canal privé
   `user:{uid}` et ses policies `realtime.messages` arrivent avec le premier
   `broadcast` (palier 2, « Jarvis réfléchit »). C'est le repli prévu au §4.1
   de la spec, choisi d'emblée : il supprime le risque « canal privé +
   `postgres_changes` refusé » et l'ordre de déploiement migration → code.
   L'API du moyeu ne change pas.
2. **`trading_sessions` et `simulation_scenarios` ne sont pas branchées** :
   aucune surface montée ne les affiche (`SessionPanel`, `Simulator` hors
   `PAGES` ; `ConversationWorkspace` les lit à la demande). YAGNI.
3. **`onBroadcast` / `sendBroadcast`** ne sont pas écrits ici (palier 2).
4. **Captures d'un trade enregistré : rien à écrire.** `useScreenshotUrls`
   est déjà indexé sur la liste des chemins (`paths.join("|")`) : un chemin
   arrivé par `useRealtimeTrades` est signé au rendu suivant. Vérifié au
   Task 10, étape 4.

## Global Constraints

- Commentaires et commits en **français** ; fin de chaque message de commit :
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` puis
  `Claude-Session: https://claude.ai/code/session_01UoZzcCP3Ts934KEXjmKcvd`.
- Portes avant tout push : `bun run typecheck` → `bun run lint` →
  `bun run build` → `bun test` (+ `TZ=America/New_York bun test`,
  `TZ=Pacific/Auckland bun test`). Ne jamais affaiblir une assertion.
- Localement le verrou pointe vers un registre privé : si `bun install` échoue,
  lancer les tests qui tournent (`bun test <fichier>`) et laisser la CI faire
  foi pour typecheck/lint/build. Ne pas modifier `bun.lock`.
- Migrations **additives** et idempotentes (`if not exists`, garde
  `to_regclass`) ; jamais de SQL destructif ; **appliquer à la base réelle
  seulement avec l'accord explicite du trader**.
- RLS owner-only inchangée ; aucun secret côté client.
- Aucune chaîne visible codée en dur : clés dans `src/app/i18n/translations.ts`
  **et** `src/app/i18n/locales/fr.ts`.
- Design : charger les skills `.claude/skills/` (`ui-design`, `theme`,
  `typography`, `motion`) avant toute interface ; tokens `--tv-*`, primitives
  `src/shared/ui`, rien qui rayonne.
- `App.tsx` n'importe statiquement ni `recharts` ni `react-markdown`
  (`tests/eagerBundle.test.ts`).
- Imports : relatifs dans un dossier, `@/` au-delà.
- Restent **par appareil** (spec §2) : barre latérale, thème actif, voix
  Jarvis, filtres/périodes, **compte actif**.

## Review Focus

1. **Écho de sa propre écriture pendant la frappe** : dans un éditeur
   auto-enregistré (plan de trading, calculateur de lots), l'écho Realtime d'un
   enregistrement plus ancien ne doit jamais remplacer ce que le trader est en
   train de taper. → tests Task 4 (champs en attente conservés) et Task 6
   (clés en attente conservées), garde `dirty` Task 5.
2. **Realtime muet ou en erreur** (table non publiée, réseau coupé) : l'app
   fonctionne comme avant, sans toast d'erreur ; au retour du canal, tout est
   relu. → tests Task 2 (statut, rattrapage).
3. **Même alerte déclenchée par deux appareils à la même seconde** : une seule
   ligne, le popup s'ouvre sur les deux, le fermer sur l'un le ferme sur
   l'autre. → test SQL Task 1, tests Task 7.
4. **Changement de compte utilisateur dans le même onglet** : le canal suit,
   aucun cache ne rend la ligne de l'utilisateur précédent. → tests Task 2 et
   Task 4.
5. **Compte de trading actif supprimé depuis un autre appareil** : bascule sur
   le compte principal sans écran cassé ; le compte actif ne suit jamais un
   autre appareil. → tests Task 8.

---

### Task 1 : migration — publication des tables et anti-doublon des notifications

**Files :**
- Create : `supabase/migrations/20261019120000_live_sync_all_tables.sql`
- Modify : `tests/sql/harness.sql` (table `public.notifications` minimale)
- Create : `tests/sql/live-sync.sql`
- Modify : `scripts/test-sql.sh` (appliquer la migration deux fois, puis le test)

**Interfaces :**
- Produces : colonne `public.notifications.dedup_key text`, index unique
  `notifications_user_dedup_key (user_id, dedup_key)` (**non partiel** :
  PostgREST ne sait pas passer le prédicat d'un index partiel à
  `on conflict` ; les `NULL` restent distincts) ; publication
  `supabase_realtime` contenant les 15 tables de `LIVE_TABLES` (Task 2), toutes
  en `replica identity full`.

- [ ] **Step 1 : écrire le test SQL** `tests/sql/live-sync.sql`, dans le style
  de `tests/sql/broker.sql` (blocs `do $$ … raise exception … $$`) :
  - `live_sync_publication` : pour chaque table existante parmi
    `trades, missed_opportunities, profiles, accounts, goal_plans,
    notifications, user_preferences, agent_proposals, ai_memory,
    broker_connections, broker_accounts, monthly_reports, trade_intent,
    trade_reflection, subscriptions`, elle figure dans
    `pg_publication_tables` (`pubname = 'supabase_realtime'`) et
    `relreplident = 'f'`.
  - `live_sync_dedup_unique` : deux `insert` de même `(user_id, dedup_key =
    '2026-10-19:risk_leak:x')` → le second avec `on conflict (user_id,
    dedup_key) do nothing` n'ajoute rien (`count(*) = 1`).
  - `live_sync_dedup_null_free` : trois lignes `dedup_key = null` du même
    utilisateur coexistent (`count(*) = 3`).
  - `live_sync_dedup_per_user` : la même clé pour deux utilisateurs donne deux
    lignes.
- [ ] **Step 2 : ajouter au harnais** `public.notifications` (colonnes de la
  base réelle : `id uuid primary key, user_id uuid not null references
  auth.users(id) on delete cascade, kind text, title text, body text, url text,
  severity text, data jsonb, created_at timestamptz default now(), read_at
  timestamptz`) et la publication vide si absente.
- [ ] **Step 3 : lancer** `bash scripts/test-sql.sh` après avoir ajouté le test
  au script — attendu : ÉCHEC (`dedup_key` n'existe pas).
- [ ] **Step 4 : écrire la migration**, même boucle idempotente que
  `20260826120000_enable_realtime_sync.sql` (création de la publication si
  absente, `to_regclass` pour sauter une table absente, `replica identity full`,
  ajout si pas déjà publiée), puis `alter table … add column if not exists
  dedup_key text` et `create unique index if not exists …`. En-tête en
  français : pourquoi chaque table, pourquoi l'index n'est pas partiel, pourquoi
  aucun remplissage des lignes existantes (elles restent `NULL`, donc aucun
  conflit à la création de l'index).
- [ ] **Step 5 : lancer** `bash scripts/test-sql.sh` — attendu : tout passe, et
  la seconde application de la migration ne lève rien.
- [ ] **Step 6 : commit** `Synchro live : publier les tables du compte et
  dédupliquer les notifications en base`.

### Task 2 : le moyeu `liveSync`

**Files :**
- Create : `src/app/store/liveSync.ts`
- Test : `tests/liveSync.test.ts`

**Interfaces :**
- Consumes : `supabase` de `@/integrations/supabase/client` (`channel`,
  `removeChannel`).
- Produces :

```ts
export const LIVE_TABLES = [
  "trades", "missed_opportunities", "profiles", "accounts", "goal_plans",
  "notifications", "user_preferences", "agent_proposals", "ai_memory",
  "broker_connections", "broker_accounts", "monthly_reports", "trade_intent",
  "trade_reflection", "subscriptions",
] as const;
export type LiveTable = (typeof LIVE_TABLES)[number];
export interface LiveChange {
  table: LiveTable;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
}
export type LiveStatus = "online" | "connecting" | "offline";
export const DEVICE_ID: string;                 // crypto.randomUUID() par onglet, en mémoire
export function startLiveSync(userId: string): void;
export function stopLiveSync(): void;
export function onTable(table: LiveTable, handler: (c: LiveChange) => void): () => void;
export function onResync(handler: () => void): () => void;
export function getLiveStatus(): LiveStatus;
export function subscribeLiveStatus(handler: (s: LiveStatus) => void): () => void;
export const RESYNC_AFTER_HIDDEN_MS = 30_000;
```

- [ ] **Step 1 : écrire les tests** (client substitué par `mock.module`, comme
  `tests/tradeStore.test.ts` : un faux `channel(name)` qui enregistre chaque
  `.on(type, filter, cb)` et expose `emit(table, payload)` et
  `status(s)` pour appeler le callback de `.subscribe`) :
  - `relie chaque table de LIVE_TABLES` : après `startLiveSync("u1")`, un seul
    canal `db:u1`, 15 liaisons `postgres_changes`, filtre `user_id=eq.u1`
    partout sauf `profiles` → `id=eq.u1`.
  - `distribue par table` : un handler `onTable("goal_plans")` reçoit
    `{ table: "goal_plans", eventType: "UPDATE", new, old }` et rien des autres
    tables ; après désabonnement, plus rien.
  - `isole un handler qui lève` : le second handler de la même table est
    appelé.
  - `rattrape après coupure, pas au premier SUBSCRIBED` : `SUBSCRIBED` → 0
    appel `onResync` ; `CHANNEL_ERROR` puis `SUBSCRIBED` → 1 appel.
  - `rattrape au retour d'onglet après 30 s cachée` (`setSystemTime`) : caché
    31 s puis visible → 1 appel ; caché 5 s → 0.
  - `statut` : `connecting` au démarrage, `online` sur `SUBSCRIBED`, `offline`
    sur `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED` ou `offline` du navigateur ;
    `subscribeLiveStatus` notifié à chaque changement, pas en double.
  - `démarrage idempotent, changement d'utilisateur` : `start("u1")` deux fois
    → un canal ; `start("u2")` → `removeChannel` du canal `db:u1`, nouveau
    canal `db:u2` ; un `emit` tardif sur l'ancien canal n'atteint aucun handler.
  - `stopLiveSync` : `removeChannel` appelé, statut `offline`, les handlers
    restent enregistrés (ils servent au prochain `start`).
  - `sans window` (SSR) : `startLiveSync` ne lève pas et n'ouvre rien.
- [ ] **Step 2 : lancer** `bun test tests/liveSync.test.ts` — attendu : ÉCHEC
  (module absent).
- [ ] **Step 3 : implémenter** `liveSync.ts`. Registre `Map<LiveTable,
  Set<handler>>` au niveau du module (indépendant du canal) ; écouteurs
  `visibilitychange`, `online`, `offline` posés au `start`, retirés au `stop` ;
  chaque handler appelé dans un `try/catch` (`console.error`). En-tête en
  français : rôle, pourquoi un seul canal, pourquoi relire plutôt que rejouer.
- [ ] **Step 4 : lancer** `bun test tests/liveSync.test.ts` — attendu : PASS.
- [ ] **Step 5 : commit** `Synchro live : moyeu unique des changements par
  compte`.

### Task 3 : hooks et montage — un seul canal pour toute l'app

**Files :**
- Create : `src/app/hooks/useLiveSync.ts`, `src/app/hooks/useLiveTable.ts`
- Modify : `src/app/hooks/useRealtimeTable.ts`, `src/app/hooks/useRealtimeProfile.ts`,
  `src/app/trading/useRealtimeTrades.ts`, `src/app/shell/App.tsx:205-206`
- Test : `tests/liveSync.test.ts` (ajout d'un test de source)

**Interfaces :**
- Consumes : `startLiveSync`, `stopLiveSync`, `onTable`, `onResync` (Task 2).
- Produces :
  - `useLiveSync(userId: string | undefined): void` — `startLiveSync` quand
    l'id est là, `stopLiveSync` au nettoyage.
  - `useLiveTable(table: LiveTable, onChange: () => void, opts?: { debounceMs?: number; enabled?: boolean }): void`
    — rafales regroupées (défaut 150 ms), `onChange` lu par ref, appelé aussi
    sur `onResync` ; `enabled: false` n'abonne rien.
  - `useRealtimeTable`, `useRealtimeProfile`, `useRealtimeTrades` : **mêmes
    signatures**, plus aucun `supabase.channel` (passent par `onTable`).

- [ ] **Step 1 : écrire le test de source** `un seul canal Realtime dans
  l'app` : sous `src/app`, `supabase.channel(` n'apparaît que dans
  `store/liveSync.ts` (utiliser `readSource` de `tests/helpers/source`).
- [ ] **Step 2 : lancer** le test — attendu : ÉCHEC (trois occurrences dans les
  hooks existants).
- [ ] **Step 3 : implémenter** les deux nouveaux hooks, réécrire les trois
  existants sur `onTable` (même logique de patch du cache React Query pour
  `useRealtimeTrades`, même filtre de compte), monter `useLiveSync(user?.id)`
  dans `App.tsx` juste avant `useRealtimeTrades`.
- [ ] **Step 4 : lancer** `bun test tests/liveSync.test.ts tests/appMountedOnce.test.ts tests/eagerBundle.test.ts` — attendu : PASS.
- [ ] **Step 5 : commit** `Synchro live : un seul canal pour toute l'app`.

### Task 4 : le profil en une ligne, un cache, zéro requête en plus

**Files :**
- Create : `src/app/store/profileRow.ts`
- Modify : `src/app/store/profile.ts` (tous les `load*`/`save*` sur `profiles`),
  `src/app/trading/tradingRules.ts:14-35`, `src/app/trading/tradingPlan.ts:75-95`,
  `src/app/store/accounts.ts:231-250` (`loadActiveAccountId`/`saveActiveAccountId`)
- Test : `tests/profileRow.test.ts`

**Interfaces :**
- Consumes : `onTable("profiles")`, `onResync` (Task 2).
- Produces :

```ts
export type ProfileRow = Record<string, unknown>;
export function loadProfileRow(userId: string): Promise<ProfileRow | null>;
/** Écriture locale : appliquée tout de suite, colonnes marquées « en attente ». */
export function beginProfileWrite(userId: string, patch: ProfileRow): () => void; // rend `settle()`
export function replaceProfileRow(userId: string, row: ProfileRow): void;
export function invalidateProfileRow(userId?: string): void;
export function wireProfileRowLive(): () => void; // appelé par useLiveSync
```

  Les `load*` existants gardent leur signature et leur contrat d'erreur et
  **dérivent** de `loadProfileRow` ; chaque `save*` fait
  `const settle = beginProfileWrite(uid, patch)` puis l'`update`, et `settle()`
  dans un `finally`. `wireProfileRowLive` : sur `profiles` → `replaceProfileRow`
  avec `payload.new`, puis si `trading_rules` a changé →
  `window.dispatchEvent(new CustomEvent("tv-rules-updated", { detail: rules }))`,
  si `onboarding_monthly_target` a changé → `MONTHLY_TARGET_EVENT` ; sur
  `onResync` → `invalidateProfileRow()`.

- [ ] **Step 1 : écrire les tests** (client substitué qui compte les
  `select`) :
  - `une seule requête pour tous les lecteurs` : `loadConfluences`,
    `loadAccountBalance`, `loadOnboarding`, `loadChecklistConfig`,
    `loadCurrency`, `loadTradingRules`, `loadTradingPlan`, `loadLanguage`,
    `loadJarvisProfile` en parallèle → 1 `select` sur `profiles`.
  - `un changement distant remplace la ligne` : après `replaceProfileRow("u1",
    { …, currency: "EUR" })`, `loadCurrency("u1")` → `"EUR"` sans nouvelle
    requête.
  - `une écriture en cours n'est pas écrasée par l'écho` : `beginProfileWrite(
    "u1", { trading_plan: B })` puis `replaceProfileRow("u1", { trading_plan:
    A })` → `loadTradingPlan` rend B ; après `settle()`, un nouveau
    `replaceProfileRow` avec A → A.
  - `un échec de lecture n'est pas mémorisé` : premier `select` en erreur →
    `loadCurrency` rejette ; second appel → nouvelle requête.
  - `les utilisateurs sont isolés` : la ligne de `u1` n'est jamais rendue pour
    `u2` ; `invalidateProfileRow()` vide tout.
  - `les règles diffusent tv-rules-updated` : `wireProfileRowLive()`, puis
    changement `profiles` avec de nouvelles `trading_rules` → un événement avec
    les règles analysées ; sans changement des règles → aucun événement.
- [ ] **Step 2 : lancer** `bun test tests/profileRow.test.ts` — attendu : ÉCHEC.
- [ ] **Step 3 : implémenter** `profileRow.ts` (`select("*")`, promesse
  mémorisée par utilisateur et retirée en cas d'échec, carte des colonnes en
  attente avec compteur par colonne), puis convertir les lecteurs et
  écrivains. Garder les replis existants (`loadJarvisProfile` local,
  `loadChecklistConfig` silencieux). Brancher `wireProfileRowLive()` dans
  `useLiveSync`.
- [ ] **Step 4 : lancer** `bun test tests/profileRow.test.ts tests/store.test.ts tests/sessionPurge.test.ts tests/onboardingPlan.test.ts` — attendu : PASS.
- [ ] **Step 5 : commit** `Synchro live : profil lu une fois, mis à jour en
  direct`.

### Task 5 : les écrans qui lisent le profil se mettent à jour

**Files (Modify) :**
- Lecture seule : `src/app/shell/App.tsx` (devise, solde de départ),
  `features/dashboard/Dashboard.tsx`, `features/analytics/Analytics.tsx`,
  `features/goals/Goals.tsx`, `features/goals/useGoalProgress.ts`,
  `trading/useEdgeScore.ts`, `shell/FirstSessionWelcome.tsx`,
  `features/jarvis/Jarvis.tsx`, `features/jarvis/AiAssistant.tsx`,
  `features/journal/TradeModal.tsx` (confluences, solde),
  `features/checklist/Checklist.tsx` (onboarding, règles).
- Éditeurs : `features/trading-plan/TradingPlan.tsx`,
  `features/trading-plan/TradingRulesSection.tsx`,
  `features/settings/Settings.tsx`,
  `features/jarvis/workspaces/SettingsWorkspace.tsx`.
- Test : `tests/liveSync.test.ts` (test de source)

**Interfaces :**
- Consumes : `useLiveTable("profiles", reload)` (Task 3), lecteurs dérivés du
  cache (Task 4). `useTradingRules` et le `rulesRef` d'`App.tsx` n'ont rien à
  changer : ils écoutent déjà `tv-rules-updated`.

- [ ] **Step 1 : écrire le test de source** `les écrans du profil sont
  branchés` : chacun des fichiers listés ci-dessus contient
  `useLiveTable("profiles"`.
- [ ] **Step 2 : lancer** — attendu : ÉCHEC.
- [ ] **Step 3 : brancher.** Lecture seule : `reload` rappelle le même `load*`
  que l'effet de montage (le cache répond, aucune requête). **Éditeurs** :
  `reload` ne s'applique que si l'éditeur n'a pas de modification en attente
  (ref `dirty` vraie entre la frappe et la fin de l'enregistrement débouncé) ;
  sinon il est ignoré — la sauvegarde locale gagnera (dernière écriture).
- [ ] **Step 4 : lancer** `bun test` (suite complète) — attendu : aucun nouvel
  échec par rapport à la référence.
- [ ] **Step 5 : commit** `Synchro live : règles, plan, soldes et profil Jarvis
  suivent tous les appareils`.

### Task 6 : préférences du compte (`user_preferences`) en direct

**Files :**
- Modify : `src/app/utils/userPrefs.ts`,
  `src/app/features/calculator/LotSizeCalculator.tsx`,
  `src/app/features/settings/PushNotificationSettings.tsx`,
  `src/app/shell/App.tsx` (préférences de notification)
- Test : `tests/userPrefs.test.ts`

**Interfaces :**
- Consumes : `onTable("user_preferences")`, `onResync` (Task 2).
- Produces :
  - `loadUserPrefs(userId)` rend toujours l'objet **courant** (plus l'objet figé
    au premier chargement).
  - `replaceUserPrefs(userId: string, prefs: Record<string, unknown>): void` —
    garde la valeur locale des clés en attente d'envoi.
  - `invalidateUserPrefs(userId?: string): void`
  - `wireUserPrefsLive(): () => void` — appelé par `useLiveSync`.
  - Événement `USER_PREFS_EVENT = "tv:user-prefs"` (`detail: { userId }`) émis
    après chaque remplacement distant.

- [ ] **Step 1 : écrire les tests** :
  - `un changement distant devient visible` : `replaceUserPrefs("u1",
    { lotCalc: X })` → `loadUserPref("u1", "lotCalc")` rend X, et
    `tv:user-prefs` est émis.
  - `une clé en attente n'est pas écrasée` : `saveUserPref("u1", "lotCalc", B)`
    (minuteur non écoulé) puis `replaceUserPrefs("u1", { lotCalc: A })` →
    `loadUserPref` rend B ; après l'envoi (avancer le minuteur, upsert résolu),
    un nouveau remplacement par A → A.
  - `une clé écrite ailleurs n'est pas perdue` (contrat existant conservé) :
    l'upsert envoie la fusion base + local.
- [ ] **Step 2 : lancer** `bun test tests/userPrefs.test.ts` — attendu : ÉCHEC.
- [ ] **Step 3 : implémenter** (clés en attente suivies de `saveUserPref`
  jusqu'à la fin de l'`upsert`), appeler `wireUserPrefsLive()` dans
  `useLiveSync` à côté de `wireProfileRowLive()`, puis brancher les
  consommateurs sur `USER_PREFS_EVENT` (le calculateur ne recharge que si aucun
  champ n'est en cours de saisie, même règle `dirty` que Task 5).
- [ ] **Step 4 : lancer** `bun test tests/userPrefs.test.ts` — attendu : PASS.
- [ ] **Step 5 : commit** `Synchro live : préférences du compte en direct`.

### Task 7 : notifications live, anti-doublon et popup partagé

**Files :**
- Modify : `src/modules/notifications/policy.ts` (fonction pure),
  `src/modules/notifications/store.ts`, `src/modules/notifications/index.ts`
  (exports), `src/app/shell/App.tsx` (adaptateur `persist`, popup),
  `src/app/features/inbox/useUnreadCount.ts`, `src/app/features/inbox/Inbox.tsx`
- Test : `tests/notificationPolicy.test.ts` (ajouts), `tests/notificationLive.test.ts`

**Interfaces :**
- Produces :
  - `notificationDedupKey(n: AppNotification, today: string): string | null` —
    `null` sans `data.dedupKey` ; règle codée (`data.codedRule`) → la clé telle
    quelle (elle porte déjà sa période, et le runner la tient déjà pour unique
    sur 45 jours) ; sinon `${today}:${clé}` (cadence quotidienne de
    l'engine).
  - `persistNotification(n): Promise<boolean>` — `upsert` avec `dedup_key`,
    `{ onConflict: "user_id,dedup_key", ignoreDuplicates: true }` +
    `.select("id")` ; rend `true` si une ligne a été créée.
  - `notificationFromRow(row): AppNotification` (l'actuel `fromRow`, exporté).

- [ ] **Step 1 : écrire les tests** :
  - `notificationDedupKey` : sans clé → `null` ; `{ codedRule: true,
    dedupKey: "weekly_review:2026-10-12" }` → `"weekly_review:2026-10-12"` ;
    `{ dedupKey: "discipline_warning:max_trades" }` le `2026-10-19` →
    `"2026-10-19:discipline_warning:max_trades"`.
  - `persistNotification` (client substitué) : envoie `dedup_key` et
    `onConflict: "user_id,dedup_key"` ; rend `false` quand `select` rend `[]`.
  - `le popup ne s'ouvre que si la ligne est créée` : extraire l'adaptateur
    `persist` d'`App.tsx` dans
    `createPersistAdapter(deps: { persist: (n: AppNotification) => Promise<boolean>; open: (n: AppNotification) => void }): (n: AppNotification) => Promise<void>`
    dans `modules/notifications/policy.ts` (pur, dépendances injectées) et
    tester : `persist` → `false` ⇒ `open` jamais appelé ; `true` +
    `shouldInterrupt` ⇒ `open(n)` une fois ; `true` sans interruption ⇒ jamais.
- [ ] **Step 2 : lancer** les deux fichiers — attendu : ÉCHEC.
- [ ] **Step 3 : implémenter.** Puis :
  - `useUnreadCount` : **supprimer le sondage de 30 s**, `useLiveTable(
    "notifications", fetchCount)` ; garder l'écoute de `tv:notif-updated` et
    le cache `sessionStorage`.
  - `Inbox.tsx` : `useLiveTable("notifications", reload)`.
  - `App.tsx` : `onTable("notifications")` → `INSERT` d'une ligne dont
    `shouldInterrupt(notificationFromRow(row))` et dont l'id n'a pas déjà été
    ouvert sur cet onglet ⇒ `tv:open-notification` ; `UPDATE` avec `read_at`
    non nul pour l'id du popup ouvert ⇒ fermeture.
- [ ] **Step 4 : lancer** `bun test tests/notificationPolicy.test.ts tests/notificationLive.test.ts` — attendu : PASS.
- [ ] **Step 5 : commit** `Synchro live : notifications en direct, jamais en
  double, popup partagé`.

### Task 8 : comptes, objectifs, abonnement, broker, Jarvis, rapports, trades détaillés

**Files :**
- Modify : `src/app/store/accounts.ts` (fonction pure),
  `src/app/contexts/AccountContext.tsx`, `features/goals/Goals.tsx` et
  `features/goals/useGoalProgress.ts` (`goal_plans`),
  `src/app/hooks/useSubscription.ts` (`subscriptions` →
  `invalidateSubscription()`), `features/brokers/Brokers.tsx` et
  `features/brokers/useBrokerSync.ts` (`broker_connections`,
  `broker_accounts`), `features/jarvis/components/ProposalsPanel.tsx`
  (`agent_proposals`), `features/jarvis/workspaces/SettingsWorkspace.tsx`
  (`ai_memory`), `features/reports/Reports.tsx` (`monthly_reports`),
  `features/journal/TradeDetailModal.tsx` et `TradeModal.tsx`
  (`trade_intent`, `trade_reflection`)
- Test : `tests/accountType.test.ts` (ajouts), `tests/liveSync.test.ts`
  (couverture)

**Interfaces :**
- Produces : `pickActiveAccount(list: Account[], local: string | null, lastUsed: string | null): string | null`
  — local valide d'abord, sinon dernier utilisé en base, sinon principal
  (`isDefault`), sinon premier, sinon `null`.

- [ ] **Step 1 : écrire les tests** :
  - `pickActiveAccount` : local valide → local ; local supprimé → dernier
    utilisé ; les deux invalides → principal ; liste vide → `null`.
  - `couverture` : pour chaque table de `LIVE_TABLES`, au moins un fichier sous
    `src/app` (hors `store/liveSync.ts`) contient `useLiveTable("<table>"`,
    `onTable("<table>"` ou passe par un adaptateur nommé
    (`useRealtimeTrades` pour `trades`, `useRealtimeTable("missed_opportunities"`).
- [ ] **Step 2 : lancer** — attendu : ÉCHEC.
- [ ] **Step 3 : implémenter.** `AccountContext` : `pickActiveAccount` au
  chargement (le local passe désormais **avant** la base : compte actif par
  appareil) ; `useLiveTable("accounts", reloadList)` — si le compte actif a
  disparu, `apply(uid, pickActiveAccount(…))`. Les autres consommateurs : un
  `useLiveTable` qui rappelle leur chargement existant.
- [ ] **Step 4 : lancer** `bun test` (suite complète) — attendu : aucun nouvel
  échec.
- [ ] **Step 5 : commit** `Synchro live : comptes, objectifs, abonnement,
  broker, Jarvis et rapports en direct`.

### Task 9 : indicateur de connexion

**Files :**
- Create : `src/app/shell/LiveStatus.tsx`
- Modify : `src/app/shell/App.tsx` (montage), `src/app/i18n/translations.ts`,
  `src/app/i18n/locales/fr.ts`
- Test : suite existante (couverture des traductions, `themeCoverage`)

**Interfaces :**
- Consumes : `getLiveStatus`, `subscribeLiveStatus` (Task 2).
- Produces : `<LiveStatus />` — rien en `online` ; en `offline` ou
  `connecting` depuis plus de 2 s : un libellé discret.

- [ ] **Step 1 : charger** les skills `ui-design`, `theme`, `typography`,
  `motion`.
- [ ] **Step 2 : ajouter les clés** `liveStatus.offline` = « You're offline —
  your changes will sync when the connection is back » /
  « Hors ligne — tes modifications partiront au retour du réseau » et
  `liveStatus.connecting` = « Reconnecting… » / « Reconnexion… ».
- [ ] **Step 3 : implémenter** le composant (primitives `shared/ui`, tokens
  `--tv-*`, aucune ombre, aucun halo, apparition par une keyframe autorisée,
  `prefers-reduced-motion` respecté), monté une fois dans `App.tsx`, au-dessus
  de la barre mobile, sans recouvrir le bouton « Add trade ».
- [ ] **Step 4 : lancer** `bun test` — attendu : aucun nouvel échec.
- [ ] **Step 5 : commit** `Synchro live : indicateur hors ligne / reconnexion`.

### Task 10 : documentation, portes, base réelle, vérification à deux navigateurs

**Files :**
- Modify : `docs/ARCHITECTURE.md` (§3 État et données : moyeu live, ce qui reste
  par appareil), `docs/DATABASE.md` (publication, `dedup_key`), `docs/FEATURES.md`
  (`useRealtimeTrades` → moyeu ; inbox live), `docs/BACKEND.md` (quota Realtime
  du plan gratuit), `docs/CHANGELOG.md`,
  `docs/superpowers/specs/2026-10-19-synchro-live-design.md` (§4.1 et §5.1 :
  décisions 1 et 2 de ce plan)

- [ ] **Step 1 : documenter**, puis lancer les portes : `bun run typecheck`,
  `bun run lint`, `bun run build`, `bun test`,
  `TZ=America/New_York bun test`, `TZ=Pacific/Auckland bun test`,
  `bash scripts/test-sql.sh` — attendu : tout vert (ou, si le registre privé
  bloque l'installation locale, CI verte sur la PR).
- [ ] **Step 2 : commit + push** sur `claude/epic-mendel-hb3gts`, mettre à jour
  la description de [Amine2bxl/Trade-Vault#229](https://github.com/Amine2bxl/Trade-Vault/pull/229).
- [ ] **Step 3 : demander l'accord du trader**, puis appliquer
  `20261019120000_live_sync_all_tables` à la base réelle (Supabase MCP
  `apply_migration`) et vérifier par `select tablename from
  pg_publication_tables where pubname = 'supabase_realtime'` (15 tables).
- [ ] **Step 4 : vérification à deux navigateurs** (Playwright global, deux
  contextes dont un sans stockage persistant) sur l'aperçu Vercel de la PR,
  compte jetable `tv-live-<date>@test.dev` supprimé après usage : changer une
  règle, la devise, marquer une notification lue, créer un objectif, enregistrer
  un trade sur A → visible sur B en < 1 s, sans rafraîchir. Couper le réseau de
  B 40 s, modifier sur A, rétablir → B rattrape. Rapporter le résultat tel
  quel.
