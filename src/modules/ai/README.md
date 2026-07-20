# `modules/ai/` — AI Platform

> L'infrastructure IA de TradeVault : une **plateforme** provider-agnostique
> (router, provider service, context/prompt builder, tool system, response
> formatter), **sans agent métier**. Blueprint : [`docs/AI-ARCHITECTURE.md`](../../../docs/AI-ARCHITECTURE.md).
> Import : `import { … } from "@/modules/ai/infra"`.

## Infrastructure livrée (exécutable, testée)

| Brique | Fichier | Rôle |
| --- | --- | --- |
| **Providers** | `@/modules/ai-provider` | Wire adapters + résolution. **Gemini**, **Anthropic**, **OpenAI-compatible** (OpenAI + endpoints compatibles via `OPENAI_BASE_URL`). Tool-calling natif (OpenAI, Anthropic). |
| **AI Provider Service** | `provider-service.ts` | `generate()` (résolution + retry + hook usage) et `runWithTools()` (boucle de tool-calling provider-agnostique). |
| **Context Builder** | `context-builder.ts` (+ `context.ts`) | Builder fluide et **capé** de `AIUserContext` + sérialisation ancrée. |
| **Prompt Builder** | `prompt-builder.ts` | `buildPrompt()` — system (identité + tâche + format) + injection contexte + rejeu multi-tours. **Aucune persona câblée.** |
| **Tool System** | `tools/types.ts` + `tools/runtime.ts` | Registre + exécution auditée + conversion manifeste provider. Outils permissionnés (`sideEffect`). |
| **Response Formatter** | `response-formatter.ts` | Normalisation + parsing JSON sûr (Zod optionnel) + registre de formats extensible. |
| **AI Router** | `router/router.ts` + `router/types.ts` | `createRouter()` — intention explicite déterministe, classifieur injectable, fallback, hint de modèle. |
| **Télémétrie** | `telemetry.ts` | Forme d'`AgentRun` (branchée via le hook `onUsage`). |
| **Mémoire** | `memory.ts` | Mémoire épisodique (`ai_memory`). |

## Contrats en attente (types seuls, volontairement)

`agents/` (blueprints des 5 agents — **aucun agent implémenté**, c'est voulu),
`jobs/`, `rag/`, `mcp/`. Ce sont les prochains lots (voir [`AI.md`](../../../docs/AI.md)).

## Règles

- **Provider-agnostique** : rien ici ne nomme un vendeur ; changer de modèle = une variable d'env.
- **Déterministe avant IA** : l'IA interprète les scores des moteurs, ne les recalcule jamais.
- **Extension par plug-in** : ajouter une capacité = enregistrer un provider / un outil / un formatter, **sans éditer** l'existant.
- **Sens des dépendances** : `modules/ai` n'importe jamais `app/`.

## Compatibilité providers

| Provider | `complete()` | Tool calling | Activation |
| --- | --- | --- | --- |
| OpenAI-compatible | ✅ | ✅ | `OPENAI_API_KEY` (+ `OPENAI_BASE_URL`, `OPENAI_MODEL`) |
| Anthropic | ✅ | ✅ | `ANTHROPIC_API_KEY` (+ `ANTHROPIC_MODEL`) |
| Gemini | ✅ | — (texte) | `GEMINI_API_KEY` |

Résolution : `AI_PROVIDER` si configuré, sinon le premier provider configuré.
Pour le tool-calling : `resolveToolCapableProvider()` (OpenAI/Anthropic).
