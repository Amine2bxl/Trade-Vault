# TradeVault — Stratégie & plateforme IA

> **Référence IA pour les 24 prochains mois** : vision, garde-fous, coûts,
> scalabilité, sécurité, et roadmap IA. **Le *pourquoi / quoi / quand*.**
>
> Le ***comment* (contrats, interfaces, types, tables, flux)** vit dans
> [`ai-architecture.md`](ai-architecture.md) — sans duplication : ce document n'y
> renvoie que par pointeurs. Priorités produit transverses : [`roadmap.md`](roadmap.md).
> Détail de l'agent Coach : [`agents/coach.md`](agents/coach.md).
>
> **Légende d'état** : 🟢 Livré (prod) · 🟡 Fondation (contrats compilés, zéro
> runtime) · ⚪ Planifié.

---

## 1. Vision IA

> **L'IA n'est pas une fonctionnalité de TradeVault — c'est le produit.**
> Le journal, l'analytics et la checklist sont la matière première ; l'IA la
> transforme en **discipline** et en **progression**. Côté utilisateur, cette IA
> a une seule identité : **Jarvis**.

**Thèse.** Un trader n'échoue pas par manque de données mais par manque de
**discipline** et de **rendez-vous**. L'IA existe pour trois choses, dans l'ordre :

1. **Connaître** le trader durablement (mémoire), pas le redécouvrir à chaque question.
2. **Interpréter** ses données déterministes (les moteurs calculent, l'IA explique).
3. **Venir à lui** (proactivité : briefs, reviews, alertes de patterns).

**North Star IA.** *« Chaque dimanche un bilan me dit quelle erreur me coûte le
plus ; chaque matin mon coach me rappelle ma règle du jour. »*

## Trois invariants non négociables (hérités de `CLAUDE.md`)

- **Provider-agnostique** — l'app ne sait jamais quel modèle répond (chat *et*
  embeddings derrière une interface). Changer de modèle = **une variable d'env**.
- **Déterministe avant IA** — les moteurs purs (Trade Analysis, Discipline)
  produisent les chiffres ; l'IA les **interprète**, ne les recalcule jamais.
- **Ce qui survit au runtime va en DB avec RLS owner-only** — mémoire, rapports,
  embeddings, jobs, télémétrie.

---

## 2. AI Platform — une plateforme, pas un chatbot

Une seule recette, identique pour chaque feature IA :

```
contexte validé (Zod)  →  prompt ancré (grounded)  →  resolveProvider().complete()
```

**Principe structurel** : chaque étage (provider, contexte, prompt, router, agent,
outil, mémoire, télémétrie) est **isolé, testable, remplaçable**. Ajouter une
capacité = **enregistrer un plug-in**, jamais réécrire l'existant.

### Les 8 sous-systèmes — vue stratégique (contrats : `ai-architecture.md`)

| Sous-système | État | Enjeu stratégique |
|---|---|---|
| **Providers** (`ai-provider/`) | 🟢 | Gemini (défaut) + Anthropic ; ajouter un modèle = 1 fichier + 1 ligne. Aucun nom de vendeur au-dessus de la couche. |
| **Context Builder** (`ai/context.ts`) | 🟢 | Assemble côté client des **blocs ancrés** citables (stats précalculées) → le modèle cite, ne calcule pas. |
| **Prompt Builder** | 🟢 | Identité + tâche + contexte + format imposé ; garde-fous anti-hallucination. |
| **Services** (`backend/ai.functions.ts`) | 🟢 | `aiChat`, `aiGenerateDailyBrief`, `aiGenerateWeeklyReview`, `aiAnalyzeTrade`, `aiDetectPatterns`, `aiGenerateLessons` — auth + gating + rate-limit en middleware. |
| **AI Memory** (`ai/memory.ts`) | 🟢 épisodique · ⚪ sémantique | Ce qui fait que Jarvis **connaît** le trader (`profile`/`fact`/`lesson`/`conversation`). RAG (pgvector) planifié. |
| **AI Router** (`ai/router/`) | 🟡 | Deviendra le point d'arbitrage **coût/qualité** (modèle rapide pour le chat, premium pour la weekly review). |
| **Agent System** (`ai/agents/`) | 🟡 (coach 🟢 via service) | 5 agents déclarés (coach, performance-analyst, psychologist, risk-manager, pattern-finder). Un plug-in par agent. |
| **Tool Calling + MCP** (`ai/tools/`, `ai/mcp/`) | 🟡 | Capacités invocables, permissionnées et auditées ; MCP passe par le même contrat. |

> **Règle d'or** : toute la logique produit est écrite contre `resolveProvider()`
> et les registres — jamais contre un SDK vendeur.

---

## 3. Cap des 24 mois (par sous-système)

- **Mémoire** : (1) écriture active (extraction IA des engagements/leçons en fin
  de session), (2) fil de conversation persisté cross-device, (3) RAG sur
  trades/notes/rapports, (4) compaction pour borner le coût.
- **Router** : arbitrage de modèle coût/qualité, A/B de prompts, fallback de modèle.
- **Contexte** : construction **sélective par intention**, budget de tokens par
  bloc, bascule partielle côté serveur quand la RAG entre en jeu.
- **Prompts** : templates versionnés (A/B + éval), identité par agent.
- **Tool Calling** : (1) read-only sur les moteurs, (2) effets de bord
  permissionnés (note, rappel), (3) MCP (calendrier éco tiers, broker).
- **Agents** (ordre par valeur) : Coach formalisé → Pattern Finder → Performance
  Analyst → Risk Manager → Psychologist.

---

## 4. Coûts

**Contrôles en place** 🟢 :

| Levier | Mécanisme |
|---|---|
| Rate-limit / utilisateur | `consume_ai_quota` (fenêtre fixe atomique SQL), défaut **60 req/h** (`AI_RATE_LIMIT_PER_HOUR`), **fail-open** sur erreur infra |
| Budgets de tokens | `maxTokens` par service (chat 4096, brief 1024…) |
| Grounding compact | Stats **précalculées** injectées plutôt que trades bruts |
| Caps d'entrée (Zod) | trades ≤ 500, mémoire ≤ 60, conversation ≤ 20 tours |
| Provider bon marché par défaut | Gemini en primaire ; premium réservé au haute valeur |

**À construire** ⚪ : télémétrie coût/latence/modèle attribuable (`ai_agent_runs`),
arbitrage de modèle par le router, jobs asynchrones pour l'IA lourde, compaction
mémoire/RAG, quotas différenciés Free/Pro.

---

## 5. Scalabilité

- **Provider-agnostique** → suivre l'état de l'art sans refonte ; multi-provider/fallback possible.
- **Registres partout** (agents/tools/jobs/providers) → *open/closed* : chaque système isolé, ajout sans toucher l'existant.
- **Background Jobs table-backed** (`ai_jobs`, ⚪) → l'IA longue ne bloque jamais une requête ; durable, *retryable*.
- **Moteurs déterministes en amont** → le gros du calcul est hors IA, cacheable (React Query) et migrable en SQL/RPC (roadmap P1 #15).
- **RAG en pgvector** avec RLS owner-only → recherche sémantique par utilisateur, isolée, scalable côté Postgres.
- **Dépendance `ai → core`** (jamais l'inverse) → la couche IA grossit sans polluer le noyau.

> **Vigilance 24 mois** : passer le calcul de stats client en SQL/RPC (P1 #15)
> avant que le volume de trades n'impacte le coût de contexte IA.

---

## 6. Sécurité

| Garde-fou | État | Détail |
|---|---|---|
| Secrets serveur-only | 🟢 | Clés via `process.env` dans `backend/` ; rien côté client |
| Auth obligatoire | 🟢 | `requireSupabaseAuth` avant tout endpoint IA |
| Gating d'entitlement | 🟢 | `requireProAccess` derrière `AI_REQUIRE_PRO` (OFF en beta) ; fail-open infra, **fail-closed au payant** |
| Rate-limit anti-abus | 🟢 | `consume_ai_quota`, indépendant du paywall |
| Validation d'entrée | 🟢 | Zod strict + caps de taille sur tout le contexte |
| RLS owner-only | 🟢 | `ai_memory`, `ai_reports` (+ futures `ai_embeddings`/`ai_jobs`/`ai_agent_runs`) |
| Anti-hallucination | 🟢 | Grounding chiffres réels, interdiction d'inventer, format contraint |
| Outils permissionnés & audités | 🟡 | `sideEffect` + télémétrie (à l'implémentation du Tool Calling) |

**24 mois** : audit des runs (`ai_agent_runs`), revue de sûreté des outils à effet
de bord avant activation, politique de rétention mémoire, validation stricte des
sorties MCP externes (input non fiable).

---

## 7. Roadmap IA

> Un **système à la fois**, sans réécrire l'existant. Priorités produit : [`roadmap.md`](roadmap.md).

**0–3 mois — Le coach vivant** *(en cours)*
- 🟢 Jarvis conversationnel (`aiChat` + `ai_memory`, fil multi-tours).
- ⚪ Écriture active de la mémoire (extraction engagements/leçons).
- ⚪ Insights proactifs : pattern → notification (canal `ai_message`).

**3–6 mois — Le rendez-vous**
- ⚪ Background Jobs (`ai_jobs`) + cron ; Daily Brief & Weekly Review **automatiques** (in-app + e-mail).
- ⚪ Télémétrie coût/latence (`ai_agent_runs`) + tableau de bord interne.

**6–12 mois — La preuve & l'arbitrage**
- ⚪ Tool Calling read-only ; migration du coach vers l'agent formalisé + **AI Router**.
- ⚪ Arbitrage de modèle, prompts versionnés + éval ; « coût des erreurs » chiffré + verdicts IA par métrique.

**12–18 mois — La mémoire sémantique**
- ⚪ Migration `ai_os_foundation` ; RAG (embeddings) ; fil cross-device + compaction.
- ⚪ Agents Pattern Finder + Performance Analyst en prod.

**18–24 mois — L'écosystème**
- ⚪ Agents Risk Manager + Psychologist ; Tool Calling à effet de bord + **MCP**.
- ⚪ Gouvernance de coût différenciée Free/Pro ; multi-provider fallback.

---

_Référence IA officielle des 24 mois. Contrats : [`ai-architecture.md`](ai-architecture.md).
Ordre de bataille produit : [`roadmap.md`](roadmap.md)._
