# TradeVault — Roadmap consolidée & Vision unique

> Fusion des audits (technique, sécurité, performance, architecture IA, produit/UX).
> Doublons supprimés, contradictions tranchées, une seule liste d'actions P0→P3.
> Voir aussi [`PRODUCT-AUDIT.md`](PRODUCT-AUDIT.md) (audit produit détaillé) et
> [`AI-ARCHITECTURE.md`](AI-ARCHITECTURE.md) (fondation AI OS).

## Grille de priorité

| Niveau | Sens |
|---|---|
| **P0** | Bloque la crédibilité ou le lancement. Maintenant. |
| **P1** | Fort ROI, juste après le P0. Ce trimestre. |
| **P2** | Important, non urgent. Quand le cœur tient. |
| **P3** | Fond, dette, « nice to have ». Opportuniste. |

## Déjà livré (session de refactoring)

- Charte d'équipe (`CLAUDE.md`).
- Refactoring Sprints 1–3 partiel : React Query (`useTrades`/`useTradeStats`), découplage.
- Sécurité : RLS owner-only, `consume_ai_quota` + rate-limit, idempotence webhooks Stripe/Coinbase.
- Performance : index composites (prod), split `EquityChart` lazy (−381 KB bundle initial).
- Fondation AI OS (agents/router/tools/rag/jobs/mcp/telemetry) — contrats, zéro runtime (PR #13).
- Gating monétisation neutralisé : `AI_REQUIRE_PRO=false` (tout gratuit en beta, infra prête).
- **P0 #1 — Coach IA conversationnel à mémoire** (PR #14) : `aiChat` + `ai_memory` branchés, fil multi-tours, seed profil.

## Contradictions entre audits — décisions retenues

- **Monétisation** : infra payante conservée, flag OFF. Au lancement, un Free qui *fait goûter* l'IA (quota), jamais un Free sans IA. Pas de paywall tant que la valeur n'est pas prouvée.
- **Sécurité** : fail-open pendant la beta, fail-closed au passage payant.
- **Priorité** : construire l'IA d'abord (fondation posée) ; refactoring 4–6 = fond au fil de l'eau, pas un préalable bloquant.
- **Analytics** : ne plus ajouter de métriques ; ajouter des verdicts en langage clair.

## P0 — Chantiers bloquants

| # | Action | Domaine | Statut |
|---|---|---|---|
| 1 | Coach IA conversationnel à mémoire (`ai_memory`, fil, engagements) | IA | ✅ Fait (PR #14) — reste : fil DB cross-device + mémorisation active des leçons |
| 2 | Insights proactifs (détection pattern → notification) | IA | À faire |
| 3 | Weekly Review + Daily Brief automatiques (in-app + e-mail) | Rétention | À faire |
| 4 | Déclencheurs de retour « push » (pré-market, review, streak) | Rétention | À faire |
| 5 | Import CSV blindé + fallback démo systématique | Activation | À faire |
| 6 | Preuve sociale honnête | Conversion | **Reporté** (avis Trustpilot en cours) |

## P1 — Fort ROI

| # | Action | Domaine |
|---|---|---|
| 7 | « Coût de mes erreurs » chiffré et mensuel | IA |
| 8 | Verdicts IA en clair sur chaque métrique analytics | IA |
| 9 | Bloc « Aujourd'hui » en tête de dashboard | Rétention |
| 10 | Streak de discipline + checklist quotidienne poussée | Rétention |
| 11 | Sync broker / import récurrent auto | Rétention |
| 12 | Réduction navigation à 6–7 entrées | UX |
| 13 | Écran « Ton plan personnalisé » en fin d'onboarding | Activation |
| 14 | ICP resserré (message prop-firm / discipline) | Conversion |
| 15 | Free qui fait goûter l'IA (quota) | Conversion |
| 16 | Agrégats analytics en SQL/RPC + pagination (Sprint 3 inc.3) | Perf |

## P2 — Important, non urgent

| # | Action | Domaine |
|---|---|---|
| 17 | Objectif visible partout + micro-célébrations | Rétention |
| 18 | Rapport mensuel e-mail + carte de perf partageable | Acquisition |
| 19 | Micro-feedback discipline à l'enregistrement d'un trade | UX |
| 20 | Empty states guidés (dashboard, journal) | UX |
| 21 | Coach IA omniprésent (assistant flottant contextuel) | IA |
| 22 | Démo sans compte depuis la landing | Conversion |
| 23 | Bandeau statut beta honnête sur les tarifs | Conversion |
| 24 | Refactoring restant (Sprints 4–6) au fil de l'eau | Tech |
| 25 | Perf secondaire — fonts, images, vendor chunks, prefetch | Perf |

## P3 — Fond & opportuniste

| # | Action | Domaine |
|---|---|---|
| 26 | Activer Leaked Password Protection (dashboard Supabase, manuel) | Sécu |
| 27 | ESLint warn → error progressif | Tech |
| 28 | Systèmes IA ultérieurs (Performance Analyst, Risk Manager, Psychologist, Pattern Finder) | IA |
| 29 | RAG (embeddings) + appliquer migration `ai_os_foundation` | IA |
| 30 | MCP (outils externes) | IA |

## Quick wins (fort impact / faible effort)

- Retirer la fausse preuve (5★ Trustpilot vides) — *reporté, avis en cours*.
- Écran « plan personnalisé » (réutilise le profil déjà collecté).
- Bloc « Aujourd'hui » (assemble des données existantes).
- Verdicts en clair sur analytics (les moteurs fournissent déjà les chiffres).
- Fallback démo à l'échec d'import (option démo déjà présente).
- Empty states guidés (pur front).
- Streak de discipline.

## Chantiers critiques (lourds, incontournables)

- Coach IA à mémoire + conversationnel (P0 #1) — **fait**.
- Moteur d'insights proactifs (P0 #2).
- Weekly Review / Daily Brief automatiques (P0 #3).
- Sync broker (P1 #11).
- Migration analytics vers SQL/RPC (P1 #16).
- Bascule vers le payant (P1 #15).

## À supprimer / rétrograder

- Badge Trustpilot 5★ vide — *à traiter quand les avis seront là*.
- Chiffres maquettés présentés comme réels dans le hero.
- « Appearance » comme entrée de nav distincte → absorber dans Réglages.
- Seasonality & Calculateur en nav de 1ᵉʳ niveau → rétrograder en « Outils ».
- News / Calendrier éco en top-level → sous-menu.
- Métriques analytics purement décoratives (sans verdict).

## À fusionner

- Appearance + Settings + Profile → **Réglages**.
- Insights + AiAssistant → une surface **Coach IA**.
- Mistakes + Missed Opportunities → **Discipline & erreurs**.
- Daily Brief + Weekly Review + Notifications IA → système **coach push** unifié.
- Goals → intégré au Dashboard / Trading Plan.
- Reports → alimenté par la Weekly Review (une seule chaîne de génération).

**Principe** : passer de ~20 destinations à 6–7 (Dashboard · Journal · **Coach IA** · Analytics · Discipline · Plan · Réglages).

## Séquencement recommandé

1. **Lot 1 — Le cœur** : Coach IA vivant (mémoire ✅ + fil ✅) + dégraisser la nav.
2. **Lot 2 — Le rendez-vous** : proactivité + rétention (patterns → notifs, Daily Brief, Weekly Review, streak, bloc « Aujourd'hui »).
3. **Lot 3 — La preuve** : valeur tangible + confiance (coût des erreurs, verdicts analytics, plan personnalisé).
4. **Lot 4 — Le go-to-market** : bascule commerciale (Free hameçon, fail-closed, ICP, sync broker, démo sans compte).
5. **Lot 5 — Le fond** : scale & systèmes IA suivants (analytics SQL, refactoring 4–6, RAG, agents).

> **En une phrase** : le socle est sain et la coque est la meilleure du marché ; il manque l'âme. Un coach qui se souvient, un produit qui vient à toi, une valeur chiffrée et prouvée — et « 25 €/mois » cesse d'être une question.
