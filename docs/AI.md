# TradeVault — Stratégie & plateforme IA

> **Référence IA pour les 24 prochains mois.** Ce document fixe la vision IA, la
> plateforme, ses briques (router, mémoire, contexte, prompts, tools, agents), et
> les axes coûts / scalabilité / sécurité, puis la roadmap IA.
>
> **Deux documents complémentaires, pas de duplication :**
> - **Ici (`AI.md`)** = *pourquoi, quoi, avec quels garde-fous, dans quel ordre* — la stratégie et l'état réel.
> - **[`AI-ARCHITECTURE.md`](AI-ARCHITECTURE.md)** = *les contrats* (interfaces, types, registres, migrations) — le détail d'implémentation.
> - Priorités produit transverses : [`ROADMAP.md`](ROADMAP.md).

**Légende d'état** (utilisée partout dans ce document) :
🟢 **Livré** (en prod) · 🟡 **Fondation** (contrats/registres compilés, zéro logique runtime) · ⚪ **Planifié**.

---

## 1. Vision IA

> **L'IA n'est pas une fonctionnalité de TradeVault — c'est le produit.**
> Le journal, l'analytics et la checklist sont la matière première ; l'IA est ce
> qui la transforme en **discipline** et en **progression**.

**Thèse.** Un trader n'échoue pas par manque de données mais par manque de
**discipline** et de **rendez-vous**. L'IA de TradeVault existe pour trois choses,
dans cet ordre :

1. **Connaître** le trader durablement (mémoire), pas le redécouvrir à chaque question.
2. **Interpréter** ses données déterministes (les moteurs calculent, l'IA explique).
3. **Venir à lui** (proactivité : briefs, reviews, alertes de patterns).

**Trois invariants non négociables** (hérités de `CLAUDE.md`) :

- **Provider-agnostique** — l'application ne sait jamais quel modèle répond. Chat
  *et* embeddings passent par une interface. Changer de modèle = **une variable
  d'environnement**, zéro refactor.
- **Déterministe avant IA** — les moteurs purs (Trade Analysis, Discipline)
  produisent les chiffres ; l'IA les **interprète**, ne les **recalcule jamais**.
  Garantit des nombres exacts et reproductibles.
- **Ce qui survit au runtime va en DB avec RLS owner-only** — mémoire, rapports,
  embeddings, jobs, télémétrie. Isolation stricte par utilisateur.

**North Star IA.** _« Chaque dimanche un bilan me dit quelle erreur me coûte le
plus ; chaque matin mon coach me rappelle ma règle du jour. »_ Tout investissement
IA des 24 mois se juge à l'aune de ce résultat.

---

## 2. AI Platform

La plateforme suit **une seule recette**, identique pour chaque feature IA :

```
contexte validé (Zod)  →  prompt ancré (grounded)  →  resolveProvider().complete()
```

### 2.1 Couche provider — 🟢 Livré

`src/modules/ai-provider/` — abstraction serveur-only. L'app ne parle jamais à un
SDK vendeur.

| Élément | Détail |
|---|---|
| **Interface** | `AIProvider.complete(req) → AIResponse` |
| **Requête** | `AIRequest { messages, maxTokens?, temperature?, json? }` |
| **Réponse** | `AIResponse { text, provider, model, usage? }` (`usage`/`provider` = **télémétrie seule**, jamais de branchement applicatif dessus) |
| **Providers en place** | `GeminiProvider`, `AnthropicProvider` |
| **Résolution** | `resolveProvider()` : `AI_PROVIDER` si configuré, sinon premier provider configuré ; erreur explicite si aucun |
| **Ajouter un modèle** | 1 fichier provider + 1 ligne dans `PROVIDERS` (OpenAI / Mistral / DeepSeek / Ollama…) |

### 2.2 Catalogue de services IA — 🟢 Livré

`src/backend/ai.functions.ts` — chaque feature IA du produit appelle une de ces
server functions (auth + gating + rate-limit en middleware) :

| Service | Rôle | Budget sortie |
|---|---|---|
| `aiChat` | Q&A coaché, ancré sur les données réelles | ~4096 tk |
| `aiGenerateDailyBrief` | Brief pré-market (~200 mots) | ~1024 tk |
| `aiGenerateWeeklyReview` | Synthèse hebdomadaire | — |
| `aiAnalyzeTrade` | Debrief mentor d'un trade analysé | — |
| `aiDetectPatterns` | Liste structurée de patterns récurrents | — |
| `aiGenerateLessons` | Leçons durables tirées des erreurs | — |

> **Règle d'or de la plateforme** : aucun nom de vendeur sous la couche provider.
> Toute la logique produit est écrite contre `resolveProvider()`.

### 2.3 Couche d'extension (AI OS) — 🟡 Fondation

`src/modules/ai/{agents,router,tools,rag,jobs,mcp}` + `telemetry.ts` : contrats,
types et registres compilés, **sans logique runtime**. C'est l'ossature qui rend
chaque système IA **ajoutable indépendamment**. Détail dans
[`AI-ARCHITECTURE.md`](AI-ARCHITECTURE.md).

---

## 3. AI Router — 🟡 Fondation

`src/modules/ai/router/` — décide **quel agent** traite une intention, et s'il
faut activer la RAG. Séparé des agents : on fait évoluer le *quoi* (intentions,
arbitrage de modèle, A/B testing) sans toucher au *comment* (agents).

**Contrat.** `AIRouter.route(RoutingRequest) → RoutingDecision { agent, intent,
model?, useRetrieval, reason? }`.

**Map déterministe `INTENT_AGENT`** (config, pas de logique) :

| Intention | Agent routé |
|---|---|
| `chat`, `analyze_trade`, `daily_brief` | `coach` |
| `weekly_review`, `performance_review` | `performance-analyst` |
| `detect_patterns` | `pattern-finder` |
| `psychology_check` | `psychologist` |
| `assess_risk` | `risk-manager` |

**24 mois.** Le router devient le point d'arbitrage **coût/qualité** : routage
d'un modèle rapide/bon marché pour le chat courant vers un modèle premium pour la
weekly review ; A/B de prompts ; *fallback* de modèle. Aujourd'hui l'app appelle
directement les services (`ai.functions.ts`) ; la bascule vers le router est un
lot dédié, sans réécrire les agents.

---

## 4. AI Memory — 🟢 Livré (épisodique) · ⚪ Planifié (sémantique)

Ce qui fait que le coach **connaît** le trader au lieu de le redécouvrir.

### 4.1 Mémoire épisodique — 🟢 `src/modules/ai/memory.ts` (table `ai_memory`)

| kind | Contenu | Exemple |
|---|---|---|
| `profile` | Qui est le trader (niveau, marché, style, horaires) | seedé depuis l'onboarding |
| `fact` | Observations durables | « oversize après 2 pertes » |
| `lesson` | Leçons émises par l'IA et acceptées | — |
| `conversation` | Historique de chat fenêtré | — |

API : `loadMemory(userId, kinds, limit)` · `remember(userId, kind, content)` ·
`forget(userId, id)`. **RLS owner-only.**

### 4.2 Mémoire sémantique (RAG) — ⚪ Planifié

`ai_embeddings` (pgvector, `vector(1536)`) + `EmbeddingProvider` + `Retriever`
(contrats posés, migration **prête, non appliquée**). Permettra de retrouver par
similarité les trades/notes pertinents. `vector(1536)` est **le seul nombre
couplé au modèle** d'embeddings.

**24 mois.** (1) Écriture active de la mémoire (extraction IA des engagements et
leçons en fin de session), (2) fil de conversation persisté cross-device, (3) RAG
sur trades + notes + rapports, (4) résumé/compaction de mémoire pour borner le coût.

---

## 5. Context Builder — 🟢 Livré

`src/modules/ai/context.ts` — assemble **tout ce que l'IA peut savoir** du trader,
côté client (là où la donnée vit déjà), et le sérialise en **blocs ancrés** que le
modèle a le droit de citer.

**`AIUserContext`** (tous champs optionnels — dégradation gracieuse) :
`trades` · `stats` (précalculées par les moteurs) · `goals` · `rules` · `memory` ·
`conversation` · `language`.

**`contextBlocks(ctx)`** produit des sections étiquetées :
`LONG-TERM MEMORY` · `THE TRADER'S OWN RULES` · `ACTIVE GOALS` ·
`PRECOMPUTED STATS (trust these numbers)` · `RECENT TRADES (JSON)`.

**`languageName(code)`** — 12 langues mappées ; la réponse est écrite dans la
langue de l'UI.

**Principe.** Le contexte injecte des **stats précalculées** (déterministes) : le
modèle **cite**, il ne calcule pas. C'est le pont entre « déterministe avant IA »
et le grounding anti-hallucination.

**24 mois.** Construction de contexte **sélective par intention** (le router
décide quels blocs charger), budgétisation de tokens par bloc, et bascule d'une
partie de l'assemblage côté serveur quand la RAG entre en jeu.

---

## 6. Prompt Builder — 🟢 Livré

`buildMessages()` dans `ai.functions.ts` — transforme contexte + tâche + tour
utilisateur en `AIMessage[]` prêt pour le provider.

**Structure d'un prompt :**

1. **System** = `COACH_IDENTITY(langue)` + **tâche** spécifique au service.
   L'identité impose : *« cite toujours des chiffres réels du contexte, n'invente
   jamais de nombre, franc mais bienveillant, réponds entièrement en {langue} ».*
2. **Injection du contexte** — les `contextBlocks` en tête du premier tour.
3. **Rejeu de conversation** — si `conversation` présente : le contexte est posé
   comme un échange initial (user=contexte / assistant=« compris »), puis les
   tours réels, puis la question courante → **continuité multi-tours**.
4. **Format de sortie imposé** — ex. `aiChat` exige un Markdown structuré
   (🎯 Key Takeaways, 📊 Stats Snapshot, ✅/⚠️, 🧭 Action Plan, 💡 Bottom Line).

**Garde-fous anti-hallucination :** grounding par chiffres précalculés, interdiction
d'inventer, format contraint, budgets de tokens (`maxTokens` par service).

**24 mois.** Externaliser les prompts en templates versionnés (A/B, éval),
mesurer la qualité (règles de citation, format), et spécialiser les identités par
agent (le coach n'a pas la même voix que le Risk Manager).

---

## 7. Tool Calling — 🟡 Fondation

`src/modules/ai/tools/` — capacités que le modèle peut **invoquer** (function
calling), provider-agnostique. Contrat : `ToolDefinition.execute()` + registre
`registerTool()`.

**Outils déclarés dans le catalogue d'agents** (à implémenter, un par un) :
`get_stats` · `get_trades` · `search_memory` · `get_rules` · `get_goals` ·
`compute_quant_stats` · `get_discipline_events` · `assess_trade_risk`.

**Principes :**
- Un outil **réutilise les moteurs/stores existants** — jamais de logique métier dans l'outil.
- Outils **permissionnés** (`sideEffect`) et **audités** (télémétrie).
- **MCP** (`src/modules/ai/mcp/`) passe par **le même contrat** : un outil externe
  devient un outil local via `McpClientAdapter` → `registerTool(source:"mcp")`.
  MCP est un détail d'intégration, pas une bifurcation d'architecture.

**24 mois.** (1) Câbler Tool Calling sur le provider existant + les moteurs
(read-only d'abord), (2) outils à effet de bord permissionnés (créer une note,
programmer un rappel), (3) MCP pour outils externes (calendrier éco tiers, broker).

---

## 8. Agents IA — 🟡 Fondation (déclaratif)

`src/modules/ai/agents/catalog.ts` — **5 agents décrits déclarativement**
(titre, persona, outils autorisés, format de sortie), source de vérité unique,
zéro logique IA à ce stade.

| Agent | Rôle | Outils autorisés |
|---|---|---|
| **`coach`** 🟢* | Mentor conversationnel, connaît le trader | `get_stats`, `get_trades`, `search_memory`, `get_rules`, `get_goals` |
| **`performance-analyst`** | Lecture quant de la performance | `get_stats`, `get_trades`, `compute_quant_stats` |
| **`psychologist`** | Biais & tilt, lecture comportementale | `get_trades`, `search_memory`, `get_discipline_events` |
| **`risk-manager`** | Exposition, sizing, respect des règles | `get_stats`, `get_rules`, `get_discipline_events`, `assess_trade_risk` |
| **`pattern-finder`** | Schémas récurrents (setups gagnants/perdants) | `get_trades`, `get_stats`, `search_memory` |

*\* Le **coach** est déjà servi en prod via `aiChat` (chemin direct) ; les autres
agents sont des blueprints. Migrer le coach du chemin direct vers l'agent
formalisé + router est un lot dédié.*

**Recette d'ajout d'un agent** (aucun agent/moteur existant modifié) : écrire
`agents/<x>.agent.ts` (`run()` qui appelle `resolveProvider()`), `registerAgent()`,
câbler l'`AiIntent` dans `INTENT_AGENT`, puis (si besoin) job + RAG.

**24 mois.** Ordre par valeur : Coach formalisé → Pattern Finder → Performance
Analyst → Risk Manager → Psychologist.

---

## 9. Coûts

### 9.1 Contrôles en place — 🟢

| Levier | Mécanisme |
|---|---|
| **Rate-limit par utilisateur** | `consume_ai_quota` (fenêtre fixe atomique en SQL), défaut **60 req/h** (`AI_RATE_LIMIT_PER_HOUR`), **fail-open** sur erreur infra |
| **Budgets de tokens** | `maxTokens` par service (chat 4096, brief 1024…) |
| **Grounding compact** | Stats **précalculées** injectées plutôt que trades bruts → moins de tokens, plus de précision |
| **Caps d'entrée (Zod)** | trades ≤ 500, mémoire ≤ 60, conversation ≤ 20 tours, contenu borné |
| **Provider bon marché par défaut** | Gemini en primaire ; premium réservé aux tâches à forte valeur |

### 9.2 À construire — ⚪

- **Télémétrie coût/latence/modèle** (`ai_agent_runs` + `telemetry.ts`) :
  observable et **attribuable par utilisateur** dès le premier run.
- **Arbitrage de modèle par le router** : rapide/pas cher pour le chat, premium
  pour la weekly review.
- **Jobs asynchrones** pour l'IA lourde (brief, review, embeddings) — hors du
  chemin requête, batchable.
- **Compaction de mémoire / RAG** pour borner la croissance du contexte.
- **Gouvernance de coût** : quotas différenciés Free vs Pro (le rate-limit devient
  aussi un levier produit une fois la monétisation activée).

---

## 10. Scalabilité

- **Provider-agnostique** → suivre l'état de l'art des modèles sans refonte ; multi-provider possible (routage/fallback).
- **Registres partout** (agents/tools/jobs/providers) → *open/closed* : chaque système IA isolé, testable seul, ajout sans toucher l'existant.
- **Background Jobs table-backed** (`ai_jobs`) → l'IA coûteuse et longue ne bloque jamais une requête ; durable, *retryable*, déclenchée par cron/événements.
- **Moteurs déterministes en amont** → le gros du calcul (stats) est **hors IA**, cacheable (React Query) et migrable en SQL/RPC (ROADMAP P1 #15) ; l'IA ne fait que l'interprétation.
- **RAG en pgvector** avec RLS owner-only → recherche sémantique par utilisateur, isolée, scalable côté Postgres.
- **Événements primitifs dans le bus core** → `ai → core` (jamais l'inverse) : la couche IA grossit sans polluer le noyau.

**Point de vigilance 24 mois** : le calcul de stats côté client à grande échelle
(P1 #15) doit passer en SQL/RPC avant que le volume de trades par utilisateur
n'impacte le coût de contexte IA.

---

## 11. Sécurité

| Garde-fou | État | Détail |
|---|---|---|
| **Secrets serveur-only** | 🟢 | Clés modèles lues via `process.env` dans `backend/` ; aucune clé côté client |
| **Auth obligatoire** | 🟢 | `requireSupabaseAuth` chaîné avant tout endpoint IA |
| **Gating d'entitlement** | 🟢 | `requireProAccess` derrière `AI_REQUIRE_PRO` (OFF en beta → tout gratuit) ; **fail-open** sur infra, **fail-closed** au passage payant |
| **Rate-limit anti-abus** | 🟢 | `consume_ai_quota`, indépendant du paywall |
| **Validation d'entrée** | 🟢 | Schémas Zod stricts + caps de taille sur tout le contexte |
| **RLS owner-only** | 🟢 | `ai_memory`, `ai_reports` (et futures `ai_embeddings`/`ai_jobs`/`ai_agent_runs`) isolées par `user_id = auth.uid()` |
| **Isolation des données de trading** | 🟢 | Le contexte d'un utilisateur ne fuit jamais vers un autre (RLS + scoping serveur) |
| **Anti-hallucination** | 🟢 | Grounding par chiffres réels, interdiction d'inventer, format contraint |
| **Outils permissionnés & audités** | 🟡 | `sideEffect` + télémétrie (quand Tool Calling sera implémenté) |

**24 mois.** (1) Journalisation d'audit des runs (`ai_agent_runs`), (2) revue de
sûreté des outils à effet de bord avant activation, (3) politique de rétention de
la mémoire IA, (4) validation stricte des sorties d'outils MCP externes (données
non fiables → même prudence que tout input externe).

---

## 12. Roadmap IA

> Vue **IA** synthétique. Priorités produit transverses dans [`ROADMAP.md`](ROADMAP.md).
> Chaque étape = **un système à la fois**, sans réécrire l'existant.

**Horizon 0–3 mois — Le coach vivant** _(en cours)_
- 🟢 Coach conversationnel à mémoire (`aiChat` + `ai_memory`, fil multi-tours).
- ⚪ Écriture active de la mémoire (extraction des engagements/leçons).
- ⚪ Insights proactifs : détection de pattern → notification (canal `ai_message`).

**Horizon 3–6 mois — Le rendez-vous**
- ⚪ Background Jobs (table `ai_jobs`) + cron.
- ⚪ Daily Brief & Weekly Review **automatiques** (in-app + e-mail), via jobs.
- ⚪ Télémétrie coût/latence (`ai_agent_runs`) + tableau de bord interne.

**Horizon 6–12 mois — La preuve & l'arbitrage**
- ⚪ Tool Calling read-only câblé sur les moteurs ; migration du coach vers l'agent formalisé + **AI Router**.
- ⚪ Arbitrage de modèle par le router (coût/qualité), prompts versionnés + éval.
- ⚪ « Coût des erreurs » chiffré et verdicts IA par métrique (valeur tangible).

**Horizon 12–18 mois — La mémoire sémantique**
- ⚪ Appliquer la migration `ai_os_foundation` ; RAG (embeddings trades/notes/rapports).
- ⚪ Fil de conversation persisté cross-device ; compaction de mémoire.
- ⚪ Agents Pattern Finder + Performance Analyst en production.

**Horizon 18–24 mois — L'écosystème**
- ⚪ Agents Risk Manager + Psychologist.
- ⚪ Tool Calling à effet de bord (permissionné) + **MCP** (outils externes).
- ⚪ Gouvernance de coût différenciée Free/Pro ; multi-provider fallback.

---

_Ce document est la référence IA officielle des 24 prochains mois. Le détail des
contrats vit dans [`AI-ARCHITECTURE.md`](AI-ARCHITECTURE.md) ; l'ordre de bataille
produit dans [`ROADMAP.md`](ROADMAP.md)._
