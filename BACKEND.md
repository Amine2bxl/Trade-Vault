# TradeVault — Backend

> **Document propriétaire de la frontière serveur** : server functions,
> endpoints HTTP bruts, authentification, gating, crons, paiement, e-mails,
> web-push, TTS, variables d'environnement et sécurité serveur.
>
> Schéma de données : [`DATABASE.md`](DATABASE.md) · Couches et flux :
> [`ARCHITECTURE.md`](ARCHITECTURE.md) · Chaîne IA :
> [`AI_ARCHITECTURE.md`](AI_ARCHITECTURE.md).
>
> Dernière vérification contre le code : **2026-07-28**.

---

## 1. Principe

Il n'existe **pas d'API REST séparée**. Le serveur est constitué de :

1. **Server functions TanStack** (`createServerFn`) — appelées comme des
   fonctions typées depuis l'UI, exécutées côté serveur.
2. **Endpoints HTTP bruts** dans `src/server.ts` — pour ce qui ne peut pas être
   une server function : webhooks signés, crons Vercel, redirections de
   paiement.

**Invariant absolu** : les secrets (clés LLM, Stripe, Coinbase, Resend,
ElevenLabs, VAPID privée, service role Supabase) ne franchissent **jamais** la
frontière `src/backend/` vers le client. Ils sont lus via `process.env`, dans
des modules qui ne sont jamais inclus dans le bundle client.

---

## 2. Convention de nommage

| Suffixe | Rôle | Importable par l'UI ? |
| --- | --- | --- |
| `*.functions.ts` | Server functions exposées à l'UI via `createServerFn` | **Oui** (exécution serveur) |
| `*.server.ts` | Helpers serveur internes (paiement, e-mails, crons, crypto push) | **Non** |
| `require-pro.ts` | Middleware auth + entitlement + rate-limit | Non (composé dans les `*.functions.ts`) |

Le paquet Next `server-only` est **interdit par ESLint** : la convention du
projet est le suffixe `*.server.ts`.

---

## 3. Server functions

| Fonction | Fichier | Middleware | Rôle |
| --- | --- | --- | --- |
| `askCoach` | `coach.functions.ts` | `requireProAccess` | **Le seul endpoint IA en production.** Valide le payload ancré (Zod + caps), exécute l'agent coach, renvoie `{ answer, source: "ai" \| "deterministic" }` |
| `sendPushToSelf` | `push.functions.ts` | `requireSupabaseAuth` | Envoie un web-push à toutes les souscriptions de l'utilisateur courant ; élague les souscriptions mortes (404/410) |
| `generateMyMonthlyReport` | `reports.functions.ts` | `requireSupabaseAuth` | Génération à la demande d'un rapport mensuel (mois courant ou passé) ; `withAi: false` saute le résumé IA (utilisé par le backfill d'import CSV) |
| `ttsCapabilities` | `tts.functions.ts` | — | Sonde bon marché : la voix hébergée est-elle disponible ? |
| `ttsSpeak` | `tts.functions.ts` | — | Synthèse vocale hébergée (ElevenLabs) → data-URL MP3 ; renvoie `available: false` si non configurée |
| `aiChat`, `aiGenerateDailyBrief`, `aiGenerateWeeklyReview`, `aiAnalyzeTrade`, `aiDetectPatterns`, `aiGenerateLessons` | `ai.functions.ts` | `requireProAccess` | ⚠️ **Catalogue de services historique — actuellement appelé par aucune surface UI.** Voir §9 (dette). |

### 3.1 Authentification — `requireSupabaseAuth`

Middleware généré (`integrations/supabase/auth-middleware.ts`, **ne pas éditer à
la main**) :

1. Vérifie la présence de `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`.
2. Exige un en-tête `Authorization: Bearer <token>` (aucun autre schéma).
3. Crée un client Supabase **portant le token de l'appelant** — donc soumis à la
   **RLS de cet utilisateur**, jamais un client service-role.
4. Valide le token via `auth.getClaims` et expose au handler
   `context = { supabase, userId, claims }`.

Toute server function touchant des données utilisateur passe par ce middleware
et utilise `context.supabase` : **la RLS reste la dernière ligne de défense**,
même en cas de bug applicatif.

### 3.2 Gating et rate-limit — `requireProAccess`

Chaîne après `requireSupabaseAuth` et applique deux contrôles :

**1. Entitlement (désactivé en beta).** Actif uniquement si
`AI_REQUIRE_PRO === "true"`. Lit `subscriptions.status` / `trial_ends_at` et
refuse (`ProRequiredError`) si l'utilisateur n'a ni plan actif ni essai en
cours. Le prédicat `isEntitled()` est **pur et testable**.

**2. Rate-limit anti-abus (toujours actif).** Appelle la fonction SQL atomique
`consume_ai_quota(p_limit, p_window_seconds)` — fenêtre fixe d'une heure,
`AI_RATE_LIMIT_PER_HOUR` (défaut **60**). Refuse (`RateLimitError`) sur un
`false` définitif.

**Politique d'échec — décision explicite** : les deux contrôles **échouent
ouverts** (`fail-open`) sur une erreur d'infrastructure (base indisponible,
migration non appliquée). Un incident technique ne doit jamais verrouiller un
utilisateur hors du produit. Ils ne refusent que sur un verdict **lu avec
succès**. Au passage au payant, l'entitlement devra basculer en `fail-closed`.

---

## 4. Endpoints HTTP bruts (`src/server.ts`)

`src/server.ts` est l'entrée serveur : il intercepte quelques chemins avant de
déléguer au handler TanStack, et **normalise les erreurs SSR catastrophiques**
(h3 transforme un throw en 500 JSON opaque `{"unhandled":true}` — le wrapper le
détecte, logge l'erreur réelle capturée et rend une page d'erreur HTML).

| Chemin | Méthode | Handler | Rôle |
| --- | --- | --- | --- |
| `/api/cron/monthly-reports` | GET | `monthly-reports.server` | Cron mensuel — rapports + e-mail + push |
| `/api/cron/lifecycle-emails` | GET | `lifecycle-emails.server` | Cron quotidien — e-mails de cycle de vie, **puis** rappels d'objectifs (best-effort) |
| `/api/cron/economic-calendar` | GET | `economic-calendar.server` | Synchro du calendrier économique dans le cache Postgres |
| `/api/emails/welcome` | POST | `lifecycle-emails.server` | E-mail de bienvenue |
| `/api/billing/checkout` | POST | `billing.server` | Création d'une session Stripe Checkout |
| `/api/billing/portal` | POST | `billing.server` | Portail client Stripe |
| `/api/stripe/webhook` | POST | `billing.server` | Webhook Stripe (signature vérifiée) |
| `/api/crypto/checkout` | POST | `crypto-pay.server` | Charge Coinbase Commerce |
| `/api/crypto/webhook` | POST | `crypto-pay.server` | Webhook Coinbase (signature vérifiée) |

Tous les modules sont chargés par **import dynamique** : le code de paiement et
d'e-mail n'est jamais évalué sur une requête de page normale.

---

## 5. Tâches planifiées (crons Vercel)

Déclarées dans `vercel.json` :

| Planning (UTC) | Chemin | Effet |
| --- | --- | --- |
| `0 6 1 * *` | `/api/cron/monthly-reports` | Génère le rapport du mois écoulé pour chaque utilisateur ayant des trades, l'envoie par e-mail et pousse une notification avec deep-link `/?report=YYYY-MM` |
| `0 8 * * *` | `/api/cron/lifecycle-emails` | Balayage des essais expirés → `free`/`expired` ; e-mail **trial-ending** (fin d'essai < 48 h) ; e-mail **winback** (essai expiré depuis 3 à 10 jours) ; **puis** rappels de plan à 6 mois (le handler ne s'exécute que le lundi) |
| `0 5 * * *` | `/api/cron/economic-calendar` | Récupère l'export officiel du calendrier Forex Factory (semaine en cours) et l'upserte dans `economic_events`. La clé primaire est un hash stable de (instant, devise, titre), donc la même semaine peut être ré-ingérée indéfiniment sans doublon. Échec = aucune écriture destructive, cache précédent toujours servi, nouvelle tentative au passage suivant. Purge au-delà de 90 jours |

> **Ce que la source donne, et ce qu'elle ne donne pas** (vérifié en production
> le 29/07/2026) : l'export publie la semaine en cours avec `previous` et
> `forecast`, mais **jamais `actual`** — 31 événements déjà passés, zéro valeur
> réelle. Les fichiers `ff_calendar_nextweek.json` et `ff_calendar_lastweek.json`
> répondent **404** : seul `thisweek` existe encore, d'où un horizon d'une
> semaine et une seule requête par synchro.
>
> Les valeurs réelles demandent donc **une seconde source** (Trading Economics,
> FMP…). Tout est prêt à les recevoir : `actual` est écrit par un lot séparé et
> jamais mis à null, si bien qu'un second provider peut remplir la colonne sans
> que celui-ci l'écrase au passage suivant.

> **Une fois par jour, et pourquoi ce n'est pas suffisant seul** — le plan
> Vercel du projet (Hobby) n'autorise **qu'un passage de cron par jour** ; un
> `*/15 * * * *` fait échouer le déploiement. Le cron quotidien est donc le
> plancher garanti, et la fraîcheur réelle vient d'un **rafraîchissement
> opportuniste** : la lecture d'une semaine en cours déclenche
> `syncIfStale()` si la dernière tentative date de plus de 10 minutes.
>
> La synchro est **attendue**, et c'est délibéré : une fonction serverless est
> gelée dès la réponse envoyée, donc un `void promise` lancé après coup ne
> s'exécute pas du tout (constaté en production : `last_attempt_at` restait
> `null`). Le coût reste borné — un seul visiteur toutes les 10 minutes
> remporte le créneau et paie l'attente ; tous les autres lisent le cache sans
> rien payer. En échange, celui qui attend lit des données fraîches, la synchro
> précédant la lecture.
>
> La concurrence est réglée par un compare-and-swap sur `last_attempt_at` :
> deux visiteurs simultanés ne déclenchent qu'une seule synchro. Au pire, une
> requête vers la source toutes les 10 minutes, très en dessous de son
> plafond (~2 / 5 min).
>
> **Si le projet passe en Pro**, remplacer le planning par `*/15 * * * *` suffit
> à retrouver une fraîcheur pilotée uniquement par le cron ; le rafraîchissement
> opportuniste devient alors redondant mais reste inoffensif (il ne se
> déclenchera quasiment jamais, le cache ayant toujours moins de 10 min).

**Garde-fous des crons :**
- Authentification par `Authorization: Bearer $CRON_SECRET`. **Sans `CRON_SECRET`
  configuré, la requête est refusée (401)** — un cron ouvert serait un vecteur
  d'abus.
- Client **service-role** (`SUPABASE_SERVICE_ROLE_KEY`) : les crons agissent sur
  tous les utilisateurs, hors RLS. Ce client n'existe **que** dans ces
  handlers.
- **Idempotence e-mail** : `claimEmail()` réserve une ligne dans `email_log`
  avant l'envoi. Un cron rejoué n'envoie jamais deux fois le même e-mail.
- Les rappels d'objectifs sont **best-effort** : leur échec ne fait pas échouer
  la campagne e-mail.

---

## 6. Paiement (infra en place, **dormante**)

### 6.1 Stripe (`billing.server.ts`)

- `handleCheckout` — crée une session Checkout à partir du plan
  (`pro_monthly` / `pro_yearly`) et de l'ID de prix correspondant.
- `handlePortal` — ouvre le portail de gestion d'abonnement.
- `handleStripeWebhook` — **vérifie la signature** (comparaison à temps
  constant via `timingSafeEqualHex`), puis met à jour `subscriptions`.

### 6.2 Coinbase Commerce (`crypto-pay.server.ts`)

Même contrat : création de charge + webhook à signature vérifiée. Les montants
facturés sont alignés sur `src/app/utils/pricing.ts` — **une seule source de
vérité des prix**.

### 6.3 Idempotence des webhooks

Les deux fournisseurs rejouent leurs livraisons. La table
`processed_webhook_events` (clé primaire `(provider, event_id)`) fait du
retraitement un no-op. Écrite exclusivement en service-role, aucune policy
utilisateur.

---

## 7. E-mails (`lifecycle-emails.server.ts`, `email-templates.server.ts`)

- Fournisseur : **Resend** (`RESEND_API_KEY`, expéditeur `EMAIL_FROM`).
- Trois gabarits HTML, **personnalisés depuis le profil d'onboarding** :
  `welcomeEmail`, `trialEndingEmail`, `winbackEmail`.
- L'URL publique vient de `PUBLIC_SITE_URL` (repli sur l'origine de la requête).
- Journalisation et idempotence via `email_log`.

---

## 8. Web-push (`push-crypto.server.ts`, `push.functions.ts`)

Implémentation **maison** de la Web Push, sans dépendance :

- JWT VAPID signé (ES256, WebCrypto).
- Chiffrement de la charge utile conforme **RFC 8291** (`aes128gcm`).
- Envoi séquentiel à toutes les souscriptions ; un `404`/`410` déclenche
  l'élagage de la ligne via le callback `onGone`.
- La **clé publique VAPID est publique par nature** : elle est en dur côté
  client (`usePushNotifications`) et sert de valeur de repli côté serveur.
  **La clé privée (`VAPID_PRIVATE_KEY`) est obligatoire** — sans elle,
  `sendWebPush` lève une erreur explicite.
- Service worker : `public/sw-push.js`.

Le canal push est également piloté depuis le client par le
`NotificationEngine` (anti-spam `dedupKey`, un push par clé et par jour) —
voir [`ARCHITECTURE.md` §5.5](ARCHITECTURE.md).

---

## 9. Text-to-speech (`tts.functions.ts`)

Moitié **optionnelle** de la voix de Jarvis. Deux interrupteurs serveur, tous
deux à sécurité positive :

- pas de `ELEVENLABS_API_KEY` → `available: false`, l'app parle en local ;
- `TTS_PROVIDER=local` → l'hébergé est désactivé même avec une clé.

La voix est **fixe** (une seule identité Jarvis, `modules/voice/profile.ts`) et
parle **toujours anglais**. L'audio revient en data-URL MP3 64 kbps mono,
directement lisible par un `<audio>` — aucun stockage. Détail :
[`JARVIS.md` §7](JARVIS.md).

---

## 10. Dette serveur connue

| Sujet | État | Détail |
| --- | --- | --- |
| **`ai.functions.ts` orphelin** | 🔴 | Les six services (`aiChat`, `aiGenerateDailyBrief`, `aiGenerateWeeklyReview`, `aiAnalyzeTrade`, `aiDetectPatterns`, `aiGenerateLessons`) compilent, sont sécurisés et gatés — mais **aucune surface UI ne les appelle**. Ils portent en plus une **identité de prompt concurrente** de celle de l'agent coach (`COACH_IDENTITY` local vs `coachIdentity()` de `coach.agent.ts`). Deux systèmes de prompt pour une seule identité produit = risque de divergence. |
| **Façade `modules/ai/index.ts`** | 🔴 | Ré-exporte `AI.*` depuis `ai.functions.ts` ; importée par personne. |
| **`.env.example` incomplet** | 🟡 | Corrigé dans cette passe : `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `VAPID_*`, `GEMINI_MODEL`, `TTS_PROVIDER` étaient utilisés par le code sans être documentés. |
| **Aucun test serveur** | 🟡 | Les server functions ne sont pas testées (seule la logique pure l'est : `isEntitled`, coach, fallback). Choix de ROI assumé. |

Décision associée : voir [`ROADMAP.md` §6](ROADMAP.md).

---

## 11. Variables d'environnement

Référence complète : [`.env.example`](.env.example). Toutes sont **server-only**
sauf celles préfixées `VITE_`.

### Supabase

| Variable | Rôle |
| --- | --- |
| `SUPABASE_URL` · `SUPABASE_PUBLISHABLE_KEY` · `SUPABASE_PROJECT_ID` | Accès serveur (client RLS-scopé) |
| `VITE_SUPABASE_URL` · `VITE_SUPABASE_PUBLISHABLE_KEY` · `VITE_SUPABASE_PROJECT_ID` | Accès client (clé publiable uniquement) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret critique** — crons et webhooks uniquement, jamais dans une server function utilisateur |

### IA

| Variable | Rôle |
| --- | --- |
| `AI_PROVIDER` | `gemini` \| `anthropic` \| `openai`. Vide = premier provider configuré |
| `GEMINI_API_KEY` · `GEMINI_MODEL` | Provider par défaut (`gemini-2.5-flash`) |
| `ANTHROPIC_API_KEY` · `ANTHROPIC_MODEL` | Provider tool-capable |
| `OPENAI_API_KEY` · `OPENAI_MODEL` · `OPENAI_BASE_URL` | Provider tool-capable, compatible OpenRouter / Together / Groq / vLLM / Ollama |
| `AI_REQUIRE_PRO` | `"true"` active le paywall IA. **`false` en beta** |
| `AI_RATE_LIMIT_PER_HOUR` | Quota horaire par utilisateur (défaut 60) |

### Voix

| Variable | Rôle |
| --- | --- |
| `ELEVENLABS_API_KEY` | Active la voix hébergée (sinon voix navigateur) |
| `TTS_PROVIDER` | `local` force la voix navigateur même avec une clé |

### Paiement

`STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` · `STRIPE_PRICE_PRO_MONTHLY` ·
`STRIPE_PRICE_PRO_YEARLY` · `COINBASE_COMMERCE_API_KEY` ·
`COINBASE_COMMERCE_WEBHOOK_SECRET`.

### E-mails, crons et push

`RESEND_API_KEY` · `EMAIL_FROM` · `PUBLIC_SITE_URL` · `CRON_SECRET` ·
`VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` · `VAPID_SUBJECT`.

### Public

`VITE_TRUSTPILOT_BUSINESS_UNIT_ID` (zone gelée).

---

## 12. Authentification Google OAuth

> Sujet transverse (code + Supabase + Google Cloud Console). Ce document en est
> le propriétaire. Dernière vérification contre les **logs Auth de production** :
> **2026-07-28**.

### 13.1 Comment le flux marche réellement

```
App (SITE_URL)
  └─ supabase.auth.signInWithOAuth({ provider: "google", redirectTo: SITE_URL })
       └─ GET https://<ref>.supabase.co/auth/v1/authorize?provider=google
            └─ 302 → accounts.google.com   ← c'est ICI que le branding s'affiche
                 └─ 302 → https://<ref>.supabase.co/auth/v1/callback   ← l'URI que Google doit connaître
                      └─ 302 → SITE_URL (doit être dans la liste blanche Supabase)
```

**Point contre-intuitif, essentiel pour la migration** : Google ne redirige
**jamais** vers l'application. Il redirige vers **Supabase**. Le
`redirect_uri` déclaré côté Google est donc
`https://tjikygsipblatubyzbrt.supabase.co/auth/v1/callback` — il **ne change
pas** quand un domaine personnalisé est branché.

### 13.2 Valeurs de configuration

Source unique côté code : [`src/shared/site.ts`](src/shared/site.ts).

**Google Cloud Console → Clients OAuth → Client Web**

| Champ | Valeur |
| --- | --- |
| Authorized JavaScript origins | `https://tradevaultt.vercel.app` |
| Authorized redirect URIs | `https://tjikygsipblatubyzbrt.supabase.co/auth/v1/callback` |

**Google Cloud Console → Branding**

| Champ | Valeur |
| --- | --- |
| App name | `TradeVault` |
| Logo | [`public/branding/google-oauth-logo-120.png`](public/branding/google-oauth-logo-120.png) — 120×120, PNG, 4,6 Ko (carré, < 1 Mo : conforme) |
| User support email | `tradevault@outlook.fr` (constante `SUPPORT_EMAIL`) |
| Application home page | `https://tradevaultt.vercel.app` |
| Privacy policy | `https://tradevaultt.vercel.app/privacy` |
| Terms of service | `https://tradevaultt.vercel.app/terms` |
| Authorized domain | `vercel.app` |
| Developer contact | l'e-mail du propriétaire du projet Google Cloud |

Les trois pages référencées existent et sont servies en SSR par des routes
dédiées (`src/routes/{privacy,terms,contact}.tsx`). L'adresse de support
déclarée ici **doit** rester `SUPPORT_EMAIL` (`src/app/types.ts`) : c'est la
même que celle affichée dans le pied de page, sur les pages légales et sur
`/contact`. Une divergence donne l'impression de deux entreprises différentes
et affaiblit la demande de vérification.

Une **page `/contact` publique** n'est pas exigée par Google, mais elle pèse
dans l'évaluation manuelle lors de la vérification : elle prouve qu'un humain
répond derrière l'application.

**Google Cloud Console → Data access (scopes)**

Uniquement les trois scopes **non sensibles** : `openid`, `.../auth/userinfo.email`,
`.../auth/userinfo.profile`. C'est le défaut de Supabase et le code ne demande
**rien de plus** (aucun `scopes` n'est passé à `signInWithOAuth`). Conséquence
directe : **aucune revue de sécurité Google n'est requise**, et le quota de
100 utilisateurs des apps non vérifiées ne s'applique pas aux scopes basiques.
Ne jamais ajouter Gmail, Drive ou Calendar sans en mesurer le coût : cela
bascule l'app en vérification lourde.

**Google Cloud Console → Audience**

`External`. En mode `Testing`, seuls les Test Users listés peuvent se connecter
et le jeton expire au bout de 7 jours. En `In production` avec des scopes non
sensibles, tout le monde peut se connecter — un écran « Google n'a pas vérifié
cette application » peut apparaître tant que la vérification n'est pas faite,
mais la connexion fonctionne.

**Supabase → Authentication → Providers → Google** : activé, avec le Client ID
et le Client Secret du client Web ci-dessus.

**Supabase → Authentication → URL Configuration**

| Champ | Valeur |
| --- | --- |
| Site URL | `https://tradevaultt.vercel.app` |
| Redirect URLs | `https://tradevaultt.vercel.app/**` |

### 13.3 Panne diagnostiquée le 2026-07-28

Les logs Auth de production sur 24 h montrent une corrélation parfaite :

| Erreur | Occurrences | Origine du flux |
| --- | --- | --- |
| `400: OAuth state not found or expired` | 8 | `tradevault-…-projects.vercel.app` |
| `400: OAuth state parameter missing` | 2 | `tradevault-…-projects.vercel.app` |
| `400: OAuth state has expired` | 2 | `tradevault-…-projects.vercel.app` |
| — *(7 connexions Google réussies)* | 7 | `tradevaultt.vercel.app` |

**Cause** : `redirectTo` valait `window.location.origin`. Un projet Vercel
répond sur plusieurs domaines (alias de production, domaine par défaut du
projet, un domaine par branche de preview). Le vérificateur PKCE est stocké
**par origine** : un flux démarré sur un domaine ne peut pas être terminé sur un
autre. **100 % des échecs venaient du domaine par défaut du projet, 0 % du
domaine canonique.**

**Correctif appliqué** : toutes les redirections d'authentification passent par
`authRedirectTo()` (`src/shared/site.ts`), qui renvoie toujours l'origine
canonique. Effet de bord assumé : une preview renvoie sur la production après
connexion — strictement préférable à l'échec actuel.

> Option si les previews doivent rester connectables : ajouter
> `https://tradevault-*-amineazouzi2009-7012s-projects.vercel.app/**` aux
> Redirect URLs Supabase **et** rendre `authRedirectTo()` conditionnel. Non
> retenu : cela multiplie les URLs à maintenir pour un bénéfice faible.

### 13.4 Migration vers un domaine personnalisé

Le jour où `tradevault.be` est acheté, il y a **cinq** changements — et un seul
dans le code.

| # | Où | Changement |
| --- | --- | --- |
| 1 | **Vercel** | Ajouter le domaine au projet, le passer en domaine de production |
| 2 | **Vercel → Env** | `VITE_SITE_URL=https://tradevault.be`, puis **redéployer** (Vite inline la valeur au build : sans redéploiement, rien ne change) |
| 3 | **Supabase → URL Configuration** | Site URL → `https://tradevault.be` · Redirect URLs → `https://tradevault.be/**` |
| 4 | **Google → Client OAuth** | Authorized JavaScript origins → `https://tradevault.be`. **Ne pas toucher au redirect URI** : il pointe sur Supabase, pas sur l'app |
| 5 | **Google → Branding** | Home page, Privacy, Terms sur le nouveau domaine · Authorized domain → `tradevault.be` (remplace `vercel.app`) |

**Rien d'autre dans le code n'est à modifier** : `src/shared/site.ts` est le
seul fichier qui connaît un domaine. En dérivent automatiquement les URL
canoniques, `og:url`, `og:image`, `robots.txt` et `sitemap.xml` — les pages
publiques (`/`, `/privacy`, `/terms`, `/contact`) suivent sans édition. Penser
aussi à `PUBLIC_SITE_URL` (server-only, e-mails de cycle de vie) et à la CSP de
`vercel.json` si le domaine Supabase change un jour.

**Bonus post-migration** : un domaine personnalisé permet enfin la vérification
Google complète (logo validé, écran « app non vérifiée » supprimé) — impossible
sur `vercel.app`, qui est un domaine partagé que personne ne peut prouver
posséder dans la Search Console.

---

## 13. Checklist de sécurité serveur

| Garde-fou | État | Détail |
| --- | --- | --- |
| Secrets server-only | ✅ | `process.env` dans `backend/` uniquement ; imports dynamiques |
| Auth obligatoire | ✅ | `requireSupabaseAuth` avant tout accès aux données utilisateur |
| Client RLS-scopé | ✅ | Les server functions utilisent le client portant le token de l'appelant |
| Service-role confiné | ✅ | Crons et webhooks seulement |
| Validation d'entrée | ✅ | Zod strict + **caps de taille** sur toutes les entrées IA (question ≤ 500 c, trades ≤ 500, conversation ≤ 20 tours, signaux ≤ 12 Ko) |
| Rate-limit | ✅ | `consume_ai_quota` atomique en SQL, indépendant du paywall |
| Webhooks signés | ✅ | Stripe et Coinbase, comparaison à temps constant |
| Idempotence | ✅ | `processed_webhook_events` (webhooks) et `email_log` (e-mails) |
| Crons authentifiés | ✅ | `CRON_SECRET` obligatoire, 401 sinon |
| En-têtes HTTP | ✅ | CSP stricte, HSTS preload, `frame-ancestors 'none'`, `nosniff`, `Permissions-Policy` |
| Entitlement fail-closed | ⚪ | À basculer au passage payant (aujourd'hui fail-open, beta gratuite) |
| Leaked Password Protection | ⚪ | À activer manuellement dans le dashboard Supabase |
