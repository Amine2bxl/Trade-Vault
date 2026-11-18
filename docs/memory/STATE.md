# État du projet — TradeVault

Mis à jour : 2026-11-18. Fichier réécrit à chaque mise à jour (60 lignes max).
Historique : `LOG.md`. Décisions détaillées : `DECISIONS.md`.

## Objectif

Journal de trading et espace de performance, avec Jarvis comme coach IA
(« la discipline avant le profit »). Mission en cours : outiller l'environnement
cloud, comprendre, auditer puis optimiser le dépôt (phases A à E).

## État actuel

- Stack : React 19, TanStack Start/Router (SSR Nitro, Vercel), Tailwind v4,
  Supabase (REST + RLS), Recharts, Bun. 628 fichiers TS/TSX dans `src/`,
  62 migrations, 21 features.
- Portes vérifiées le 2026-11-18 sur `58164db` (variables Supabase factices de la CI) :
  typecheck 0 erreur · lint 0 erreur, 83 warnings · build OK ·
  `bun test` 2 154 pass / 0 fail (180 fichiers) en UTC, New York et Auckland.
- Job SQL (`bash scripts/test-sql.sh`, Postgres 16) : non lancé en local.
- Environnement cloud `trade-vault` : script de setup enrichi (ponytail,
  agent-skills, graphify 0.9.112, design stack, MCP Playwright, CLAUDE.md global).
  Appliqué dans la session du 2026-11-18 ; pas encore prouvé dans une session neuve.
- Graphe de code : `graphify update .` (sans LLM, ~15 s), sortie ignorée par git.
- Phase en cours : B (compréhension) terminée, en attente de validation avant C (audit).

## Décisions clés

- D-001 : setup de l'environnement cloud aux versions figées — reproductible, aucune action manuelle.
- D-002 : `graphify-out/` hors git — reconstruit en secondes, évite 9 Mo de bruit.
- D-003 : skills design du dépôt prioritaires sur le design stack global — lois du produit déjà écrites.
- D-004 : mémoire projet dans `docs/memory/`, importée par `CLAUDE.md` — survit aux conteneurs.

## Prochaines étapes

1. Phase C : audit en lecture seule (ponytail-audit, sécurité Stripe/auth/entrées,
   dépendances, couverture des tests, webperf) → `docs/audit/2026-11-18.md`.
2. Phase D : corriger uniquement les points choisis par le propriétaire.
3. Vérifier le setup dans une session neuve (`/ponytail-help`).

## Questions ouvertes

- Langue des commits et commentaires : AGENTS.md impose le français, la consigne
  globale du propriétaire dit anglais. Arbitrage demandé.
- Les plugins installés en cours de session (ponytail, agent-skills) ne sont pas
  chargés avant une session neuve : leurs skills se lisent depuis le cache des plugins.
