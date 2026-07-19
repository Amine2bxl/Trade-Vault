# `modules/ai/` — Fondation de l'AI Operating System

> **Statut : contrats en attente de runtime.** Ce dossier pose l'architecture
> de l'IA de TradeVault sous forme de **types et de configuration déclarative**,
> avant l'implémentation des systèmes qui les consommeront. Ce n'est **pas du
> code mort** : c'est une source unique de vérité que le produit et les futurs
> implémenteurs partagent. Voir [`docs/AI-ARCHITECTURE.md`](../../../docs/AI-ARCHITECTURE.md).

## Ce qui est vivant aujourd'hui (branché, exécuté)

- **`memory.ts`** — mémoire persistante du coach (`ai_memory`), utilisée par le
  coach conversationnel (P0 #1).
- **`context.ts`**, **`telemetry.ts`**, **`index.ts`** — helpers de contexte et
  d'observabilité consommés par la couche IA côté serveur (`src/backend/ai.functions.ts`).

## Ce qui est un contrat en attente (zéro importeur, volontairement)

| Sous-dossier | Rôle | État |
|---|---|---|
| `agents/` | Catalogue déclaratif des systèmes IA (coach, performance-analyst, psychologist, risk-manager, pattern-finder) : rôle, persona, outils autorisés. **Blueprints, pas d'implémentation.** | Métadonnées ; `run()` à fournir |
| `router/` | Routage intention → agent. Le routage explicite est déterministe ; la classification en texte libre est un stub qui lève une erreur claire (elle nécessite un appel modèle). | Partiel (explicite ok) |
| `tools/` | Contrats des outils que les agents peuvent appeler (`get_stats`, `get_trades`, `search_memory`…). | Types seuls |
| `jobs/` | Contrats des jobs proactifs (insights, weekly review) — le déclencheur de la rétention. | Types seuls |
| `rag/` | Contrats de récupération (embeddings) pour ancrer les réponses. | Types seuls |
| `mcp/` | Contrats d'outils externes (Model Context Protocol). | Types seuls |

## Règle d'or (rappel de la charte)

Les **moteurs restent purs** : ici, aucune logique IA exécutée, aucun IO. L'IA
*interprète* les scores produits par les moteurs (`modules/trading/analysis`,
`modules/discipline`), elle ne les recalcule jamais. Implémenter un système =
fournir un `run()` pour son blueprint et l'enregistrer via `agents/registry.ts`,
**sans éditer** les contrats existants (extension par plug-in).

## Pourquoi garder ces contrats plutôt que les supprimer (YAGNI) ?

Ils cadrent la roadmap IA (P0 #2 insights proactifs, P0 #3 weekly review, P3
systèmes suivants) et garantissent que chaque système futur se branche de la
même façon, provider-agnostique. Le coût de maintenance est nul (types
statiques) ; le bénéfice est une architecture qui ne dérive pas au fil des
ajouts. À réévaluer si un pan reste non implémenté après le Lot 5.
