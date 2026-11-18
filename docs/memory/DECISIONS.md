# Décisions — TradeVault

Ajout seulement. Une décision remplacée est marquée « Remplacée par D-XXX »,
jamais effacée.

## D-001 — Setup de l'environnement cloud aux versions figées

- Date : 2026-11-18
- Statut : acceptée (validée par le propriétaire)
- Contexte : chaque session cloud part d'un conteneur neuf ; l'environnement
  `trade-vault` ne faisait que `bun install`, sans les outils de l'environnement
  Default.
- Décision : le script de setup de l'environnement installe, à des versions
  figées, graphify 0.9.112 (PyPI), les plugins ponytail (`96608e07`) et
  agent-skills (`39b723ce`), le design stack (emil-design-eng et choreograph
  `0f2e23b3`, impeccable `2b86d9c0`, design-taste-frontend `f6b76575`), le MCP
  Playwright `@playwright/mcp@0.0.84` sur `/opt/pw-browsers/chromium`, puis écrit
  le `~/.claude/CLAUDE.md` global. Chaque ajout se termine par `|| true` ; le bloc
  CLAUDE.md est gardé par un `grep` (idempotent) ; la ligne `bun install` d'origine
  reste la dernière et garde son code de sortie.
- Alternatives écartées : hook SessionStart commité dans le dépôt (lie l'outillage
  personnel au dépôt) ; installation manuelle à chaque session (oubliée, non reproductible).
- Conséquences : démarrage d'un conteneur neuf plus long (17,5 s mesurées en
  simulation, 30 s dans la session avec réseau ; 40 Mo de photothèque pour
  design-taste-frontend). Script : 95 lignes sur 100 permises.
  Sauvegarde de l'ancien script dans le LOG du 2026-11-18.

## D-002 — `graphify-out/` hors git

- Date : 2026-11-18
- Statut : acceptée (consigne du propriétaire)
- Contexte : le graphe pèse 9,2 Mo et se reconstruit sans LLM en ~15 s.
- Décision : `graphify-out/` dans `.gitignore` ; `graphify update .` en début de
  session quand le graphe sert. Ni hook ni `graphify watch`.
- Alternatives écartées : commiter le graphe (bruit dans chaque diff, vite périmé).
- Conséquences : le graphe doit être reconstruit dans chaque conteneur neuf.

## D-003 — Skills design du dépôt prioritaires sur le design stack global

- Date : 2026-11-18
- Statut : acceptée (consigne du propriétaire)
- Contexte : le design stack global (impeccable, emil-design-eng,
  design-taste-frontend) s'applique à tous les projets ; TradeVault a ses propres
  lois (langage Liquid, skills `.claude/skills/` : ship-ui, theme, ui-design…).
- Décision : sur ce dépôt, les skills du dépôt priment ; ligne ajoutée dans `CLAUDE.md`.
- Conséquences : en cas de conflit (durées, couleurs, ombres), la règle du dépôt gagne.

## D-004 — Mémoire projet dans `docs/memory/`

- Date : 2026-11-18
- Statut : acceptée (consigne du propriétaire)
- Contexte : la mémoire automatique (`~/.claude/projects/`) est effacée à chaque
  session cloud.
- Décision : `STATE.md` (réécrit), `DECISIONS.md` et `LOG.md` (ajout seulement),
  commités avec le travail ; `CLAUDE.md` importe `@docs/memory/STATE.md`.
- Conséquences : à mettre à jour après chaque décision validée, fonctionnalité
  finie ou bug non trivial ; jamais de secret.
