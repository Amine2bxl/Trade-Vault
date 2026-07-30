# MASTER PLAN — TradeVault

> **Source unique de vérité** : les 13 audits pré-funding (`AUDITS/Audit_00` → `Audit_12` + `Synthese_Audits_00-12`).
> Ce document reflète fidèlement les constats des audits. Aucun recoupement avec le code actuel n'a été effectué.

---

## 1. Vision globale

TradeVault est un **journal de trading avec coach IA** dont la fondation technique présente des risques bloquants avant toute montée en charge ou levée de fonds. Le score global audité est **44,5/100**, avec trois domaines en dessous de 40 (Architecture 36, Performance 36, UX 39). L'objectif du Master Plan est de porter la base technique à un niveau **production-ready** en 8–10 semaines (1–2 développeurs), en traitant d'abord les risques de sécurité, de perte de données et de scalabilité, puis la dette structurelle, enfin la différenciation produit.

---

## 2. État actuel du projet

| Domaine | Score /100 | Verdict |
|---|---|---|
| Repository & Fondation | 59 | Nommage incohérent, build opaque |
| Architecture logicielle | 36 | Violations de layering, side-effects à l'import, Event Bus non fiable |
| Performance | 36 | Requêtes N+1, pas de pagination, payload IA non borné |
| Sécurité | 42 | Fail-open, pas de rate limiting, validation partielle |
| Mobile & Responsive | 56 | Zoom lock bloquant, manque keyboard avoidance |
| Architecture IA | 40 | ~40 % d'infra sans runtime, 0 agent/tool enregistré |
| UX / UI | 39 | Pas de page "About", objectif peu clair, a11y partielle |
| Database & Données | 56 | Manque FK, migration dupliquée, `monthly_reports` sans migration |
| Fonctionnalités | 34 | Limites Free non enforcées, reset password non fonctionnel |
| Production & DevOps | 37 | Zéro monitoring, pas de CI/CD, pas de cookie consent |
| Testing & Qualité | 24 | 0 test runner, 0 test UI/integration, 0 couverture métier |
| Dette technique | 30 | CSS monolithique, pages >1000 lignes, duplication helpers |
| Business & Marché | 60 | Bon positionnement, mais conversion freinée par la dette technique |

**Score global : 44,5/100** — en-dessous du seuil de production recommandé (70+).

---

## 3. Risques bloquants

Les risques suivants peuvent causer une **perte de données**, un **contournement du paywall**, un **crash en production** ou une **non-conformité RGPD** :

| Risque | Source | Impact |
|---|---|---|
| `getClaims()` API non publique Supabase | Audit 01 | Toutes les server functions authentifiées cassent à une MAJ SDK |
| Event Bus `emit()` sans `await` | Audit 01, 05, 11 | Perte silencieuse de traitements de fond |
| `localStorage` au scope handler SSR | Audit 01, 02 | Crash SSR, données orphelines |
| `require-pro` fail-open | Audit 03, 12 | Contournement du paywall |
| Endpoints HTTP sans rate limiting | Audit 01, 03 | Coûts illimités (Stripe/Resend) |
| Webhook crypto `JSON.parse` sans `try/catch` | Audit 01 | 500 en cascade, retries Coinbase, souscription bloquée |
| `trades` sans FOREIGN KEY | Audit 01, 07 | Données orphelines, pas de cascade |
| `delete-account` oublie ~13 tables | Audit 01, 03, 07 | Non-conformité RGPD |
| `monthly_reports` sans migration | Audit 07 | Environnement neuf non reproductible |
| 0 monitoring / 0 CI/CD | Audit 09, 10 | Aveugle en prod, régressions non détectées |

---

## 4. Tâches P0 — Bloquantes avant production

### P0-01 — Remplacer `getClaims()` par `getUser()` dans l'auth middleware
- **Description** : `src/integrations/supabase/auth-middleware.ts:56` utilise `supabase.auth.getClaims()` — API non publique du SDK v2.
- **Pourquoi** : Toute MAJ du SDK peut casser l'authentification de toutes les server functions.
- **Fichiers** : `src/integrations/supabase/auth-middleware.ts`
- **Dépendances** : aucune
- **Estimation** : 0,25 j
- **Critères d'acceptation** : `getUser()` utilisé ; tests d'auth passent ; `bun run build` OK.

### P0-02 — Envelopper `localStorage` dans un guard SSR-safe
- **Description** : `src/modules/notifications/engine.ts:27,42,45,50` lit/écrit `localStorage` au scope handler — crash SSR possible.
- **Pourquoi** : Le module est importé côté serveur ; `localStorage` n'existe pas en SSR.
- **Fichiers** : `src/modules/notifications/engine.ts`
- **Dépendances** : aucune
- **Estimation** : 0,5 j
- **Critères d'acceptation** : `typeof window !== "undefined"` guard sur chaque accès ; build SSR sans erreur.

### P0-03 — Rendre `emit()` du Event Bus async ou queue+flush
- **Description** : `src/modules/events/bus.ts:36-39` appelle `emit()` sans `await` — traitements de fond perdus silencieusement.
- **Pourquoi** : Perte de données sans trace ; cité dans Architecture (01), AI (05) et Dette (11).
- **Fichiers** : `src/modules/events/bus.ts`
- **Dépendances** : aucune
- **Estimation** : 0,75 j
- **Critères d'acceptation** : `emit()` retourne `Promise` ; `await Promise.allSettled` ou queue persistante ; erreurs loggées.

### P0-04 — Déplacer les listeners du scope module vers `init()` explicite
- **Description** : `src/modules/notifications/engine.ts:103-138` et `src/modules/automation/engine.ts:67-111` enregistrent des listeners au chargement du module.
- **Pourquoi** : Duplication HMR, side-effects côté serveur, non tree-shakable.
- **Fichiers** : `src/modules/notifications/engine.ts`, `src/modules/automation/engine.ts`
- **Dépendances** : P0-03 (le bus doit être fiable avant d'y brancher des listeners)
- **Estimation** : 1,5 j
- **Critères d'acceptation** : `init()` appelé explicitement depuis `App.tsx` ; 0 listener enregistré au scope module ; tests passent.

### P0-05 — `require-pro` : fail-closed sur erreur DB
- **Description** : `src/backend/require-pro.ts` laisse passer en cas d'erreur DB (fail-open).
- **Pourquoi** : Contournement du paywall ; citation dans Sécurité (03) et Business (12).
- **Fichiers** : `src/backend/require-pro.ts`
- **Dépendances** : aucune
- **Estimation** : 0,25 j
- **Critères d'acceptation** : erreur DB → rejet par défaut ; tests de gating passent.

### P0-06 — Rate limiting IP sur endpoints HTTP bruts
- **Description** : `src/server.ts` expose billing, crypto, emails, webhook sans rate limiting.
- **Pourquoi** : Flood → coûts Stripe/Resend/Coinbase illimités.
- **Fichiers** : `src/server.ts`, nouveau `src/backend/rate-limit.server.ts`
- **Dépendances** : aucune
- **Estimation** : 1,5 j
- **Critères d'acceptation** : 429 retourné après N requêtes/IP/minute ; tests de flood passent.

### P0-07 — `try/catch` + 400 sur le webhook crypto
- **Description** : `src/backend/crypto-pay.server.ts:90-98` fait `JSON.parse` sans `try/catch`.
- **Pourquoi** : 500 en cascade, retries Coinbase, souscription bloquée.
- **Fichiers** : `src/backend/crypto-pay.server.ts`
- **Dépendances** : aucune
- **Estimation** : 0,25 j
- **Critères d'acceptation** : `try/catch` autour du parse ; 400 retourné sur payload invalide.

### P0-08 — Vrai validateur Zod sur `push.functions`
- **Description** : `src/backend/push.functions.ts:17` utilise une fonction identité comme validateur.
- **Pourquoi** : Injection de données non contrôlées côté serveur.
- **Fichiers** : `src/backend/push.functions.ts`
- **Dépendances** : aucune
- **Estimation** : 0,25 j
- **Critères d'acceptation** : Schéma Zod sur le payload ; 400 si invalide.

### P0-09 — FOREIGN KEY `trades.user_id` + `trades.account_id` avec `ON DELETE CASCADE`
- **Description** : `trades` référence `profiles` et `accounts` sans FK.
- **Pourquoi** : Données orphelines ; pas de suppression en cascade.
- **Fichiers** : `supabase/migrations/<new>_fks.sql`
- **Dépendances** : aucune
- **Estimation** : 0,5 j
- **Critères d'acceptation** : Migration additive ; `ON DELETE CASCADE` ; suppression d'un user efface ses trades.

### P0-10 — Migration additive `monthly_reports`
- **Description** : Table utilisée en production (`store/reports.ts`, cron) mais aucun `create table` dans les migrations.
- **Pourquoi** : Environnement frais ne recrée pas la table.
- **Fichiers** : `supabase/migrations/<new>_monthly_reports.sql`
- **Dépendances** : aucune
- **Estimation** : 0,5 j
- **Critères d'acceptation** : Migration additive reproductible ; colonnes et index documentés dans DATABASE.md.

### P0-11 — `delete-account` Edge Function : couvrir toutes les tables
- **Description** : `supabase/functions/delete-account/index.ts:57-60` oublie ~13 tables.
- **Pourquoi** : Non-conformité RGPD ; données orphelines massives.
- **Fichiers** : `supabase/functions/delete-account/index.ts`
- **Dépendances** : P0-09 (FK en place pour permettre la cascade)
- **Estimation** : 1,5 j
- **Critères d'acceptation** : Toutes les tables du user supprimées ; test d'intégration passe.

### P0-12 — Enforcer les limites Free côté backend
- **Description** : Les limites du plan Free ne sont pas bloquées côté serveur.
- **Pourquoi** : Paywall contournable ; citation dans Fonctionnalités (08) et Business (12).
- **Fichiers** : `src/backend/require-pro.ts`, endpoints concernés
- **Dépendances** : P0-05 (require-pro fiable)
- **Estimation** : 2 j
- **Critères d'acceptation** : Limite trades/jour hard-blockée en DB ; tests de contournement échouent.

### P0-13 — Monitoring : logger structuré + endpoint `/api/health`
- **Description** : Zéro monitoring en production.
- **Pourquoi** : Aveugle en cas d'incident.
- **Fichiers** : `src/shared/logger.ts`, `src/server.ts`
- **Dépendances** : aucune
- **Estimation** : 1,5 j
- **Critères d'acceptation** : JSON logs ; endpoint `/api/health` retourne 200 ; alerte basique configurée.

---

## 5. Tâches P1 — Dette significative

### P1-01 — Extraire le noyau `src/domain/` (cassage des 8 violations de layering)
- **Description** : `modules/notifications/engine.ts`, `modules/ai/memory.ts`, `modules/discipline/*`, `App.tsx:43-46`, `useSubscription.ts:2` violent le sens `modules → app`.
- **Pourquoi** : Architecture non maintenable ; tests impossibles.
- **Fichiers** : `src/modules/**`, `src/app/types.ts`, `src/app/store/ids.ts`, `App.tsx`, `useSubscription.ts`
- **Dépendances** : P0-03, P0-04 (bus et listeners stabilisés)
- **Estimation** : 3 j
- **Critères d'acceptation** : `src/domain/` créé ; 0 import `modules → app` ; `bun run build` OK.

### P1-02 — Import CSV en bulk upsert (fin du N+1)
- **Description** : `src/app/App.tsx:286-333` upsert ligne par ligne.
- **Pourquoi** : Import de 100 trades = 100 requêtes.
- **Fichiers** : `src/app/App.tsx`, `src/app/store/trades.ts`
- **Dépendances** : aucune
- **Estimation** : 0,75 j
- **Critères d'acceptation** : `upsert` batch ; temps d'import <2s pour 100 trades.

### P1-03 — Pagination `loadUserTrades`
- **Description** : `loadUserTrades` charge tous les trades en mémoire.
- **Pourquoi** : Scalabilité ; citation dans Performance (02).
- **Fichiers** : `src/app/store/trades.ts`, hooks consommateurs
- **Dépendances** : P1-01 (store stabilisé)
- **Estimation** : 1,5 j
- **Critères d'acceptation** : Pagination par date ; infinite scroll ou pages ; <500ms par page.

### P1-04 — Remplacer `select(*)` par colonnes nommées
- **Description** : Requêtes `select(*)` sur trades, notifications, reports.
- **Pourquoi** : Réduction du payload réseau.
- **Fichiers** : `src/app/store/trades.ts`, `src/app/store/reports.ts`, notifications
- **Dépendances** : P1-03
- **Estimation** : 0,5 j
- **Critères d'acceptation** : 0 `select(*)` ; payload réduit mesuré.

### P1-05 — Paralléliser les `useEffect` DB du dashboard
- **Description** : `src/app/pages/Dashboard.tsx:95-118` fait 3 requêtes séquentielles.
- **Pourquoi** : Temps de chargement inutilement long.
- **Fichiers** : `src/app/pages/Dashboard.tsx`
- **Dépendances** : aucune
- **Estimation** : 0,25 j
- **Critères d'acceptation** : `Promise.all` ; temps de chargement dashboard <1s.

### P1-06 — `sendWebPush` en `Promise.allSettled`
- **Description** : Envoi séquentiel des push notifications.
- **Pourquoi** : Latence linéaire avec le nombre d'abonnés.
- **Fichiers** : `src/backend/push-crypto.server.ts`
- **Dépendances** : aucune
- **Estimation** : 0,25 j
- **Critères d'acceptation** : Parallélisme ; test de push multi-abonnés <2s.

### P1-07 — Cap byte-size du contexte IA
- **Description** : `src/modules/ai/context.ts:110-111` envoie jusqu'à 500 trades sans cap byte-size.
- **Pourquoi** : Coûts IA et latence non bornés.
- **Fichiers** : `src/modules/ai/context.ts`
- **Dépendances** : aucune
- **Estimation** : 0,25 j
- **Critères d'acceptation** : Cap ~12 KB ; tests avec 500 trades respectent le cap.

### P1-08 — Lecture lazy des env vars IA
- **Description** : `src/modules/ai-provider/{openai,anthropic,gemini}.ts` lisent les clés au scope module.
- **Pourquoi** : Valeurs figées au build ; changement de clé nécessite un redéploiement.
- **Fichiers** : `src/modules/ai-provider/*.ts`
- **Dépendances** : aucune
- **Estimation** : 0,5 j
- **Critères d'acceptation** : Lecture à l'invocation ; rotation de clé sans redéploiement.

### P1-09 — Fix détection erreur Gemini
- **Description** : `src/modules/ai-provider/gemini.ts:51-52` détecte "credits exhausted" sur 402/403 au lieu de 429.
- **Pourquoi** : Retry inutile sur une erreur non récupérable.
- **Fichiers** : `src/modules/ai-provider/gemini.ts`
- **Dépendances** : aucune
- **Estimation** : 0,25 j
- **Critères d'acceptation** : 429 → retry ; 402/403 → fatal ; tests passent.

### P1-10 — Zod sur billing + crypto + déduplication des helpers
- **Description** : `billing.server.ts`, `crypto-pay.server.ts`, `coach.functions.ts:14` vs `ai.functions.ts:19` ont des schémas dupliqués ; pas de Zod sur billing/crypto.
- **Pourquoi** : Validation partielle ; duplication de code.
- **Fichiers** : `src/backend/*.server.ts`, `src/shared/schemas.ts` (nouveau)
- **Dépendances** : P1-01 (noyau extrait)
- **Estimation** : 1 j
- **Critères d'acceptation** : Schémas unifiés ; 0 duplication ; validation stricte.

### P1-11 — Single source of truth pour les trading rules
- **Description** : Window event bus (`tv-rules-updated`) + `useTradingRules.ts` + `App.tsx:158-171` chargent les règles 2×.
- **Pourquoi** : Données désynchronisées ; contournement du layering.
- **Fichiers** : `src/app/hooks/useTradingRules.ts`, `src/app/App.tsx`
- **Dépendances** : P1-01
- **Estimation** : 1,5 j
- **Critères d'acceptation** : Context React unique ; 0 event bus window ; chargement unique.

### P1-12 — State mutable module → Context/refs
- **Description** : `_activeAccountId` (`accounts.ts:18-24`), `urlCache` (`useScreenshotUrls.ts:5`) sont mutables au scope module.
- **Pourquoi** : Risque de fuite d'état entre requêtes SSR.
- **Fichiers** : `src/app/store/accounts.ts`, `src/app/hooks/useScreenshotUrls.ts`
- **Dépendances** : P1-01
- **Estimation** : 0,75 j
- **Critères d'acceptation** : `useRef` ou Context ; 0 mutation au scope module.

### P1-13 — Sortir `ai_os_foundation.sql` du scan migrations
- **Description** : `supabase/migrations/…160000_ai_os_foundation.sql` est scannable mais "not applied".
- **Pourquoi** : Bloque les nouveaux environnements si `pgvector` est off.
- **Fichiers** : `supabase/migrations/…160000_ai_os_foundation.sql`
- **Dépendances** : aucune
- **Estimation** : 0,25 j
- **Critères d'acceptation** : Préfixe `_pending` ou dossier hors migrations ; scan propre.

### P1-14 — CHECK constraint `trades.direction`
- **Description** : `direction` accepte n'importe quelle valeur texte.
- **Pourquoi** : Données corrompues possibles.
- **Fichiers** : `supabase/migrations/<new>_direction_check.sql`
- **Dépendances** : aucune
- **Estimation** : 0,25 j
- **Critères d'acceptation** : `CHECK (direction IN ('long','short','be'))`.

### P1-15 — Triggers `updated_at` sur `goals` et `habits`
- **Description** : Tables sans trigger `updated_at`.
- **Pourquoi** : Dates de modification fausses.
- **Fichiers** : `supabase/migrations/<new>_updated_at_triggers.sql`
- **Dépendances** : aucune
- **Estimation** : 0,5 j
- **Critères d'acceptation** : Trigger sur `goals`, `habits` ; test de mise à jour.

### P1-16 — Crons : exiger `POST` uniquement
- **Description** : `src/server.ts:46-65` accepte toute méthode HTTP.
- **Pourquoi** : `GET` sur un cron = exécution involontaire.
- **Fichiers** : `src/server.ts`
- **Dépendances** : aucune
- **Estimation** : 0,25 j
- **Critères d'acceptation** : 405 sur `GET` ; 200 sur `POST` avec `Authorization: Bearer`.

### P1-17 — Remplacer le zoom-lock JS par `touch-action` CSS
- **Description** : `src/shared/lock-zoom.ts:9-50` bloque le zoom via JS (WCAG 1.4.4).
- **Pourquoi** : Accessibilité bloquante ; citation Mobile (04) et UX (06).
- **Fichiers** : `src/shared/lock-zoom.ts`, `src/styles.css`
- **Dépendances** : aucune
- **Estimation** : 0,5 j
- **Critères d'acceptation** : Zoom fonctionnel sur mobile ; `touch-action: manipulation`.

### P1-18 — Keyboard avoidance + safe-area mobile
- **Description** : Formulaires mobiles et `TradeDetailModal` n'ont pas de gestion du clavier virtuel.
- **Pourquoi** : Champs cachés par le clavier ; citation Mobile (04).
- **Fichiers** : `src/app/components/TradeDetailModal.tsx`, formulaires mobiles
- **Dépendances** : aucune
- **Estimation** : 1,5 j
- **Critères d'acceptation** : `env(safe-area-inset-bottom)` ; scroll automatique vers le champ actif.

### P1-19 — Code-split CSS landing + réduire Google Fonts
- **Description** : `src/styles.css:925-1670` contient ~700 lignes de CSS landing ; 4 Google Fonts chargées globalement.
- **Pourquoi** : Bundle critique gonflé ; citation Architecture (01) et Performance (02).
- **Fichiers** : `src/styles.css`, `src/routes/__root.tsx`
- **Dépendances** : aucune
- **Estimation** : 0,75 j
- **Critères d'acceptation** : CSS landing lazy-loadé ; subset fontes ; Lighthouse perf +5.

### P1-20 — Vendoriser la config Vite Lovable
- **Description** : `vite.config.ts:7` utilise `@lovable.dev/vite-tanstack-config` (SPOF opaque).
- **Pourquoi** : Pas de contrôle sur le build ; non maintenable.
- **Fichiers** : `vite.config.ts`, `package.json`
- **Dépendances** : aucune
- **Estimation** : 1,5 j
- **Critères d'acceptation** : Config Vite maison ; `bun run build` identique ; pas de dépendance Lovable.

### P1-21 — Configurer le test runner
- **Description** : Aucun `test` script dans `package.json` ; `tsconfig.json` n'inclut pas `tests/`.
- **Pourquoi** : Impossible de lancer les tests en CI ; citation Testing (10).
- **Fichiers** : `package.json`, `tsconfig.json`
- **Dépendances** : aucune
- **Estimation** : 0,5 j
- **Critères d'acceptation** : `bun test` passe ; `tsconfig.json` inclut `tests/` ; CI lance les tests.

### P1-22 — Tests unitaires des engines purs
- **Description** : 0 test sur les moteurs de trading, discipline, coach.
- **Pourquoi** : Régressions non détectées ; citation Testing (10).
- **Fichiers** : `tests/`, `src/modules/**`
- **Dépendances** : P1-21, P1-01
- **Estimation** : 2 j
- **Critères d'acceptation** : Couverture >70 % sur `modules/trading/`, `modules/discipline/`, `modules/ai/context.ts`.

### P1-23 — Sanitisation anti-prompt-injection
- **Description** : Aucune sanitisation des entrées utilisateur envoyées à l'IA.
- **Pourquoi** : Risque de manipulation du coach ; citation Sécurité (03) et AI (05).
- **Fichiers** : `src/modules/ai`, `src/backend/coach.functions.ts`
- **Dépendances** : P1-01
- **Estimation** : 0,75 j
- **Critères d'acceptation** : Filtre de prompts suspects ; tests d'injection échouent.

---

## 6. Tâches P2 — Mineur / cosmétique

### P2-01 — `lang` dynamique en SSR
- **Description** : `lang="fr"` codé en dur dans `src/routes/__root.tsx`.
- **Pourquoi** : i18n préparé pour 10 langues mais langue HTML figée.
- **Fichiers** : `src/routes/__root.tsx`
- **Dépendances** : aucune
- **Estimation** : 0,25 j
- **Critères d'acceptation** : `lang` match la langue utilisateur.

### P2-02 — Image OG dédiée 1200×630
- **Description** : `og:image` utilise `icon-512.png` (carré) avec `twitter:card=summary_large_image`.
- **Pourquoi** : Preview Twitter/Facebook sous-optimale.
- **Fichiers** : `public/og-image.png` (nouveau), `src/shared/seo.ts`
- **Dépendances** : aucune
- **Estimation** : 0,25 j
- **Critères d'acceptation** : Image 1200×630 présente ; `og:image` l'utilise.

### P2-03 — Badges `L/S/BE` avec `aria-label`
- **Description** : `src/app/pages/Journal.tsx:358-369` affiche les badges sans alternative textuelle.
- **Pourquoi** : Accessibilité.
- **Fichiers** : `src/app/pages/Journal.tsx`
- **Dépendances** : aucune
- **Estimation** : 0,25 j
- **Critères d'acceptation** : `aria-label="Long"` / `"Short"` / `"Break-even"`.

### P2-04 — Focus-trap sur les modales
- **Description** : `ConfirmContext.tsx` et `AuthModal` sans `aria-modal` ni focus-trap.
- **Pourquoi** : Accessibilité clavier.
- **Fichiers** : `src/app/components/ConfirmContext.tsx`, `src/app/pages/landing/AuthModal.tsx`
- **Dépendances** : aucune
- **Estimation** : 0,5 j
- **Critères d'acceptation** : Tab cyclique dans la modale ; Escape la ferme.

### P2-05 — Retirer `!important` sur styles recharts
- **Description** : `src/styles.css:650-653` utilise `!important`.
- **Pourquoi** : Spécificité non maintenable.
- **Fichiers** : `src/styles.css`
- **Dépendances** : aucune
- **Estimation** : 0,25 j
- **Critères d'acceptation** : 0 `!important` ; charts identiques visuellement.

### P2-06 — Splitter les pages monolithiques
- **Description** : `Checklist.tsx` ~2030 lignes, `Landing.tsx` ~1400 lignes, `Analytics.tsx` ~1100 lignes.
- **Pourquoi** : Maintenabilité ; citation Dette technique (11).
- **Fichiers** : `src/app/pages/Checklist.tsx`, `src/app/pages/Landing.tsx`, `src/app/pages/Analytics.tsx`
- **Dépendances** : aucune
- **Estimation** : 2 j
- **Critères d'acceptation** : Chaque page <400 lignes ; composants extraits ; build OK.

### P2-07 — Nettoyer `console.log` et `as any`/`@ts-ignore`
- **Description** : ~20 fichiers avec `console.log` ; ~14+ avec `as any` ou `@ts-ignore`.
- **Pourquoi** : Hygiène ; citation Testing (10) et Dette (11).
- **Fichiers** : divers
- **Dépendances** : aucune
- **Estimation** : 1 j
- **Critères d'acceptation** : 0 `console.log` en prod ; 0 `as any` sans justification.

### P2-08 — Trustpilot ID + VAPID public key → variables d'environnement
- **Description** : `__root.tsx:65-67` et `push-crypto.server.ts:209-210` hardcodent des identifiants.
- **Pourquoi** : Rotation impossible sans redéploiement.
- **Fichiers** : `src/routes/__root.tsx`, `src/backend/push-crypto.server.ts`, `.env.example`
- **Dépendances** : aucune
- **Estimation** : 0,25 j
- **Critères d'acceptation** : Variables d'env ; fallback explicite.

---

## 7. Dépendances entre les tâches

```
P0-03 (Event Bus async)
  → P0-04 (Listeners init explicite)

P0-05 (require-pro fail-closed)
  → P0-12 (Limites Free enforcées)

P0-09 (FK trades)
  → P0-11 (delete-account RGPD)

P1-01 (Noyau domain)
  → P1-02 (Import CSV bulk)
  → P1-03 (Pagination)
  → P1-10 (Zod unifié)
  → P1-11 (Trading rules SSoT)
  → P1-12 (State mutable)

P1-21 (Test runner)
  → P1-22 (Tests engines)
```

---

## 8. Estimation de l'effort

| Priorité | Nb tâches | Charge totale |
| --- | --- | --- |
| P0 | 13 | ~9 j |
| P1 | 23 | ~17 j |
| P2 | 8 | ~4,5 j |
| | **Total** | **~30,5 j-homme** |

À 1 développeur : **~7 semaines** (compte tenu des dépendances et de la review).
À 2 développeurs en parallèle (1 backend/data, 1 frontend/archi) : **~4 semaines**.

Cohérent avec le plan d'action des audits (8–10 semaines à 1–2 devs, incluant buffer et tests).

---

## 9. Critères de validation globaux

Avant de considérer une tâche comme terminée :

1. **`bun run lint`** : 0 erreur.
2. **`bun run build`** : passe sans warning bloquant.
3. **Migrations additives uniquement** : jamais `DROP TABLE`, `ALTER COLUMN` destructif.
4. **RLS owner-only** : toute nouvelle table a `FOR ALL` sur `authenticated` avec `user_id = auth.uid()`.
5. **Aucun secret en dur** : clés API, tokens, IDs de vérif dans `.env` ou variables Vercel.
6. **Tests verts** : toute PR touchant un moteur pur livre au moins 1 test de non-régression.
