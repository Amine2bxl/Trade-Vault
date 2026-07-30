# MASTER PLAN — TradeVault

> **Objet** : consolidation unique des 13 audits pré-funding (`AUDITS/`, juillet
> 2026) en une liste dédupliquée, priorisée et **recoupée avec l'état réel de
> `main`**. Les audits ont été produits sur un état antérieur aux PR #66→#74 :
> plusieurs de leurs constats sont **déjà résolus**. Ce document distingue donc
> clairement ce qui reste à faire de ce qui est déjà traité.
>
> Découpage exécutable : voir [`ROADMAP_EXECUTION.md`](ROADMAP_EXECUTION.md).
>
> Source brute : `AUDITS/Synthese_Audits_00-12.pdf` + `AUDITS/Audit_01_Architecture.pdf`
> (le plus détaillé, avec fichier:ligne). Score global audité : **44,5/100**
> (Architecture 36, Performance 36, UX 39 en bas de tableau).

---

## 1. Méthode de consolidation

1. **Fusion** des issues des 13 audits par thème (les mêmes problèmes revenaient
   dans plusieurs audits — ex. « fire-and-forget Event Bus » cité dans 01, 05, 11).
2. **Déduplication** : une seule entrée par problème réel, avec tous les audits
   d'origine listés.
3. **Recoupement code** : chaque P0/P1 a été vérifié contre `main` au moment de
   la rédaction. Statut `RÉSOLU` / `VALIDE` / `PARTIEL`.
4. **Priorisation** selon la charte (`CLAUDE.md`) : Sécurité > Perte de données >
   Scalabilité > Conversion > UX > Dette.

### Légende statut

| Statut | Sens |
| --- | --- |
| 🔴 **VALIDE** | Confirmé présent dans `main`, à corriger |
| 🟡 **PARTIEL** | Partiellement mitigé, reste un risque |
| ✅ **RÉSOLU** | Déjà corrigé sur `main` (PR #66→#74) — aucune action |

---

## 2. Déjà résolu depuis les audits (ne PAS replanifier)

Vérifié dans `main` à la rédaction :

| Constat audit | Preuve dans `main` | Statut |
| --- | --- | --- |
| « Pas de SEO, pas de sitemap » (Audit 09/12) | `src/shared/seo.ts`, `src/server.ts` (robots+sitemap générés), canonicals par page | ✅ RÉSOLU |
| « Aucun header CSP/XFO/HSTS » (Audit 01 §9) | `vercel.json` : CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy | ✅ RÉSOLU |
| « `.env` non ignoré » (Quick win Sécurité) | `.gitignore` ignore `.env*`, `.env.example` seul tracké | ✅ RÉSOLU |
| « `SUPABASE_SERVICE_ROLE_KEY` absent de `.env.example` » (Audit 01 §11) | Présent dans `.env.example` | ✅ RÉSOLU |
| « `Trade Tracker Pro` dans les meta » (Audit 01 §12) | Aucune occurrence ; `TradeVault` partout | ✅ RÉSOLU |
| « Pas de routing URL » (Audit 06) | Routes TanStack fichier réelles (`/`, `/privacy`, `/terms`, `/contact`, `/reset-password`) | ✅ RÉSOLU |
| « `package.json` name boilerplate » (Audit 00) | Corrigé en `tradevault` (PR #76) | ✅ RÉSOLU |
| « Rate limit IA absent » | `consume_ai_quota` + `ai_rate_limits` (migration `security_gating`) | ✅ RÉSOLU |

---

## 3. Problèmes CONFIRMÉS sur `main` — dédupliqués et priorisés

### 3.1 🔴 P0 — Bloquants (sécurité, perte de données, crash)

| ID | Problème | Fichier(s):ligne | Impact | Audits | Statut |
| --- | --- | --- | --- | --- | --- |
| P0-1 | `auth-middleware` utilise `getClaims()` — API non publique du SDK Supabase v2 | `src/integrations/supabase/auth-middleware.ts:56` | Toutes les server functions authentifiées cassent à une MAJ SDK | 01 | 🔴 VALIDE |
| P0-2 | `localStorage` au scope handler d'un module importé côté serveur → crash SSR | `src/modules/notifications/engine.ts:27,42,45,50` | Crash SSR possible ; `store/ids.ts` a déjà un guard mais pas ici | 01, 02 | 🟡 PARTIEL |
| P0-3 | Event Bus `emit()` sans `await` — perte de données silencieuse | `src/modules/events/bus.ts:36-39` | Traitements de fond perdus sans trace | 01, 05, 11 | 🔴 VALIDE |
| P0-4 | Listeners enregistrés au scope module (side-effects à l'import) | `src/modules/notifications/engine.ts:103-138`, `src/modules/automation/engine.ts:67-111` | Duplication HMR, listeners côté serveur, non tree-shakable | 01, 11 | 🔴 VALIDE |
| P0-5 | `require-pro` fail-open sur erreur DB (laisse passer sans vérif) | `src/backend/require-pro.ts` | Contournement du paywall | 03, 12 | 🔴 À VÉRIFIER |
| P0-6 | Zéro rate limiting sur endpoints HTTP bruts (billing/crypto/emails/webhook) | `src/server.ts` | Flood → coûts Stripe/Resend illimités | 01, 03 | 🔴 VALIDE |
| P0-7 | Webhook crypto : `JSON.parse` sans try/catch | `src/backend/crypto-pay.server.ts:90-98` | 500, retries Coinbase, souscription bloquée | 01 | 🔴 VALIDE |
| P0-8 | Validateur no-op sur `push.functions` (fonction identité) | `src/backend/push.functions.ts:17` | Injection de données non contrôlées | 01, 03 | 🔴 VALIDE |
| P0-9 | `trades.user_id` / `trades.account_id` sans FOREIGN KEY | `supabase/migrations/…201359` | Données orphelines, pas de cascade | 01, 07 | 🔴 VALIDE |
| P0-10 | Migration dupliquée (profiles/trades sans `IF NOT EXISTS`) | `supabase/migrations/…165855` | Environnement frais non reproductible | 01, 07 | 🔴 À VÉRIFIER |
| P0-11 | `monthly_reports` : table utilisée en prod SANS migration | `store/reports.ts`, cron `monthly-reports` | Environnement frais ne recrée pas la table | (trouvé Phase 5) | 🔴 VALIDE |
| P0-12 | Bucket `trade-screenshots` jamais créé en SQL | migrations storage | Uploads échouent en env frais | 01, 07 | 🔴 À VÉRIFIER |
| P0-13 | `delete-account` Edge Function oublie ~13 tables → RGPD | `supabase/functions/delete-account/index.ts:57-60` | Données orphelines massives, non-conformité RGPD | 01, 03, 07 | 🔴 VALIDE |
| P0-14 | `user-select: none` global bloque la copie de texte | `src/styles.css:325-337` | UX critique pour un outil pro (copier chiffres/notes) | 01 (§6) | 🔴 VALIDE |

### 3.2 🔴 P0 — Bloquants de lancement (business/production)

| ID | Problème | Impact | Audits | Statut |
| --- | --- | --- | --- | --- |
| P0-15 | Limites du plan Free non enforcées côté backend | Paywall contournable, pas de conversion | 09, 12 | 🔴 À VÉRIFIER |
| P0-16 | Zéro monitoring (logs structurés, health check, APM) | Aveugle en production | 09 | 🔴 VALIDE |
| P0-17 | Pas de vérification d'e-mail (email non confirmé = accès complet) | Comptes non vérifiés | 08 | 🔴 À VÉRIFIER |
| P0-18 | Reset de mot de passe non fonctionnel / sans rate limit | Sécurité + fonctionnel | 08, 01 (§9) | 🟡 PARTIEL (`reset-password.tsx` existe) |
| P0-19 | Pas de cookie consent (RGPD) | Non-conformité UE | 09 | 🔴 À VÉRIFIER |
| P0-20 | Pas de CI/CD (lint/build/test/deploy automatisés) | Déploiement manuel, régressions | 09, 10 | 🔴 VALIDE |

### 3.3 🟠 P1 — Dette significative (perf, scalabilité, fiabilité)

| ID | Problème | Fichier(s) | Audits |
| --- | --- | --- | --- |
| P1-1 | 8 violations de layering `modules/backend → app/` | `modules/notifications/engine.ts`, `modules/ai/memory.ts`, `modules/discipline/*`, `App.tsx:43-46`, `useSubscription.ts:2` | 01, 11 |
| P1-2 | Import CSV N+1 (upsert ligne par ligne) | `src/app/App.tsx:286-333` | 01, 02 |
| P1-3 | `loadUserTrades` sans pagination | `src/app/store/trades.ts` | 02 |
| P1-4 | `select(*)` sur trades/notifications/reports | store layer | 02 |
| P1-5 | 3 `useEffect` DB séquentiels (dashboard) | `src/app/pages/Dashboard.tsx:95-118` | 01 |
| P1-6 | `sendWebPush` séquentiel (pas de `Promise.all`) | `src/backend/push-crypto.server.ts` | 02 |
| P1-7 | Payload IA : jusqu'à 500 trades envoyés / pas de cap byte-size | `src/modules/ai/context.ts:110-111` | 02, 05, 01 |
| P1-8 | Env vars IA lues au scope module (stale) | `src/modules/ai-provider/{openai,anthropic,gemini}.ts` | 01 |
| P1-9 | Gemini : détection erronée « credits exhausted » (402/403 au lieu de 429) | `src/modules/ai-provider/gemini.ts:51-52` | 01 |
| P1-10 | Validation Zod absente sur billing/crypto ; schémas dupliqués | `billing.server.ts`, `crypto-pay.server.ts`, `coach.functions.ts:14` vs `ai.functions.ts:19` | 01 |
| P1-11 | Helpers `json()`/`siteUrl()` dupliqués 3×/2× | `billing/lifecycle-emails/crypto-pay.server.ts` | 01 |
| P1-12 | Crons acceptent toute méthode HTTP (devrait exiger POST) | `src/server.ts:46-65` | 01 |
| P1-13 | CHECK constraint absente sur `trades.direction` | migrations trades | 07 |
| P1-14 | Triggers `updated_at` absents sur `goals`/`habits` | migrations goals/engines | 07 |
| P1-15 | `ai_os_foundation.sql` scannable mais « not applied » (bloque si pgvector off) | `supabase/migrations/…160000` | 07 |
| P1-16 | State mutable au scope module (`_activeAccountId`, `urlCache`) | `src/app/store/accounts.ts:18-24`, `useScreenshotUrls.ts:5` | 01, 10 |
| P1-17 | Window event bus (`tv-rules-updated`) contourne React ; règles chargées 2× | `useTradingRules.ts`, `App.tsx:158-171` | 01 |
| P1-18 | Infra IA ~40 % type-only sans runtime (router/tools/agents/RAG/MCP/jobs/telemetry) | `src/modules/ai/{infra,tools,router,agents,rag,mcp,jobs,telemetry}` | 05, 11 |
| P1-19 | IA : 0 tool, 0 agent enregistré, 0 proactivité | `catalog.ts`, `registry.ts` | 05 |
| P1-20 | Zoom lock JS bloque l'accessibilité (WCAG 1.4.4) | `src/shared/lock-zoom.ts:9-50` | 01, 04, 06 |
| P1-21 | Pas de keyboard avoidance / safe-area mobile | `TradeDetailModal`, formulaires mobiles | 04, 06 |
| P1-22 | CSS landing (~700 lignes) + 4 Google Fonts dans le bundle global | `src/styles.css:925-1670`, `__root.tsx` fonts | 01 (§6), 02 |
| P1-23 | Build opaque `@lovable.dev/vite-tanstack-config` (SPOF non maintenable) | `vite.config.ts:7`, `package.json:38` | 01 (§11) |
| P1-24 | Zéro test UI/engines/intégration ; pas de test runner configuré | `package.json` (pas de `test`), `src/app`, `src/modules` | 01 (§10), 10 |
| P1-25 | Prompt injection : aucune sanitisation des entrées vers l'IA | pipeline coach | 03, 05 |
| P1-26 | RLS storage / fuite de fichiers utilisateurs possible | policies storage | 03, 09 |

### 3.4 🟡 P2 — Mineur / cosmétique

| ID | Problème | Fichier | Audits |
| --- | --- | --- | --- |
| P2-1 | `lang="en"` codé en dur en SSR (multi-langue) | `src/routes/__root.tsx` | 01 (§7) |
| P2-2 | Image OG = icône 512² au lieu de 1200×630 | `__root.tsx`, `seo.ts` | 01 (§12), (Phase 4) |
| P2-3 | Badges direction `L/S/BE` sans `aria-label` | `Journal.tsx:358-369` | 01 |
| P2-4 | Modales sans `aria-modal`/focus-trap | `ConfirmContext.tsx` | 01 |
| P2-5 | `!important` sur styles recharts | `styles.css:650-653` | 01 |
| P2-6 | `tsconfig` n'inclut pas `tests/` | `tsconfig.json` | 10 |
| P2-7 | `supabase/config.toml` quasi vide (pas de parité locale) | `supabase/config.toml` | 01 |
| P2-8 | i18n : FR complet (~1023 clés), 10 langues à ~300 | `src/app/…/i18n` | 11 |
| P2-9 | `console.log` (20+ fichiers), `as any`/`@ts-ignore` (14+) | divers | 10, 11 |
| P2-10 | Pages monolithiques (Checklist ~2030 l, Landing ~1400 l, Analytics ~1100 l) | pages | 11 |
| P2-11 | Trustpilot verification ID hardcodé (→ env var) | `__root.tsx:65-67` | 01 (§9) |
| P2-12 | VAPID public key en fallback hardcodé sans warning | `push-crypto.server.ts:209-210` | 01 |

---

## 4. Différenciation business (Audit 12 — Founder)

Priorités produit indépendantes de la dette technique, à intercaler :

1. **Page pricing publique + essai gratuit visible** — conversion (partiellement fait : `pricing.ts` 19,99 €/199 €).
2. **AI Coach proactif** — seule vraie différenciation (P1-19).
3. **SEO + landing internationale** (SEO ✅ fait ; i18n landing P2-8 reste).
4. **Analytics métier** (funnel, activation).
5. **Boucle communautaire / bouche-à-oreille**.

---

## 5. Les 5 priorités absolues avant lancement (issues de la synthèse, recoupées)

1. **Auth & SSR fiables** — P0-1 (`getClaims`), P0-2 (localStorage SSR).
2. **Event Bus sans perte** — P0-3, P0-4.
3. **Sécurité endpoints & paywall** — P0-5, P0-6, P0-7, P0-8, P0-15.
4. **Intégrité DB & RGPD** — P0-9→P0-13 (FK, migrations, bucket, delete-account, `monthly_reports`).
5. **Observabilité & CI/CD** — P0-16, P0-20.

---

## 6. Ce que ce plan NE fait pas

- Il ne recalcule pas les scores des audits (photo au moment de leur rédaction).
- Il ne planifie aucune correction ici : l'exécution est dans
  [`ROADMAP_EXECUTION.md`](ROADMAP_EXECUTION.md), à démarrer **après validation**.
- Les statuts `À VÉRIFIER` demandent une lecture ciblée du fichier avant d'agir
  (l'audit est antérieur à plusieurs PR).
