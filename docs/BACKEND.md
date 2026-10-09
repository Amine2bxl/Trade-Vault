# Backend — frontière serveur

Il n'y a pas d'API REST séparée : le serveur, ce sont des **server functions**
TanStack (`createServerFn`) appelées comme des fonctions typées, plus quelques
**endpoints HTTP bruts** dans `src/server.ts` (webhooks, crons, facturation,
administration). Schéma de données : [`DATABASE.md`](DATABASE.md). Chaîne IA :
[`AI.md`](AI.md).

**Invariant** : les secrets (clés LLM, Stripe, Coinbase, Resend, ElevenLabs,
VAPID privée, service role Supabase) ne quittent jamais `src/backend/`. Ils se
lisent via `process.env` dans des modules jamais inclus dans le bundle client.

## 1. Conventions

| Fichier | Rôle | Importable par l'UI ? |
| --- | --- | --- |
| `*.functions.ts` | Server functions exposées à l'UI | Oui (exécution serveur) |
| `*.server.ts` | Helpers internes : paiement, e-mails, crons, crypto push, rate-limit | Non |
| `require-pro.ts`, `require-admin.ts`, `admin-access.ts` | Gardes d'accès composées dans les server functions | Non |
| `ai-payload.ts`, `cron-batch.ts`, `ai-tools/` | Briques partagées côté serveur | Non |

Le paquet Next `server-only` est interdit par ESLint : la convention est le
suffixe `*.server.ts`.

## 2. Server functions

| Fonction | Fichier | Rôle |
| --- | --- | --- |
| `askCoach` | `coach.functions.ts` | Jarvis (seul endpoint IA en production) |
| `brokerCapabilities`, `startTradovateOAuth`, `completeTradovateOAuth`, `syncBrokers`, `refreshBrokerAccountList` | `brokers.functions.ts` | Synchro broker (§9) — palier Pro (`requireProPlan`) sauf `brokerCapabilities` |
| `extractMemory` | `memory.functions.ts` | Extraction de souvenirs (coupée sauf `AI_MEMORY_EXTRACTION=1`) |
| `acceptProposal` | `proposals.functions.ts` | Seule voie d'écriture de Jarvis : applique une proposition acceptée |
| `generateMyMonthlyReport` | `reports.functions.ts` | Rapport mensuel à la demande |
| `sendPushToSelf` | `push.functions.ts` | Web-push vers les appareils de l'utilisateur, élague les souscriptions mortes |
| `fetchEconomicCalendar` | `economic-calendar.functions.ts` | Lecture du cache du calendrier économique (+ rafraîchissement opportuniste) |
| `ttsCapabilities`, `ttsSpeak` | `tts.functions.ts` | Voix hébergée optionnelle (ElevenLabs) |
| `aiChat`, `aiGenerate*`, `aiAnalyzeTrade`, `aiDetectPatterns` | `ai.functions.ts` | Catalogue historique, **non appelé** par l'UI |

**Authentification** : `requireSupabaseAuth`
(`integrations/supabase/auth-middleware.ts`, généré — ne pas éditer) exige
`Authorization: Bearer <token>` et fournit un client Supabase **portant le
token de l'appelant** : la RLS reste la dernière ligne de défense.

**Accès et quota IA** : `requireJarvisAccess` / `requireProAccess`
(`require-pro.ts`) combinent l'entitlement (`domain/entitlement.ts`, actif si
`AI_REQUIRE_PRO=true`) et le quota atomique SQL (`consume_ai_quota*`,
`AI_RATE_LIMIT_PER_HOUR`).

## 3. Endpoints HTTP (`src/server.ts`)

Modules chargés par **import dynamique** : le code de paiement ou d'e-mail
n'est jamais évalué sur une requête de page. Rate-limit par IP
(`rate-limit.server.ts`) sur `/api/*` hors crons.

| Chemin | Méthode | Rôle |
| --- | --- | --- |
| `/api/health` | tout | Sonde de santé |
| `/api/cron/monthly-reports` · `lifecycle-emails` · `pattern-scan` · `economic-calendar` | POST | Crons (voir §4) |
| `/api/cron/broker-sync` | GET, POST | Rattrapage quotidien de la synchro broker (§9) |
| `/api/emails/welcome` | POST | E-mail de bienvenue |
| `/api/billing/checkout` · `/api/billing/portal` | POST | Stripe Checkout / portail client |
| `/api/stripe/webhook` | POST | Webhook Stripe (signature vérifiée, idempotent) |
| `/api/crypto/checkout` · `/api/crypto/webhook` | POST | Coinbase Commerce |
| `/api/admin/*` (`me`, `grants`, `promos`…) | GET/POST | Accès offerts et codes promo, réservé à `ADMIN_EMAILS` |
| `/robots.txt`, `/sitemap.xml` | GET | Générés depuis `PUBLIC_ROUTES` — voir [`SEO.md`](SEO.md) |

`src/server.ts` normalise aussi les erreurs SSR catastrophiques en page HTML
(au lieu du 500 JSON opaque de h3).

## 4. Crons (`vercel.json`)

| Planning (UTC) | Chemin | Effet |
| --- | --- | --- |
| `0 6 1 * *` | `monthly-reports` | Rapport du mois écoulé par utilisateur actif, e-mail + push (`?report=YYYY-MM`) |
| `0 8 * * *` | `lifecycle-emails` | Expirations d'essai, e-mails de cycle de vie, rappels d'objectifs, purge de `ai_agent_runs` (90 j) — best-effort |
| `0 5 * * *` | `economic-calendar` | Synchro Forex Factory → `economic_events` (semaine en cours ; `actual` non fourni par la source) |
| `0 3 * * *` | `pattern-scan` | Détection de motifs → propositions ([`AI.md`](AI.md) §4) |
| `0 20 * * 1-5` et `0 21 * * 1-5` | `broker-sync` | Connexions broker actives non synchronisées depuis 1 h, AVANT la clôture CME de 17:00 ET (`/fill/list` ne rend que la séance en cours) — deux créneaux (`?slot=edt|est`), seul celui de la saison en cours à New York travaille (`cronSlotActive`) (§9) |

Garde-fous : `Authorization: Bearer $CRON_SECRET` obligatoire (refus sans
secret configuré) ; client **service-role** limité à ces handlers ;
idempotence e-mail via `email_log` ; balayages découpés (`cron-batch.ts`) pour
survivre au timeout. Le plan Vercel Hobby n'autorise qu'un passage par jour :
la fraîcheur du calendrier économique vient d'un rafraîchissement opportuniste
(`syncIfStale`, 10 min, compare-and-swap sur `last_attempt_at`).

> ⚠️ À vérifier : les crons n'acceptent que `POST`, alors que Vercel Cron
> appelle en `GET` (voir [`ROADMAP.md`](ROADMAP.md)).

## 5. Paiement

- **Stripe** (`billing.server.ts`, REST sans SDK) : Checkout, portail, webhook
  à signature vérifiée (comparaison à temps constant, fenêtre anti-rejeu).
  Plans et prix : `domain/plans.ts` (Free / Pro / Elite, mensuel ou annuel) ;
  identifiants de prix `STRIPE_PRICE_*`. Pas d'essai gratuit.
- **Coinbase Commerce** (`crypto-pay.server.ts`) : même contrat.
- **Idempotence** : `processed_webhook_events` rend tout rejeu inoffensif ;
  les transitions passent par la fonction SQL `apply_subscription_event`.
- **Codes promo et accès offerts** : `promo.server.ts`, `admin.server.ts`,
  décision pure dans `domain/promo.ts`.
- Parcours d'achat réel et tâches du propriétaire (Stripe Tax, webhooks,
  produits) : [`ROADMAP.md`](ROADMAP.md#avant-le-lancement).

## 6. E-mails, push, voix

- **E-mails** : Resend (`RESEND_API_KEY`, `EMAIL_FROM`), gabarits HTML inline
  (`email-templates.server.ts`), URL publique `PUBLIC_SITE_URL`.
- **Web-push** : implémentation maison RFC 8291 (`push-crypto.server.ts`),
  VAPID ; service worker `public/sw-push.js`. La clé publique VAPID est
  publique par nature ; `VAPID_PRIVATE_KEY` est obligatoire.
- **Voix hébergée** : `tts.functions.ts`, désactivée sans `ELEVENLABS_API_KEY`
  ou si `TTS_PROVIDER=local` ; la voix locale prend le relais.

## 7. Variables d'environnement

Le contrat est [`.env.example`](../.env.example) : toute variable serveur lue
par le code doit y être documentée (`tests/envExample.test.ts`). Seules les
variables `VITE_*` atteignent le client. `SUPABASE_SERVICE_ROLE_KEY` est
réservée aux crons et webhooks, jamais à une server function utilisateur.

## 8. Authentification Google

Google ne redirige jamais vers l'app, mais vers Supabase :
`signInWithOAuth` → `…supabase.co/auth/v1/authorize` → Google →
`GOOGLE_CALLBACK_URL` (`src/shared/site.ts`, inchangé quel que soit le domaine)
→ `SITE_URL` (liste blanche Supabase → Authentication → URL Configuration).
Seuls les scopes non sensibles (`openid`, e-mail, profil) sont demandés : ne
jamais en ajouter sans mesurer le coût de vérification Google. L'adresse de
support déclarée à Google doit rester `SUPPORT_EMAIL` (`src/app/types.ts`).

## 9. Synchronisation broker (Tradovate)

Le trader connecte un login Tradovate (prop firms comprises) ; chaque
aller-retour clôturé arrive dans son journal, déjà rempli de tout le
structurel, et ouvre son formulaire pour qu'il complète le jugement.

- **Connexion — chez Tradovate, jamais chez nous** — un seul parcours, OAuth
  (`brokers.functions.ts`) : le trader est redirigé vers la page de connexion
  de Tradovate (`TRADOVATE_CLIENT_ID` / `TRADOVATE_CLIENT_SECRET`), s'y
  identifie, revient sur `/brokers` avec `code` + `state` (`state` stocké en
  empreinte SHA-256, 30 min de validité). Le `state` vient de l'URL et d'elle
  seule : le substituer depuis le navigateur laisserait greffer sur la session
  du trader un code obtenu par un tiers sur son propre compte Tradovate. Seule
  la tentative (login à reconnecter, options) est gardée en `sessionStorage`,
  pour que « Réessayer » rejoue la même. L'**adresse de retour** suit l'origine de
  l'appel (`broker-oauth.server.ts` : domaine, URL Vercel du déploiement,
  `localhost`, `TRADOVATE_REDIRECT_ORIGINS`), est mémorisée dans
  `oauth_redirect_uri` et renvoyée à l'identique à l'échange — Tradovate
  l'exige au caractère près ; `TRADOVATE_REDIRECT_URI` force une adresse
  unique. L'environnement retenu est celui qui porte des comptes
  (`detectEnvironment` : un login prop firm vit souvent en démo). Identifiant, mot de passe et e-mail
  restent dans la base de Tradovate : aucune fonction ne les reçoit, aucune
  colonne ne les stocke. Une connexion expirée se **reconnecte** par le même
  parcours (`startTradovateOAuth({ connectionId })`) : comptes rattachés et
  curseur conservés. Au retour, `SyncCelebration` montre ce que la première
  synchro a réellement trouvé (comptes, trades) — ou dit qu'elle n'a pas
  abouti, avec « Réessayer ». Sans identifiants OAuth, sans tables (migration
  absente) ou sans chiffrement, la page le dit à tous, propose l'import CSV,
  et ne vend aucun bouton qui échouerait ; l'administrateur (`ADMIN_EMAILS`)
  voit la check-list : variables manquantes (noms seulement), adresse de
  retour exacte à déclarer, permissions « Read Only ». Les erreurs sont des
  codes stables (`schema_missing`, `exchange_failed`, `permission_denied`…),
  jamais une exception brute.
- **Lecture seule, par construction** — `tradovate.server.ts` n'appelle que
  les chemins de `READ_ONLY_ENDPOINTS` (listes et fiches : comptes, fills,
  ordres, versions d'ordre, positions, frais, contrats), tous en `GET` ;
  `assertReadOnly` refuse tout autre chemin avant le réseau (passer, modifier
  ou annuler un ordre, lire `/auth/me` ou `/user/*`). Les seuls `POST` sont
  l'échange du code OAuth et le `refresh_token` (identifiants d'APPLICATION et
  jeton, rien du trader). L'application partenaire se déclare aussi en
  permissions « Read Only » chez Tradovate. Testé : `tests/brokerSync.test.ts`.
- **Hôtes dédiés** (NinjaTrader, octobre 2026) — une prop firm peut avoir son
  hôte d'API, renvoyé dans `apiHosts` ou par une redirection 307. `fetch`
  retirerait l'en-tête `Authorization` en changeant d'origine : les
  redirections sont suivies à la main, seulement en HTTPS vers
  `tradovateapi.com`, `tradovate.com`, `ninjatrader.com` ou `ninjatrader.dev`,
  et l'hôte appris est enregistré (`broker_connections.api_hosts`).
- **Secrets** — seuls le jeton d'accès et le `refresh_token` sont stockés,
  chiffrés AES-256-GCM (`broker-crypto.server.ts`) avant toute écriture ;
  jamais renvoyés au navigateur (le store client ne lit que les colonnes
  publiques). Clé : `BROKER_CREDENTIALS_KEY` (préfixe `v1:`), ou à défaut une
  clé dérivée par HKDF de `SUPABASE_SERVICE_ROLE_KEY` (préfixe `d1:`) — les
  deux restent lisibles si la clé dédiée est posée plus tard.
- **Jeton** — ~90 min, renouvelé par `GET /auth/renewaccesstoken` 10 min avant
  expiration ; expiré, le `refresh_token` OAuth en redonne un sans renvoyer le
  trader chez Tradovate. Une panne passagère (5xx, 429, réponse illisible)
  n'est pas un refus : la connexion reste active et sera retentée. Sans jeton
  valide ni `refresh_token`, ou sur refus explicite, la connexion passe en
  `error` (`reauth_required`) ; l'app le signale une fois par épisode (toast,
  y compris au démarrage si la bascule a eu lieu pendant l'absence) : le
  trader se reconnecte en un clic.
- **Pro** — connecter, reconnecter et synchroniser passent par
  `requireProPlan` (`require-pro.ts`, palier via `domain/entitlement`, échoue
  fermé, préfixe `PLAN_LIMIT_PRO`) ; le cron filtre les propriétaires par
  palier en une requête (`brokerSyncAllowed`). Lire et SUPPRIMER ses
  connexions restent ouverts à tous (RLS).
- **Synchro** (`broker-sync.server.ts`, même code pour l'app et le cron) :
  comptes (`/account/list` → `broker_accounts`, rattachés au compte TradeVault
  par défaut de la connexion) → `/fill/list`, `/order/list`, `/position/list`
  → contrats (`contract` → `contractMaturity` → `product.valuePerPoint`, mis en
  cache dans `sync_cursor`) → frais (`fillFee`, au mieux) →
  `modules/brokers` (plat → plat, déterministe ; position antérieure à la
  fenêtre absorbée, jamais inventée) → stop initial (`orderVersion`) pour le
  risque et le R → `upsert … on conflict (user_id, external_id) do nothing`.
  `sync_cursor.syncedThrough` (dernière sortie traitée) empêche un trade
  supprimé de revenir ; il n'avance que sur une suite continue de trades
  réellement écrits (`advanceCursor`) — un trade refusé (limite d'offre,
  écriture en échec) est repris au passage suivant.
- **Cadence** — `useBrokerSync` (app ouverte, onglet visible) appelle
  `syncBrokers` toutes les 60 s ; le serveur ignore une connexion
  synchronisée depuis moins de 30 s. Le cron quotidien rattrape le reste.
- **Côté client** — les trades importés entrent dans le cache React Query du
  compte affiché ; ceux de cette session ouvrent le `TradeModal` un par un
  (P&L broker prérempli et modifiable, R déduit du risque — saisir un R
  réécrit le P&L ; contrats, prix et frais modifiables) ; les autres attendent
  dans le Journal (« N à relire »).

