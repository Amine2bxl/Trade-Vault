# ROADMAP D'EXÉCUTION — TradeVault

> Planning d'exécution sprint par sprint, dérivé du `MASTER_PLAN_TRADEVAULT.md`.
> Basé exclusivement sur les 13 audits.

---

## Sprint 1 — Fondations critiques (semaines 1–2)

Objectif : l'application ne crashe plus, ne perd plus de données, les endpoints sont protégés.

| ID | Tâche | Prio | Diff | Dépend. | Est. | Fichiers |
| --- | --- | --- | --- | --- | --- | --- |
| S1-1 | `getUser()` remplace `getClaims()` | P0 | S | — | 0,25 j | `auth-middleware.ts` |
| S1-2 | Guard SSR sur `localStorage` | P0 | M | — | 0,5 j | `notifications/engine.ts` |
| S1-3 | `emit()` async | P0 | M | — | 0,75 j | `events/bus.ts` |
| S1-4 | Listeners → `init()` explicite | P0 | L | S1-3 | 1,5 j | `notifications/engine.ts`, `automation/engine.ts` |
| S1-5 | `require-pro` fail-closed | P0 | S | — | 0,25 j | `require-pro.ts` |
| S1-6 | Rate limiting IP endpoints | P0 | L | — | 1,5 j | `server.ts`, `rate-limit.server.ts` |
| S1-7 | `try/catch` webhook crypto | P0 | S | — | 0,25 j | `crypto-pay.server.ts` |
| S1-8 | Validateur Zod `push.functions` | P0 | S | — | 0,25 j | `push.functions.ts` |
| S1-9 | Crons exiger `POST` | P1 | S | — | 0,25 j | `server.ts` |

**Livrables** : app stable SSR, auth robuste, bus fiable, endpoints protégés.

---

## Sprint 2 — Intégrité des données & conformité (semaines 3–4)

Objectif : DB reproductible, RGPD conforme, paywall réel.

| ID | Tâche | Prio | Diff | Dépend. | Est. | Fichiers |
| --- | --- | --- | --- | --- | --- | --- |
| S2-1 | FK `trades` avec CASCADE | P0 | M | — | 0,5 j | migration `<new>_fks.sql` |
| S2-2 | Migration `monthly_reports` | P0 | M | — | 0,5 j | migration `<new>_monthly_reports.sql` |
| S2-3 | Bucket `trade-screenshots` | P0 | S | — | 0,25 j | migration `<new>_storage_bucket.sql` |
| S2-4 | Nettoyer migration dupliquée | P0 | M | — | 0,5 j | `migrations/…165855` |
| S2-5 | `delete-account` RGPD complet | P0 | L | S2-1 | 1,5 j | `delete-account/index.ts` |
| S2-6 | Limites Free hard-blocks | P0 | L | S1-5 | 2 j | `require-pro.ts`, endpoints |
| S2-7 | CHECK `trades.direction` | P1 | S | — | 0,25 j | migration `<new>_direction_check.sql` |
| S2-8 | Triggers `updated_at` goals/habits | P1 | M | — | 0,5 j | migration `<new>_updated_at_triggers.sql` |
| S2-9 | Sortir `ai_os_foundation` du scan | P1 | S | — | 0,25 j | `migrations/…160000` |
| S2-10 | `upsertTrade` filtre `user_id` | P1 | S | — | 0,25 j | `store/trades.ts` |

**Livrables** : schéma reproductible, RGPD OK, paywall enforced.

---

## Sprint 3 — Scalabilité & performance (semaines 5–7)

Objectif : tenir >500 utilisateurs, coûts IA maîtrisés, layering respecté.

| ID | Tâche | Prio | Diff | Dépend. | Est. | Fichiers |
| --- | --- | --- | --- | --- | --- | --- |
| S3-1 | Extraire `src/domain/` | P1 | XL | — | 3 j | `modules/**`, `app/types.ts`, `store/ids.ts` |
| S3-2 | Import CSV bulk upsert | P1 | M | — | 0,75 j | `App.tsx`, `store/trades.ts` |
| S3-3 | Pagination `loadUserTrades` | P1 | L | — | 1,5 j | `store/trades.ts`, hooks |
| S3-4 | `select(*)` → colonnes nommées | P1 | M | S3-3 | 0,5 j | `store/*.ts` |
| S3-5 | `Promise.all` dashboard | P1 | S | — | 0,25 j | `Dashboard.tsx` |
| S3-6 | `sendWebPush` parallèle | P1 | S | — | 0,25 j | `push-crypto.server.ts` |
| S3-7 | Cap byte-size contexte IA | P1 | S | — | 0,25 j | `modules/ai/context.ts` |
| S3-8 | Lazy env vars IA + fix Gemini 429 | P1 | M | — | 0,5 j | `modules/ai-provider/*.ts` |
| S3-9 | Helpers dupliqués → `shared/` | P1 | M | — | 0,5 j | `backend/*.server.ts`, `shared/schemas.ts` |
| S3-10 | Zod billing/crypto | P1 | M | S3-9 | 0,5 j | `billing.server.ts`, `crypto-pay.server.ts` |
| S3-11 | Trading rules SSoT | P1 | L | S3-1 | 1,5 j | `useTradingRules.ts`, `App.tsx` |
| S3-12 | State mutable → Context/refs | P1 | M | — | 0,75 j | `store/accounts.ts`, `useScreenshotUrls.ts` |

**Livrables** : perf linéaire, coûts IA bornés, layering propre.

---

## Sprint 4 — Production-readiness (semaines 8–9)

Objectif : observabilité, automatisation, filet de sécurité, conformité UE.

| ID | Tâche | Prio | Diff | Dépend. | Est. | Fichiers |
| --- | --- | --- | --- | --- | --- | --- |
| S4-1 | Logger structuré + `/api/health` | P0 | L | — | 1,5 j | `shared/logger.ts`, `server.ts` |
| S4-2 | CI/CD GitHub Actions | P0 | M | S4-3 | 0,75 j | `.github/workflows/ci.yml` |
| S4-3 | Configurer test runner | P1 | M | — | 0,5 j | `package.json`, `tsconfig.json` |
| S4-4 | Tests engines purs | P1 | L | S4-3, S3-1 | 2 j | `tests/`, `modules/**` |
| S4-5 | Tests store + delete-account | P1 | L | S4-3, S2-5 | 2 j | `tests/` |
| S4-6 | Cookie consent banner | P0 | M | — | 0,75 j | `app/components/`, `__root.tsx` |
| S4-7 | Vérification e-mail + durcir reset | P0 | L | S1-6 | 1,5 j | `AuthContext.tsx`, `reset-password.tsx` |
| S4-8 | Sanitisation prompt-injection | P1 | M | — | 0,75 j | `modules/ai`, `coach.functions.ts` |
| S4-9 | Durcir RLS storage | P1 | M | — | 0,5 j | policies storage, migration |

**Livrables** : déploiement observé, testé, conforme.

---

## Sprint 5 — Différenciation & polish (semaine 10+)

Objectif : valeur perçue (IA proactive), accessibilité, i18n, réduction de dette.

| ID | Tâche | Prio | Diff | Dépend. | Est. | Fichiers |
| --- | --- | --- | --- | --- | --- | --- |
| S5-1 | Décider du sort de l'infra IA type-only | P1 | XL | S3-1 | 3 j | `modules/ai/{infra,router,tools,agents,rag,mcp,jobs,telemetry}` |
| S5-2 | Enregistrer ≥1 agent + tools | P1 | L | S5-1 | 2 j | `catalog.ts`, `registry.ts`, `tools/**` |
| S5-3 | IA proactive (notifications contextuelles) | P1 | L | S5-1, S1-4 | 2 j | `modules/notifications`, `modules/ai` |
| S5-4 | Zoom-lock JS → `touch-action` CSS | P1 | M | — | 0,5 j | `shared/lock-zoom.ts`, `styles.css` |
| S5-5 | Keyboard avoidance + safe-area + a11y | P1 | L | — | 1,5 j | `TradeDetailModal`, `Journal.tsx`, formulaires |
| S5-6 | `lang` dynamique SSR | P2 | S | — | 0,25 j | `__root.tsx` |
| S5-7 | Code-split CSS landing | P1 | M | — | 0,75 j | `styles.css`, `__root.tsx` |
| S5-8 | Image OG 1200×630 | P2 | S | — | 0,25 j | `public/`, `seo.ts` |
| S5-9 | Vendoriser config Vite Lovable | P1 | L | — | 1,5 j | `vite.config.ts`, `package.json` |
| S5-10 | i18n complète (10 langues) | P2 | XL | — | 4 j | `app/**/i18n/**` |
| S5-11 | Nettoyer `console.log` / `as any` | P2 | L | — | 1 j | divers |
| S5-12 | Splitter pages monolithiques | P2 | L | — | 2 j | `Checklist.tsx`, `Landing.tsx`, `Analytics.tsx` |

**Livrables** : IA différenciante, accessibilité, dette réduite.

---

## Récapitulatif

| Sprint | Thème | Charge | Livrable clé |
| --- | --- | --- | --- |
| 1 | Fondations critiques | ~5,75 j | App stable, endpoints protégés |
| 2 | Intégrité données | ~7 j | DB reproductible, RGPD OK, paywall |
| 3 | Scalabilité | ~10,75 j | Perf linéaire, layering propre |
| 4 | Production | ~10,75 j | CI/CD, tests, monitoring, consent |
| 5 | Différenciation | ~18,25 j | IA proactive, a11y, i18n |

**Total : ~52,5 j-homme** → **8–10 semaines** à 1–2 développeurs (cohérent avec le plan d'action des audits).

---

## Règles d'exécution

1. Une PR par tâche, commits atomiques.
2. `bun run lint` (0 erreur) + `bun run build` avant chaque merge.
3. Migrations **additives** uniquement.
4. RLS owner-only sur toute nouvelle table.
5. Aucun secret en dur.
