# ROADMAP D'EXÉCUTION — TradeVault

> Découpage opérationnel du [`MASTER_PLAN_TRADEVAULT.md`](MASTER_PLAN_TRADEVAULT.md)
> en **5 sprints**. Chaque tâche porte : **priorité**, **difficulté**,
> **dépendances**, **estimation**, **fichiers concernés**.
>
> ⚠️ **À NE PAS DÉMARRER avant validation.** Ce document prépare le travail ; il
> ne l'exécute pas. Les items `À VÉRIFIER` du Master Plan exigent une relecture
> du fichier concerné avant correction (les audits sont antérieurs aux PR #66→#74).
>
> **Conventions.** Difficulté : S (≤2 h), M (½–1 j), L (2–3 j), XL (>3 j).
> Estimation en jours-homme (j). Une tâche = une PR dédiée (jamais de commit
> multi-sujets). `bun run lint` + `bun run build` verts avant chaque merge.

---

## Séquencement & principe directeur

Ordre imposé par les dépendances et la charte (sécurité/perte de données
d'abord, différenciation ensuite) :

```
Sprint 1  Stop-the-bleeding : SSR, auth, Event Bus, sécurité endpoints
Sprint 2  Intégrité données & conformité : DB, migrations, RGPD, paywall
Sprint 3  Scalabilité & perf : N+1, pagination, payload IA, layering
Sprint 4  Production-readiness : monitoring, CI/CD, tests, cookie consent
Sprint 5  Différenciation & polish : IA proactive, a11y, i18n, dette
```

---

## SPRINT 1 — Fondations critiques (stop-the-bleeding)

Objectif : plus aucun crash, plus aucune perte de données silencieuse, endpoints
non exploitables. **Aucune dépendance amont — démarrable immédiatement.**

| # | Tâche | Prio | Diff | Dépend. | Est. | Fichiers |
| --- | --- | --- | --- | --- | --- | --- |
| S1-1 | Remplacer `getClaims()` par `getUser()` dans l'auth middleware | P0 | S | — | 0,25 j | `src/integrations/supabase/auth-middleware.ts:56` |
| S1-2 | Envelopper tous les accès `localStorage` (SSR-safe) + injecter la langue par paramètre | P0 | M | — | 0,5 j | `src/modules/notifications/engine.ts:27,42,45,50` |
| S1-3 | Rendre `emit()` async (`await Promise.allSettled`) ou queue+flush ; erreurs loggées | P0 | M | — | 0,75 j | `src/modules/events/bus.ts:36-39` |
| S1-4 | Déplacer les listeners du scope module vers un `init()`/`configure()` explicite | P0 | L | S1-3 | 1,5 j | `src/modules/notifications/engine.ts:103-138`, `src/modules/automation/engine.ts:67-111`, point d'init dans `src/app` |
| S1-5 | `require-pro` → fail-closed (rejeter par défaut si erreur DB) *(vérifier l'état actuel)* | P0 | S | — | 0,25 j | `src/backend/require-pro.ts` |
| S1-6 | Rate limiting IP sur endpoints HTTP bruts (billing/crypto/emails/webhook) | P0 | L | — | 1,5 j | `src/server.ts`, nouveau `src/backend/rate-limit.server.ts` |
| S1-7 | `try/catch` + 400 sur le webhook crypto | P0 | S | — | 0,25 j | `src/backend/crypto-pay.server.ts:90-98` |
| S1-8 | Vrai validateur Zod sur `push.functions` (remplacer l'identité) | P0 | S | — | 0,25 j | `src/backend/push.functions.ts:17` |
| S1-9 | Crons : exiger `POST` uniquement | P1 | S | — | 0,25 j | `src/server.ts:46-65` |

**Total Sprint 1 ≈ 5,75 j.** Sortie : app qui ne crashe pas en SSR, auth robuste, bus fiable, endpoints protégés.

---

## SPRINT 2 — Intégrité des données & conformité

Objectif : environnement reproductible, RGPD conforme, paywall réel. **Dépend de
Sprint 1 pour la stabilité, mais les migrations sont indépendantes.**

| # | Tâche | Prio | Diff | Dépend. | Est. | Fichiers |
| --- | --- | --- | --- | --- | --- | --- |
| S2-1 | Migration additive : FK `trades.user_id` + `trades.account_id` `ON DELETE CASCADE` | P0 | M | — | 0,5 j | `supabase/migrations/<new>_fks.sql` |
| S2-2 | Migration `monthly_reports` (table utilisée sans migration) | P0 | M | — | 0,5 j | `supabase/migrations/<new>_monthly_reports.sql` |
| S2-3 | Migration bucket `trade-screenshots` (`INSERT … ON CONFLICT DO NOTHING`) *(vérifier)* | P0 | S | — | 0,25 j | `supabase/migrations/<new>_storage_bucket.sql` |
| S2-4 | Supprimer/neutraliser la migration dupliquée profiles/trades *(vérifier)* | P0 | M | — | 0,5 j | `supabase/migrations/…165855` |
| S2-5 | `delete-account` : couvrir les ~13 tables manquantes (RGPD) | P0 | L | S2-1 | 1,5 j | `supabase/functions/delete-account/index.ts:57-60` |
| S2-6 | Enforcer les limites Free côté backend (hard blocks) *(vérifier)* | P0 | L | S1-5 | 2 j | `src/backend/require-pro.ts`, endpoints concernés |
| S2-7 | CHECK constraint `trades.direction IN ('long','short','be')` | P1 | S | — | 0,25 j | `supabase/migrations/<new>_direction_check.sql` |
| S2-8 | Triggers `updated_at` sur `goals`/`habits` (+ colonne manquante) | P1 | M | — | 0,5 j | `supabase/migrations/<new>_updated_at_triggers.sql` |
| S2-9 | Sortir `ai_os_foundation.sql` du scan (préfixe `_pending` ou dossier hors migrations) | P1 | S | — | 0,25 j | `supabase/migrations/…160000_ai_os_foundation.sql` |
| S2-10 | `upsertTrade` : filtrer par `user_id` + confirmer RLS | P1 | S | — | 0,25 j | `src/app/store/trades.ts:98-101` |

**Total Sprint 2 ≈ 7 j.** Sortie : DB reproductible, RGPD OK, paywall enforced. *Toutes les migrations sont additives (charte).* 

---

## SPRINT 3 — Scalabilité & performance

Objectif : tenir >500 utilisateurs, coûts IA maîtrisés, layering respecté.
**Dépend de Sprint 2 (schéma stable) pour les requêtes.**

| # | Tâche | Prio | Diff | Dépend. | Est. | Fichiers |
| --- | --- | --- | --- | --- | --- | --- |
| S3-1 | Extraire le noyau `src/domain/` (Trade, TradingRule, `generateId`, `checkTradeAgainstRules`) pour casser les 8 violations de layering | P1 | XL | — | 3 j | `src/modules/**`, `src/app/types.ts`, `src/app/store/ids.ts`, `App.tsx:43-46`, `useSubscription.ts:2` |
| S3-2 | Import CSV en bulk upsert (fin du N+1) | P1 | M | — | 0,75 j | `src/app/App.tsx:286-333`, `src/app/store/trades.ts` |
| S3-3 | Pagination `loadUserTrades` | P1 | L | — | 1,5 j | `src/app/store/trades.ts`, hooks consommateurs |
| S3-4 | Remplacer `select(*)` par colonnes nommées | P1 | M | S3-3 | 0,5 j | `store/trades.ts`, `store/reports.ts`, notifications |
| S3-5 | Paralléliser les 3 `useEffect` DB du dashboard (`Promise.all`) | P1 | S | — | 0,25 j | `src/app/pages/Dashboard.tsx:95-118` |
| S3-6 | `sendWebPush` en `Promise.allSettled` | P1 | S | — | 0,25 j | `src/backend/push-crypto.server.ts` |
| S3-7 | Cap byte-size du contexte IA (~12 KB) au lieu du count | P1 | S | — | 0,25 j | `src/modules/ai/context.ts:110-111` |
| S3-8 | Lecture lazy des env vars IA + fix détection Gemini 429 | P1 | M | — | 0,5 j | `src/modules/ai-provider/{openai,anthropic,gemini}.ts` |
| S3-9 | Extraire helpers dupliqués (`json()`, `siteUrl()`, `TradeSummary`) dans `shared/` | P1 | M | — | 0,5 j | `src/backend/*.server.ts`, `coach.functions.ts:14`, `ai.functions.ts:19`, nouveau `src/shared/{response,schemas}.ts` |
| S3-10 | Zod sur endpoints billing/crypto | P1 | M | S3-9 | 0,5 j | `billing.server.ts`, `crypto-pay.server.ts` |
| S3-11 | Single source of truth pour les trading rules (contexte React, retirer window events) | P1 | L | S3-1 | 1,5 j | `useTradingRules.ts`, `App.tsx:158-171` |
| S3-12 | Remplacer state mutable module (`_activeAccountId`, `urlCache`) par Context/refs | P1 | M | — | 0,75 j | `src/app/store/accounts.ts:18-24`, `useScreenshotUrls.ts:5` |

**Total Sprint 3 ≈ 10,75 j.** Sortie : perf linéaire, coûts IA bornés, layering propre.

---

## SPRINT 4 — Production-readiness

Objectif : observabilité, automatisation, filet de sécurité, conformité UE.
**S4-2 (CI/CD) dépend de S4-3 (test runner) pour être utile.**

| # | Tâche | Prio | Diff | Dépend. | Est. | Fichiers |
| --- | --- | --- | --- | --- | --- | --- |
| S4-1 | Monitoring : logger structuré + endpoint `/api/health` | P0 | L | — | 1,5 j | nouveau `src/shared/logger.ts`, `src/server.ts` |
| S4-2 | CI/CD GitHub Actions (lint + build + test + preview) | P0 | M | S4-3 | 0,75 j | `.github/workflows/ci.yml` |
| S4-3 | Configurer le test runner (`bun:test` ou Vitest) + script `test` + inclure `tests/` dans tsconfig | P1 | M | — | 0,5 j | `package.json`, `tsconfig.json` |
| S4-4 | Tests unitaires des engines purs (trading/analysis, discipline) | P1 | L | S4-3, S3-1 | 2 j | `src/modules/**`, `tests/**` |
| S4-5 | Tests store layer (Supabase mické) + 1 test d'intégration delete-account | P1 | L | S4-3, S2-5 | 2 j | `tests/**` |
| S4-6 | Cookie consent banner (RGPD) | P0 | M | — | 0,75 j | nouveau composant `src/app/components`, `__root.tsx` |
| S4-7 | Vérification d'e-mail + durcir reset password (rate limit) | P0 | L | S1-6 | 1,5 j | `AuthContext.tsx`, `reset-password.tsx`, config Supabase |
| S4-8 | Sanitisation anti-prompt-injection des entrées IA | P1 | M | — | 0,75 j | pipeline coach (`src/modules/ai`, `src/backend/coach.functions.ts`) |
| S4-9 | Durcir RLS storage (anti-fuite fichiers) | P1 | M | — | 0,5 j | policies storage, migration |

**Total Sprint 4 ≈ 10,75 j.** Sortie : déploiement observé, testé, conforme.

---

## SPRINT 5 — Différenciation & polish

Objectif : la valeur perçue (IA proactive), accessibilité, i18n, réduction de dette.

| # | Tâche | Prio | Diff | Dépend. | Est. | Fichiers |
| --- | --- | --- | --- | --- | --- | --- |
| S5-1 | Décider le sort de l'infra IA type-only : brancher `modules/ai` OU réduire à un design doc | P1 | XL | S3-1 | 3 j | `src/modules/ai/{infra,router,tools,agents,rag,mcp,jobs,telemetry}`, `backend/coach.functions.ts` |
| S5-2 | Enregistrer ≥1 agent + les tools déclarés (au moins des stubs) | P1 | L | S5-1 | 2 j | `catalog.ts`, `registry.ts`, `tools/**` |
| S5-3 | IA proactive (notifications contextuelles depuis les events) | P1 | L | S5-1, S1-4 | 2 j | `modules/notifications`, `modules/ai` |
| S5-4 | Remplacer le zoom-lock JS par `touch-action` CSS (ou option préférence) | P1 | M | — | 0,5 j | `src/shared/lock-zoom.ts:9-50` |
| S5-5 | a11y : keyboard avoidance mobile, safe-area, `aria-label` badges, focus-trap modales | P1 | L | — | 1,5 j | `TradeDetailModal`, `Journal.tsx:358-369`, `ConfirmContext.tsx`, formulaires |
| S5-6 | `lang` dynamique en SSR | P2 | S | — | 0,25 j | `src/routes/__root.tsx` |
| S5-7 | Code-split CSS landing + réduire les Google Fonts | P1 | M | — | 0,75 j | `src/styles.css:925-1670`, `__root.tsx` |
| S5-8 | Image OG 1200×630 dédiée | P2 | S | — | 0,25 j | `public/`, `src/shared/seo.ts` |
| S5-9 | Vendoriser / documenter la config Vite Lovable (retirer le SPOF) | P1 | L | — | 1,5 j | `vite.config.ts`, `package.json:38` |
| S5-10 | i18n : compléter les ~7000 traductions manquantes (10 langues) | P2 | XL | — | 4 j | `src/app/**/i18n/**` |
| S5-11 | Hygiène : retirer `console.log`, `as any`/`@ts-ignore`, splitter pages monolithiques | P2 | L | — | 2 j | divers (`Checklist`, `Landing`, `Analytics`, …) |
| S5-12 | Trustpilot ID + VAPID public key → variables d'environnement | P2 | S | — | 0,25 j | `__root.tsx:65-67`, `push-crypto.server.ts:209-210` |

**Total Sprint 5 ≈ 18,25 j** (S5-10 i18n domine — parallélisable/externalisable).

---

## Récapitulatif charge

| Sprint | Thème | Charge (j) |
| --- | --- | --- |
| 1 | Fondations critiques | ~5,75 |
| 2 | Intégrité données & conformité | ~7 |
| 3 | Scalabilité & perf | ~10,75 |
| 4 | Production-readiness | ~10,75 |
| 5 | Différenciation & polish | ~18,25 |
| | **Total** | **~52,5 j-homme** |

À 2-3 développeurs en parallèle : **~8 à 10 semaines**, cohérent avec le plan
d'action des audits.

---

## Règles d'exécution (rappel charte)

1. Une PR par tâche, commits atomiques, message conforme au style du dépôt.
2. `bun run lint` (0 erreur) + `bun run build` verts **avant chaque merge**.
3. Migrations **additives** uniquement (jamais casser table/donnée existante).
4. Vérifier RLS owner-only et absence de secret sur toute PR touchant données/auth.
5. Les items `À VÉRIFIER` : relire le fichier ciblé avant de coder (audits datés).
