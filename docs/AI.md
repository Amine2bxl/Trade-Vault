# IA — Jarvis et la plateforme IA

Jarvis est **l'unique identité IA** du produit (page, widget, checklist, voix).
Côté code, l'agent s'appelle `coach` ; côté utilisateur, toujours « Jarvis ».
Rôle produit et persona : [`PRODUCT.md`](PRODUCT.md#jarvis).

## 1. Invariants

1. **Les chiffres viennent des moteurs déterministes ; le modèle ne fait que
   les formuler.** Il ne calcule, n'estime ni n'invente jamais un nombre ; une
   donnée absente se dit absente.
2. **Provider-agnostique** : l'app ne sait jamais quel modèle répond ; changer
   de modèle = une variable d'environnement.
3. **Jarvis n'écrit rien directement.** Tous les outils sont en lecture seule
   (`sideEffect: false`) ; la seule voie d'écriture est l'**acceptation d'une
   proposition** par le trader (`backend/proposals.functions.ts`).
4. **Pas de conseil financier ni de prédiction de marché.**
5. **Aucune affirmation sous l'échantillon minimum, aucune formulation causale,
   toute statistique affiche son `n`** (garde-fous : `modules/patterns/thresholds.ts`,
   `modules/patterns/language.ts`, `modules/coaching/safety.ts`, testés par
   `tests/noCausalLanguage.test.ts`).
6. Réponse **écrite** dans la langue de l'UI ; **voix** toujours en anglais.

## 2. La chaîne en production — question posée à Jarvis

```
features/jarvis (page Jarvis.tsx / widget AiAssistant.tsx)
  → workspaces/ConversationWorkspace.tsx
  → aiContext.ts : payload ancré (stats, trades, erreurs, signaux
                   behaviorSignals.ts, règles, profil, souvenirs choisis
                   par modules/ai/memory-select)
  → backend/coach.functions.ts  askCoach (Zod + bornes domain/ai-limits,
                                garde requireJarvisAccess : auth, accès, quota)
  → modules/ai/agents/coach.agent.ts  runCoach
       context-builder → prompt-builder → provider-service
       (runWithTools + outils backend/ai-tools, lecture seule)
  → modules/ai/runtime/router.ts  routeCompletion : providers ordonnés,
       circuit breaker, timeout, métriques
  → response-formatter → réponse { source: "ai" } ou message honnête
    { source: "unavailable", reason: "busy" | "outage" }
  → télémétrie : backend/telemetry.server.ts → table ai_agent_runs
```

## 3. Carte des fichiers

| Brique | Emplacement |
| --- | --- |
| Providers (Gemini, Anthropic, OpenAI, Groq, OpenRouter) | `modules/ai-provider/` — `registry.ts` : `AI_PROVIDER` si configuré, sinon ordre du registre. Ajouter un provider = un fichier + une ligne |
| Routage d'exécution, circuit breaker, erreurs, métriques, diagnostic `/dev/ai` | `modules/ai/runtime/` |
| Contrat de contexte + blocs ancrés | `modules/ai/context.ts`, `context-builder.ts` (bornes partagées : `domain/ai-limits.ts`) |
| Prompt, formatage | `modules/ai/prompt-builder.ts`, `response-formatter.ts` |
| Agent coach (persona, `ANTI_HALLUCINATION`) | `modules/ai/agents/coach.agent.ts` |
| Outils de Jarvis (`get_trades`, `get_stats`, `get_mistakes`, `get_edge_score`, `search_memory`, `get_profile`, `get_day`) | `backend/ai-tools/` (enregistrés dans `modules/ai/tools`) |
| Mémoire | `modules/ai/memory.ts` (table `ai_memory`), `memory-select.ts` (choix des souvenirs injectés), `memory-extract.ts` + `agents/memory.agent.ts` + `backend/memory.functions.ts` (extraction, **coupée** tant que `AI_MEMORY_EXTRACTION !== "1"`) |
| Validation des charges utiles | `backend/ai-payload.ts` |
| Télémétrie | `modules/ai/telemetry.ts` (contrat), `backend/telemetry.server.ts` (écriture) |
| UI Jarvis | `app/features/jarvis/` : shell, workspaces, blocs typés (`blocks.ts`, `BlockRenderer`), conversations (**localStorage**, par appareil), propositions (`components/ProposalsPanel`, `proposals.ts`), crédits (`aiUsage.ts`) |
| Voix | `modules/voice/` (clips pré-synthétisés `public/voices/`, voix locale, prosodie), `app/features/jarvis/jarvisVoice.ts` + `hostedVoice.ts`, `backend/tts.functions.ts` (ElevenLabs optionnel) |

**Fondations non branchées** (compilées, testées, appelées par aucune
surface) : `modules/ai/infra.ts` et `router/` (routeur d'intentions), `rag/types.ts`
(contrat d'embeddings), le catalogue `backend/ai.functions.ts`, et le moteur
d'insights `app/features/jarvis/insights/` hormis `suggestions.ts` (seul utilisé
par l'UI).

## 4. Boucle de motifs et propositions

`Séance → Trades → Erreurs → Cluster → Motif → Proposition → (le trader confirme) → Règle / Objectif / Checklist`

1. **Séances** : table `trading_sessions`, `trades.session_id` (optionnel,
   rattaché au mieux) ; `app/trading/readiness.ts` dérive le score de
   préparation (jamais demandé au trader).
2. **Taxonomie** : chaque erreur de `MISTAKE_OPTIONS` appartient à un cluster
   (`app/trading/mistakeClusters.ts`, tables `mistake_clusters` /
   `mistake_taxonomy`).
3. **Détection déterministe** : cron nocturne `/api/cron/pattern-scan` →
   `backend/pattern-scan.server.ts` → `modules/patterns` (`scan`, `detectors`,
   `thresholds`, `persist`) → table `detected_patterns` (preuve avec `n`
   obligatoire).
4. **Formulation** : `modules/patterns/writer.ts` — le modèle rédige seulement ;
   il ne décide ni qu'un motif existe, ni d'un seuil, ni d'une action.
   `derive.ts` dérive l'action candidate ; `proposalSchemas.ts` la valide (Zod).
5. **Proposition** : table `agent_proposals` (`pending` → `accepted` /
   `dismissed` / `expired` à 14 jours). Budget d'intervention : 3 en attente
   au plus, 1 nouvelle par jour. Acceptation →
   `backend/proposals.functions.ts` crée l'objet et note `applied_ref`.

## 5. Proactivité sans IA

`modules/notifications/rules.ts` : règles codées, pures, dédupliquées une fois
par jour (séries de pertes, erreur la plus coûteuse, inactivité, bilan
hebdomadaire, progrès, règle qui glisse, séance propre) + alertes du
calendrier économique (`modules/notifications/economic.ts`). Seuils hauts
volontairement : un canal bruyant finit désactivé.

## 6. Configuration

Variables (liste complète : `.env.example`) : `AI_PROVIDER`, clés
`GEMINI/ANTHROPIC/OPENAI/GROQ/OPENROUTER_API_KEY` (+ `*_MODEL`),
`AI_REQUIRE_PRO`, `AI_RATE_LIMIT_PER_HOUR`, `AI_MEMORY_EXTRACTION`,
`ELEVENLABS_API_KEY`, `TTS_PROVIDER`. Toutes côté serveur.

## 7. Étendre la plateforme

- Nouveau provider → un fichier dans `modules/ai-provider/` + une ligne dans
  `registry.ts`.
- Nouvel outil → `backend/ai-tools/tools.ts`, **lecture seule**, testé
  (`tests/jarvisTools.test.ts`, `tests/jarvisNoDirectWrites.test.ts`).
- Nouvelle action proposée → un `action_type` + un schéma dans
  `modules/patterns/proposalSchemas.ts` + sa création dans
  `backend/proposals.functions.ts`.
- Nouveau motif → un détecteur dans `modules/patterns/detectors.ts` avec ses
  seuils dans `thresholds.ts`.
