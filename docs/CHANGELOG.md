# Changelog

Journal des changements **structurels** (pas des features ni des correctifs,
qui vivent dans l'historique git et les PR).

## 2026-09-30 — Restructuration complète du dépôt

Zéro changement fonctionnel : déplacements, imports, chemins lus par les tests,
suppressions prouvées. Base : `79ae1ff`.

**Code**
- `src/app/pages/` et la majorité de `components/`, `hooks/`, `utils/`
  réorganisés en **features** : `src/app/features/<feature>/` (page +
  composants + logique propres).
- `src/app/shell/` : cadre de l'app connectée (App, navigation, Sidebar…).
- `src/app/public/` : landing, pages légales, contact, tarifs, démo.
- `src/app/trading/` : code trading partagé entre features côté client.
- `src/domain/` devient le noyau pur partagé client/serveur : le type `Trade`
  y est unifié (la copie divergente est supprimée, `app/types.ts` ré-exporte)
  et `tradeCalcs`, `quantStats`, `edgeScore`, `behavioral`, `monthlyReport`,
  `ruleCheck` y sont déplacés. `backend/` et `modules/discipline` n'importent
  plus `app/`.
- `utils/monteCarlo.ts` → `features/monte-carlo/monteCarloEngine.ts` (un nom
  ne différant de `MonteCarlo.tsx` que par la casse bloquait `bun test`).
- Supprimés (aucun importeur, aucune référence) : `app/utils/cn.ts`
  (ré-export ; 59 imports pointent sur `@/shared/ui/cn`), le barrel
  `modules/ai/index.ts` et ce qu'il était seul à charger
  (`agents/catalog.ts`, `agents/registry.ts`, `jobs/types.ts`,
  `mcp/types.ts`), `jarvis/insights/copy/{en,fr}.ts`,
  `jarvis/insights/weekly/types.ts`.

**Documentation**
- Remplacée par un jeu court dans `docs/` (un document par sujet) ; `AGENTS.md`
  devient l'unique source d'instructions pour les agents (`CLAUDE.md` y renvoie).
- Supprimés après migration de leur contenu encore valide : `AUDITS/` (13
  audits PDF de juillet 2026, synthèse, master plan, roadmap d'exécution),
  `docs/planning/`, `docs/architecture/`, `docs/development/`,
  `docs/product/`, `docs/seo/`, `docs/CLAUDE.md`, `docs/PRODUCT-BIBLE.md`,
  `docs/AUDIT-*.md`, `docs/GO-LIVE.md`, `docs/POSITIONNEMENT.md`,
  `docs/PHASE_0_INTELLIGENCE_FOUNDATION.md`, `docs/design/LUCID.md`, et à la
  racine `DESIGN.md`, `ECOSYSTEM_WIRING.md`, `MOTION_AND_PERF.md`,
  `NAVIGATION_REFACTOR.md`, `STRIPE_INTEGRATION.md`,
  `TRADEVAULT_PRODUCT_MASTER_PLAN.md`, ainsi que les README locaux de
  `src/routes`, `src/backend`, `src/modules/ai`, `src/shared/ui`.
- Déplacés : `docs/design/lucid/*` → `docs/assets/lucid/`,
  `docs/CONTENT_HOOKS.md` → `content/hooks.md`.
- Pour relire un ancien document : `git show 79ae1ff:<chemin>` (par exemple
  `git show 79ae1ff:ECOSYSTEM_WIRING.md`). Des commentaires de migrations SQL
  déjà appliquées citent encore ces anciens noms ; ils ne sont pas réécrits.
