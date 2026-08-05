# TradeVault — Documentation produit vivante

> **Document de référence.** À mettre à jour à chaque évolution du produit.
> **Règle d'écriture** : tout ce qui est écrit ici a été vérifié dans le code.
> Ce qui n'a pas pu l'être est signalé comme tel, explicitement.
>
> Compléments historiques : `AUDIT-PREMIUM.md` (technique) · `AUDIT-PRODUIT.md`
> (produit) · `PRODUCT-BIBLE.md` (vision et moat). **Ce document-ci prime** en cas
> de divergence — les audits contiennent des constats que le code a invalidés
> depuis (ils sont annotés).

---

## 1. Ce que fait TradeVault

Un trader perd rarement par manque de connaissances. Il perd par **écart entre ce
qu'il sait et ce qu'il fait**. Cet écart est comportemental : aucun indicateur ne
le corrige, seule une boucle de rétroaction personnelle et répétée le corrige.

**Le problème que les concurrents n'adressent pas** : journaliser est un effort
immédiat dont la récompense est différée de plusieurs semaines. C'est le pire
schéma de rétention qui existe, et ajouter des graphiques l'aggrave — cela ajoute
de la récompense différée à de la récompense différée.

**La réponse de TradeVault** : rapprocher la récompense de l'effort, via un coach
qui se souvient et qui mesure.

### La boucle centrale du produit

```
Matin    Checklist pré-market (série de jours en cours)
   ↓
         Le trade
   ↓
Soir     Journalisation
   ↓
         Jarvis répond avec : ses erreurs, ses objectifs, la TENUE de ses règles
   ↓
Semaine  « Tu l'as tenue 11 fois sur 12 »
```

État actuel : **tous les maillons existent**. Le dernier livré (tenue des règles)
ferme la boucle côté données ; la restitution visuelle reste partielle.

---

## 2. Architecture

```
routes/          9 routes fichiers (dont /dev/ai, noindex)
app/             UI — 23 pages, 35 composants, 10 hooks
  utils/         Moteurs déterministes (PURS, testés)
modules/         Domaine réutilisable — ai/, ai-provider/, voice/, discipline/
backend/         17 fonctions serveur (createServerFn) + middlewares
integrations/    Client Supabase + types générés
supabase/        30 migrations
```

**Pile** : TanStack Start (SSR) · TanStack Router · TanStack Query · Supabase
(Postgres + RLS + Auth + Storage + Realtime) · Tailwind · Vercel · Bun (tests).

### Principe d'architecture n°1 — la séparation pur / IO

Toute logique métier significative vit dans un **module pur** : aucune dépendance
React, réseau ou stockage, avec les dépendances injectées. C'est ce qui la rend
testable, et c'est ce qui protège les règles produit subtiles (voir §4).

Modules purs testés : `edgeHistory` · `checklistStreak` · `ruleAdherence` ·
`ruleCheck` · `behavioral` · `memory-select` · `signalContext` · `history`.

> **Contre-exemple corrigé** : `checkTradeAgainstRules` vivait dans
> `tradingRules.ts`, qui importe le client Supabase — il était donc impossible à
> tester sans base. La logique pure a été extraite dans `ruleCheck.ts` ;
> `tradingRules.ts` la ré-exporte, aucun appelant n'a changé.

### Principe n°2 — une seule source de vérité par information

| Information | Source unique | Jamais dupliquée dans |
|---|---|---|
| Règles du trader | `profiles.trading_rules` | mémoire IA |
| Objectifs | table `goal_plans` | mémoire IA |
| Habitudes / signaux | recalculés depuis `trades` | mémoire IA |
| Préférences | `profiles` (onboarding) | mémoire IA |
| Liste des pages | `PAGES` (`app/types.ts`) | ~~3 copies dans `App.tsx`~~ |
| « Violer une règle » | `ruleCheck.checkTradeAgainstRules` | temps réel **et** bilan |
| « Où en est cet objectif » | hook `useGoalProgress` | Goals **et** Jarvis |

**Ce tableau est la règle la plus importante du projet.** Une donnée dupliquée
diverge ; un chiffre qui diverge entre deux pages détruit la confiance dans un
produit d'analyse.

---

## 3. Jarvis — le coach IA

### Chaîne d'exécution

```
Question
  → buildCoachV1Payload   stats · trades · mistakes · signals · rules
                          · goals · ADHÉRENCE · profil · mémoire sélectionnée
  → askCoach              [server fn, middleware requireProAccess]
  → runCoach              context-builder → prompt-builder → provider-service
  → router                circuit breaker · métriques · fallback déterministe
  → answerToBlocks        [CLIENT] prose → blocs enrichis
  → BlockList
```

**Décision de conception centrale** : l'enrichissement en blocs se fait **côté
client**, à partir de données déjà calculées. Le LLM écrit de la prose ; les
chiffres viennent des moteurs déterministes. *C'est ce qui garantit qu'aucun
chiffre affiché ne peut être halluciné.* À préserver absolument.

### Contrat de blocs (9 types)

`markdown` · `stats` · `card` · `checklist` · `alert` · `hero` · `insight` ·
`mission` · `tool`

Une réponse n'est pas du texte, c'est une **structure typée**. Conséquence : le
rendu est découplé du modèle, de nouveaux types s'ajoutent sans casser
l'existant, et le streaming deviendra possible sans réécriture.

### Mémoire (`ai_memory`)

**Principe** : on ne mémorise QUE ce qui n'est pas recalculable.

| Colonne | Rôle |
|---|---|
| `kind` | `profile` · `fact` · `lesson` · `decision` · `preference` · `conversation` |
| `key` | Identité sémantique — dédoublonnage **structurel** (contrainte UNIQUE) |
| `importance` | 1–5, arbitre la sélection quand la récence ne suffit pas |
| `confidence` | 0–1 ; sous **0,3** le souvenir n'atteint plus le LLM sans être détruit |
| `source` | `onboarding` · `rule_accepted` · `conversation` · `detector` — purge sélective |
| `updated_at` | « confirmé quand », distinct de « appris quand » |

**Sélection par intention** (`memory-select.ts`) — trois contraintes indépendantes :
budget de **350 tokens**, plafond de **8 souvenirs**, plancher de pertinence.
Le budget protège du volume ; le plancher protège de la **dilution**.

> Mesuré : sur un corpus d'un an (120 souvenirs), 2 400 tokens → 160. **93 %
> d'économie.** Sur un corpus typique, la sélection retient 4 à 8 souvenirs selon
> la question.

**Écritures déterministes** (zéro coût, zéro hallucination) : profil upserté
depuis l'onboarding · règle acceptée → souvenir `decision` (`confidence: 1`,
l'utilisateur a cliqué).

**Non implémenté** : l'extraction par LLM (PR-2b). C'est la seule brique capable
de mentir durablement — ses garde-fous sont spécifiés mais non codés.

### Ce que Jarvis sait aujourd'hui

✅ qui est le trader · ses erreurs récurrentes et leur coût · ses signaux
comportementaux · ses règles · **ses objectifs et leur progression** · **la tenue
de ses règles** · ses souvenirs persistants sélectionnés.

❌ Il n'est pas **proactif** (ne parle jamais en premier) · pas de **streaming**
(`askCoach` est un RPC JSON, structurellement incapable de SSE) · pas de
**validation post-réponse** (la prose peut citer un chiffre légèrement différent
de la carte de preuve).

---

## 4. Moteurs déterministes — et les règles produit qu'ils protègent

C'est ici que vit la valeur non copiable. Chaque moteur porte des décisions
produit subtiles, verrouillées par tests.

### Edge Score (`edgeScore.ts` + `edgeHistory.ts`)

Score de discipline 0–100 sur 10 jours tradés. Quatre sous-scores pondérés
(plan 35 % · risque 25 % · jours propres 25 % · routine 15 %), renormalisés quand
une donnée manque — **le score ne fabrique jamais une composante qu'il ne peut
pas mesurer**.

> **Il récompense le COMPORTEMENT, jamais le P&L.** C'est la décision produit la
> plus importante du fichier : un score qui récompenserait les gains
> récompenserait la chance.

`edgeHistory` conserve 30 jours pour afficher une **trajectoire** (sparkline).
Un score sans historique est un constat ; avec historique, c'est une progression.

### Erreurs récurrentes (`behavioral.ts`)

Fréquence, coût, sévérité, tendance hebdomadaire agrégée, et **tendance par
erreur** sur deux fenêtres de 30 jours.

> **Garde-fou** : les fenêtres s'adossent à la dernière date **journalisée**, pas
> à aujourd'hui. Sinon un trader en pause verrait toutes ses erreurs « reculer »
> — et le produit le féliciterait d'avoir arrêté.
> **Second garde-fou** : pas de tendance sans fenêtre de comparaison. Une erreur
> apparue cette semaine n'a pas de tendance.

### Adhérence aux règles (`ruleAdherence.ts`)

« Tu l'as tenue 11 fois sur 12 » — la mesure qui ferme la boucle.

> **Trois garde-fous** : les règles `custom` sont exclues (un texte libre n'est
> pas vérifiable — afficher « 100 % » serait une flatterie mensongère) · fenêtre
> adossée à la dernière date tradée · une règle jamais éprouvée est **omise**,
> jamais créditée.
>
> **Limite connue** : l'applicabilité est grossière — tout trade compte pour
> toute règle vérifiable. Choix prudent (sous-estime plutôt qu'il ne flatte).

### Série de checklist (`checklistStreak.ts`)

Jours de bourse consécutifs avec checklist verrouillée.

> **Deux règles** : les week-ends ne cassent jamais la série (marchés fermés —
> punir un dimanche découragerait de tenir en semaine) · le jour courant
> bénéficie d'un **sursis** (une série qui tombe à zéro à 9 h punirait un jour
> pas encore vécu).

---

## 5. Modèle de données

**16 tables déployées** : `profiles` · `accounts` · `trades` · `user_preferences`
· `goal_plans` · `six_month_goals` · `notifications` · `monthly_reports` ·
`subscriptions` · `push_subscriptions` · `processed_webhook_events` ·
`economic_events` · `economic_calendar_sync` · `ai_memory` · `ai_reports` ·
`ai_rate_limits` · `habits`.

**En attente** (`_pending_ai_os_foundation.sql`, jamais appliquée) :
`ai_embeddings` (pgvector) · `ai_jobs` · `ai_agent_runs` (télémétrie).

**Dormante** : `habits` (avec `streak`) n'est utilisée par **aucun code
applicatif** — la série de checklist est calculée depuis `localStorage`, ce qui
évite une table et une migration.

### Migrations

Toute migration doit être **rejouable** : une branche de preview rejoue la chaîne
entière à zéro. Utiliser `if not exists`, `drop … if exists` avant `create`,
`or replace`.

> **Incident réparé** : des migrations recréaient des politiques déjà créées.
> Invisible en production (application incrémentale), mais toute branche de
> preview échouait → statut `MIGRATIONS_FAILED` → check `Supabase Preview`
> « skipped » à chaque PR. Conséquence : **aucune migration n'a jamais été
> vérifiée avant la production** pendant toute la vie du projet.
> Vérifié depuis : rejeu complet à zéro, 0 échec, 19 tables, 53 politiques RLS.

---

## 6. Sécurité

- **RLS partout**, propriétaire uniquement (`auth.uid() = user_id`). Vérifié par
  exécution : lecture et écriture croisées entre deux utilisateurs sont rejetées.
- **`requireProAccess`** — middleware **fail-closed** : refuse en cas d'erreur DB.
- **Défense en profondeur** : le serveur ne fait pas confiance au client. Zod
  re-borne la mémoire (12 × 300 car.), l'adhérence (5), les signaux (12 KB).
- **`ANTI_HALLUCINATION`** : le LLM ne peut citer que les blocs fournis.

**Monétisation** : `AI_REQUIRE_PRO` **désactivé** — accès complet pour tout
utilisateur connecté. `FREE_DAILY_LIMIT = 5` prêt mais dormant. Une variable
d'environnement suffit à basculer.

---

## 7. Ce qui reste à faire

**Vérifié comme manquant**, par ordre de valeur :

1. **Observabilité** — `ai_agent_runs` non appliquée, `TelemetryRecorder` sans
   writer, `runtime/metrics` en mémoire (perdu à chaque cold start). *Rien n'est
   mesurable aujourd'hui.*
2. **Proactivité de Jarvis** — via `Inbox`, qui est aujourd'hui un canal vide.
3. **URLs par page** — l'app entière est une seule route ; le bouton retour
   quitte l'application sur Android, et **aucune page n'est traçable en
   analytics**.
4. **Extraction mémoire par LLM** — garde-fous spécifiés, non codés.
5. **Streaming** — nécessite un transport HTTP (le RPC actuel ne peut pas faire
   de SSE).
6. **Design system** — ~470 tailles typographiques arbitraires restantes, ~105
   couleurs en dur. *Plus aucun texte sous 11 px.*
7. **i18n** — deux mécanismes coexistent (dictionnaire + ternaires en ligne).

---

## 8. Limites de cette documentation

- **L'application n'a jamais été exécutée** dans l'environnement où ce document
  a été écrit. Les comportements d'interface sont décrits d'après le code, pas
  d'après l'observation.
- **Aucune mesure de latence ni de pertinence LLM** : pas de clé API disponible.
  Les gains de tokens sont calculés, ceux de latence sont raisonnés.
- **Aucune donnée d'usage réelle** : les jugements de valeur produit sont des
  hypothèses argumentées, pas des constats.
