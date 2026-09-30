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
