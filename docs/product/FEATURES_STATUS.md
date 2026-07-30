# TradeVault — État des fonctionnalités

> **Document propriétaire de l'état vivant du produit.** Ce qui est livré, ce
> qui est partiel, ce qui est prévu — **vérifié contre le code**, pas contre
> l'intention.
>
> Les priorités et le séquencement vivent dans [`ROADMAP.md`](ROADMAP.md)
> (les numéros `#n` y renvoient). Le contexte produit est dans
> [`PRODUCT.md`](PRODUCT.md).
>
> **Statuts** : ✅ Livré et branché · 🟡 Partiel · 🟠 Écrit mais **non branché**
> (existe, compile, n'est appelé par aucune surface) · ⚪ Prévu.
>
> Dernière vérification : **2026-07-28** (base `ce7fde6`).

---

## 1. Livré ✅

### 1.1 Cœur trading

| Fonctionnalité | Statut | Détail |
| --- | --- | --- |
| **Journal de trades** | ✅ | CRUD complet : stratégie (dont setups ICT), confluences, erreurs, qualité de setup 1–5, confiance, notes, R-multiple, captures d'écran (Supabase Storage), champs quant `mae`/`mfe`/`slippage`. **Optimistic UI avec rollback** |
| **Sous-comptes** | ✅ | Table `accounts` (type, devise, couleur, solde de départ) + `account_id` sur les trades ; commutateur global, FAB mobile ; cache React Query keyé par compte |
| **Import CSV** | ✅ | `ImportCsvModal` + **backfill automatique** des rapports mensuels manquants (in-app uniquement). Blindage et fallback démo → ⚪ (#5) |
| **Dashboard** | ✅ | Edge Score (dial 0–100), règle du jour, checklist du jour, objectif mensuel, KPI, courbe d'équité (lazy) |
| **Analytics** | ✅ | Win rate, profit factor, expectancy, drawdown, Sharpe/Sortino, par symbole / jour / stratégie / session / heure, matrice jour×heure |
| **Calendrier P&L** | ✅ | Vue mensuelle des performances quotidiennes |
| **Saisonnalité** | ✅ | Saisonnalité par instrument et par mois |
| **Erreurs récurrentes** | ✅ | `mistakeStats` — occurrences + P&L net par erreur, issus du moteur déterministe |
| **Setups manqués** | ✅ | Journal des occasions non prises (raison, ce qui s'est passé, leçon, plan) + modale de détail |
| **Objectifs & plan 6 mois** | ✅ | `six_month_goals`, `goal_plans`, tâches par mois, rappels hebdomadaires (cron du lundi) |
| **Plan de trading** | ✅ | Plan écrit structuré (setups, risque, horaires) persisté en JSON sur le profil |
| **Calculateur de position** | ✅ | Futures (`POINT_VALUES`) et forex (`calcForexLots`) |
| **Actualités économiques** | ✅ | Calendrier de la semaine, filtres devise/impact, heure locale |
| **Rapports mensuels** | ✅ | Génération automatique (cron du 1er) + à la demande, e-mail + push avec deep-link |
| **Export CSV** | ✅ | `exportTradesCSV` |

### 1.2 Discipline

| Fonctionnalité | Statut | Détail |
| --- | --- | --- |
| **Checklist pré-market** | ✅ | Native au Design System, 5 étapes (Préparation → Validation → Mental → Verrouillage → Trade), verrouillage de session, narration vocale Jarvis, pop-up « Demander à Jarvis » |
| **Checklist adaptative** | ✅ | `ChecklistWizard` — checklist générée depuis le profil du trader |
| **Règles personnelles** | ✅ | Éditées dans le profil (`profiles.trading_rules`), **vérifiées automatiquement à chaque trade enregistré** par le Discipline Engine |
| **Edge Score** | ✅ | Score 0–100 déterministe sur 10 jours tradés : plan (35 %), risque (25 %), jours propres (25 %), routine (15 %). **Le P&L n'entre pas dans le calcul** ; toute composante non mesurable est retirée et les poids renormalisés |
| **Signaux comportementaux** | ✅ | `computeBehaviorSignals` : edge par jour/session/symbole/stratégie, **dérive de taille après une perte**, coût de l'overtrading, fiabilité du grading du trader |
| **Analyse de trade** | ✅ | Moteur pur : 4 sous-scores + composite + note A–F + 11 flags stables (`revenge_window`, `oversized_risk`, `overtrading_day`…) |

### 1.3 IA — Jarvis

| Fonctionnalité | Statut | Détail |
| --- | --- | --- |
| **Identité unique Jarvis** | ✅ | Une seule IA sur toutes les surfaces (page, widget, checklist, voix). Plus de « AI Coach » / « Assistant » / « Insights » parallèles |
| **Coach conversationnel ancré** | ✅ | `askCoach` : stats précalculées + trades + erreurs + **signaux comportementaux** + règles + profil d'onboarding + fil de conversation. Règle `ANTI_HALLUCINATION` |
| **Briefing du jour** | ✅ | **Déterministe, coût IA nul** — priorité du jour, forces, faiblesse dominante, lus dans les données |
| **Fallback déterministe** | ✅ | Sans provider configuré ou en cas d'échec, réponse construite depuis le **même payload**, mêmes garanties (`source: "deterministic"`) |
| **Voix Jarvis** | ✅ | Locale par défaut (Web Speech, sélection déterministe de la meilleure voix masculine EN, prosodie à pauses), hébergée ElevenLabs en option. **Toujours en anglais** |
| **Providers multi-modèles** | ✅ | Gemini (défaut) / Anthropic / OpenAI-compatible. Changer de modèle = `AI_PROVIDER` |
| **Infra plateforme IA** | ✅ | Provider Service (retry + hook `onUsage`), Context Builder capé, Prompt Builder sans persona câblée, Response Formatter, boucle de tool-calling — **testés** (`aiInfra`, `coach`, `fallbackCoach`) |
| **Mémoire IA — schéma & seed** | ✅ | Table `ai_memory` (RLS owner-only) + `seedProfileMemory()` idempotent à l'onboarding |
| **Sécurité IA** | ✅ | Auth obligatoire, Zod + caps, `consume_ai_quota` (60/h atomique), secrets serveur-only |

### 1.4 Plateforme, croissance et design

| Fonctionnalité | Statut | Détail |
| --- | --- | --- |
| **Auth Supabase** | ✅ | Signup / login / reset password |
| **Onboarding 6 étapes** | ✅ | Langue → bienvenue → profil → préférences → **notifications** → démarrage (import / démo / manuel) |
| **i18n 12 langues** | ✅ | `en` (source), `es`, `pt`, `fr`, `de`, `it`, `nl`, `ru`, `zh`, `ja`, `ar`, `hi` — dictionnaires non anglais code-split |
| **PWA + web-push** | ✅ | Manifest, service worker, VAPID maison (RFC 8291), opt-in à l'onboarding, élagage des souscriptions mortes |
| **Notification Engine** | ✅ | Canaux toast / dashboard / push / e-mail, anti-spam `dedupKey` (1 push/clé/jour), câblage domaine en un seul endroit |
| **Command Palette ⌘K** | ✅ | Navigation, actions rapides, recherche de trades — dérivée de `navigation.ts` |
| **Navigation centralisée** | ✅ | Source unique `navigation.ts` → Sidebar + MobileNav + Palette |
| **Thèmes** | ✅ | Moteur de thème avec rampes oklch générées, accents themeable à chaud |
| **Abonnement (statut)** | ✅ | Page statut seul (plan · essai · jours restants) ; ni prix ni logique Stripe dans le Profil |
| **Infra de paiement** | ✅ (dormante) | Stripe (checkout, portail, webhook signé) + Coinbase Commerce, idempotence `processed_webhook_events` |
| **E-mails de cycle de vie** | ✅ | Bienvenue, fin d'essai (J-2), winback (J+3 à J+10), idempotents via `email_log` |
| **Landing + pages publiques** | ✅ | Landing de conversion (hero, problème, IA, fonctionnalités, tarifs, FAQ, CTA) + `/privacy`, `/terms`, `/contact` — bilingues, responsive, sommaire, RTL |
| **SEO public** | ✅ | `pageSeo()` : canonical absolu, Open Graph + Twitter Card complets, `robots` par page ; `robots.txt` et `sitemap.xml` générés depuis `SITE_URL` ; previews en `noindex` |
| **Trustpilot** | ✅ | ⚠️ **Zone gelée** — ne jamais toucher |
| **Design System `shared/ui`** | ✅ | Typography, Button, Input/Field, Card, Table, Modal accessible, Badge, Chip, PageHeader, EmptyState, Metric, Chart, tokens |
| **Résilience** | ✅ | `PageErrorBoundary` par page, écrans 404/500, normalisation des erreurs SSR, skeletons contextuels |
| **Suppression de compte (RGPD)** | ✅ | Edge function `delete-account` — fichiers + données + compte auth |
| **Sécurité socle** | ✅ | RLS owner-only partout, index composites, `SECURITY DEFINER` verrouillées, CSP/HSTS |

---

## 2. Partiel 🟡

| Fonctionnalité | Statut | Ce qui manque |
| --- | --- | --- |
| **Réduction de la navigation** (#11) | 🟡 | Socle livré (source unique, 6 groupes par déroulé de session). **18 destinations restent** : fusions Réglages / Discipline / Outils à faire |
| **Adoption du Design System** | 🟡 | **28 / 56** fichiers `.tsx` de `app/` importent `@/shared/ui`. Non adoptés : Landing, Sidebar, MobileNav, CommandPalette, AiAssistant, TradeDetailModal, EquityChart, Onboarding |
| **Dette typographique et couleur** | 🟡 | 413 `text-[Npx]` (dont 19 sous 10 px), 216 `emerald-*`, 228 `red-*`, ~90 hex dans le JSX |
| **Internationalisation** | 🟡 | L'app est en 12 langues ; **la landing est en français codé en dur** (#16) |
| **Durcissement ESLint** | 🟡 | `no-unused-vars` et `no-explicit-any` en `warn` assumé |
| **Couverture de tests** | 🟡 | 76 tests sur les fonctions pures ; aucun test serveur ni composant |

---

## 3. Écrit mais non branché 🟠

> Ces éléments **existent, compilent et sont pour partie testés**, mais
> **aucune surface UI ne les appelle**. C'est une fondation délibérée — la
> distinguer du livré est essentiel pour ne pas surestimer l'état du produit.

| Élément | Fichier | Nature |
| --- | --- | --- |
| **Catalogue de services IA** | `backend/ai.functions.ts` | `aiChat`, `aiGenerateDailyBrief`, `aiGenerateWeeklyReview`, `aiAnalyzeTrade`, `aiDetectPatterns`, `aiGenerateLessons` — sécurisés et gatés, jamais appelés. Portent une **identité de prompt concurrente** (dette D1/D2) |
| **Façade `AI.*`** | `modules/ai/index.ts` | Importée par personne (dette D3) |
| **AI Router** | `modules/ai/router/` | `defaultRouter` + `INTENT_AGENT` testés, non branchés |
| **Agent System** | `modules/ai/agents/registry.ts` | Registry **vide** au runtime ; les 5 agents du catalogue sont des blueprints déclaratifs |
| **Tool Calling** | `modules/ai/tools/` | Registre **vide** ; `runWithTools` testé mais jamais exécuté en production |
| **Télémétrie IA** | `modules/ai/telemetry.ts` | `AgentRun` + contrat de recorder ; **aucun writer** vers `ai_agent_runs` |
| **RAG / Jobs / MCP** | `modules/ai/{rag,jobs,mcp}/types.ts` | Contrats seuls |
| **Lecture de la mémoire** | `app/utils/aiContext.ts` → `buildCoachContext()` | Lit `ai_memory`, n'est appelée nulle part (dette D4) |
| **Migration AI OS** | `…160000_ai_os_foundation.sql` | `ai_embeddings`, `ai_jobs`, `ai_agent_runs` + pgvector — **non appliquée** |
| **Table `ai_reports`** | Supabase | Schéma en place, **aucune écriture** aujourd'hui |
| **Moteur d'automatisation, slots libres** | `modules/automation` | Le pipeline n'a que 3 steps (`validate`, `analyze`, `discipline`) ; les slots pour objectifs, tags, IA sont ouverts et vides |

---

## 4. Prévu ⚪

### P0 — bloquant

| Fonctionnalité | # | Dépendances déjà prêtes |
| --- | --- | --- |
| Mémoire longue durée branchée + écriture active | 1 | `ai_memory` ✅, `buildCoachContext` 🟠 |
| Insights proactifs (pattern → notification) | 2 | Moteurs ✅, Notification Engine ✅, `ai_jobs` ⚪ |
| Daily Brief + Weekly Review automatiques | 3 | Crons ✅, e-mails ✅, `ai_reports` 🟠 |
| Déclencheurs de retour push | 4 | Web-push ✅, checklist ✅ |
| Import CSV blindé + fallback démo | 5 | Import ✅, trades de démo ✅ |

### P1 — fort ROI

Coût des erreurs chiffré (6) · verdicts IA par métrique (7) · bloc
« Aujourd'hui » (8) · streak de discipline (9) · sync broker (10) · navigation
à 6–7 entrées (11) · plan personnalisé en fin d'onboarding (12) · ICP resserré
(13) · Free à quota IA + `fail-closed` (14) · analytics en SQL/RPC (15) ·
landing internationalisée (16).

### P2 — important, non urgent

Objectif visible partout + célébrations (17) · rapport e-mail + carte
partageable (18) · micro-feedback de discipline à la saisie (19) · empty states
guidés (20) · Jarvis contextuel à la page (21) · démo sans compte (22) ·
bandeau statut beta sur les tarifs (23) · perf secondaire (24).

### P3 — fond et opportuniste

Trancher la dette IA (25) · noyau `src/domain/` (26) · résorption typo/couleur
(27) · ESLint `warn → error` (28) · Leaked Password Protection (29) · RAG +
migration AI OS (30) · agents secondaires (31) · MCP (32) · pruning des
dépendances (33).

---

## 5. Vérifications techniques (état constaté)

| Porte | Résultat au 2026-07-28 |
| --- | --- |
| `bun test` | **75 / 76 passants**. L'unique échec (`goalPlan.test.ts`) vient d'un `node_modules` non installable dans l'environnement de vérification (`@supabase/supabase-js` introuvable), pas du code |
| `bun install` | **Échoue** : le registre npm privé configuré renvoie 403 sur plusieurs paquets (dette D16) |
| `npx tsc --noEmit` · `bun run lint` · `bun run build` | **Non exécutables** dans cet environnement (dépendances absentes). À rejouer avant tout merge |

---

## 6. Règles de lecture et de maintenance

- **Ordre de bataille** = les lots de [`ROADMAP.md` §7](ROADMAP.md).
- **Go/no-go** (`CLAUDE.md`) : toute fonctionnalité doit servir conversion,
  rétention, valeur perçue, différenciation, réduction du churn ou productivité
  du trader.
- **Zone gelée** : tout ce qui touche Trustpilot est intouchable.
- **Maintenance** : à chaque livraison, déplacer la ligne, dater l'en-tête, et
  refléter le changement dans [`ROADMAP.md`](ROADMAP.md) **et** dans le document
  propriétaire du sujet. Un statut périmé est pire qu'absent.
- **Ne jamais promouvoir en ✅ un élément 🟠** tant qu'aucune surface ne
  l'appelle : « ça compile » n'est pas « c'est livré ».
