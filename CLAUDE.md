@AGENTS.md

## Sous-agents (Claude Code)

- Déléguer seulement : recherche large (plus de ~10 fichiers), sortie volumineuse à résumer (logs, suite de tests), tâches indépendantes en parallèle. Tâche courte : rester dans le fil principal (un sous-agent repart de zéro et relit).
- Localiser / lire : `caveman:cavecrew-investigator` (déjà sur Haiku) ou `Explore` avec `model: haiku` explicite — sans ce paramètre, `Explore` tourne sur Opus avec un abonnement.
- Édition mécanique bornée (renommage, 1–2 fichiers) : `model: sonnet`.
- Rester sur Opus (fil principal ou agent qui hérite) : architecture, debug difficile, sécurité et RLS, moteurs de chiffres (`src/domain/`, `src/modules/`), design.
- Ne jamais forcer un modèle unique (`CLAUDE_CODE_SUBAGENT_MODEL_FORCE`) : `security-auditor` et `code-reviewer` passeraient sur Haiku.
