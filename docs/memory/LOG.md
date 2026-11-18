# Journal — TradeVault

Ajout seulement, entrées datées : changements importants, erreurs (cause,
solution), commandes utiles, leçons.

## 2026-11-18 — Outillage de l'environnement et compréhension du dépôt

### Changements
- Environnement cloud `trade-vault` : script de setup remplacé (1 → 95 lignes),
  voir D-001. Ancien script, conservé ici comme sauvegarde :
  `if [ -d Trade-Vault ]; then (cd Trade-Vault && bun install); fi`
- Vérifié dans un HOME vide (`env -i`) puis dans la session : plugins ponytail et
  agent-skills `enabled` aux bons `gitCommitSha`, graphify 0.9.112, 4 skills design,
  MCP Playwright `Connected`, idempotent sur 3 passages.
- `graphify-out/` ajouté au `.gitignore` (D-002). Mémoire `docs/memory/` créée (D-004).

### État mesuré (commit `58164db`)
- `bun run typecheck` : exit 0 (18 s). `bun run lint` : 0 erreur, 83 warnings (22 s).
- `bun run build` : exit 0 (33 s), aucun fichier suivi modifié.
- `bun test` : 2 154 pass, 0 fail, 180 fichiers — identique sous
  `TZ=America/New_York` et `TZ=Pacific/Auckland`.
- graphify : 6 354 nœuds, 19 174 arêtes, 250 communautés ; 1 cycle d'import
  (`missed/MissedOpportunities.tsx` ↔ `MissedSetupDetailModal.tsx`).

### Commandes utiles
- Portes comme la CI (sans toucher la base réelle) :
  `SUPABASE_URL=http://localhost:54321 SUPABASE_ANON_KEY=dummy SUPABASE_PUBLISHABLE_KEY=dummy bun run typecheck`
  puis `lint`, `build`, `bun test`, `TZ=America/New_York bun test`, `TZ=Pacific/Auckland bun test`.
- Graphe : `graphify update .` puis `graphify query "…"`, `graphify explain "X"`,
  `graphify path "A" "B"`, `graphify affected "X"`.
- Points d'entrée sensibles : Stripe `src/backend/billing.server.ts`
  (`openCheckoutSession`, `verifyStripeSignature`, `handleStripeWebhook`,
  `markWebhookProcessed`) ; auth `src/integrations/supabase/` et
  `src/app/contexts/AuthContext.tsx` ; service role `serviceClient()`.

### Leçons
- `graphify install --platform claude` écrit lui-même une section `# graphify` en
  tête de `~/.claude/CLAUDE.md` et ajoute une ligne vide au 2e passage ; stable ensuite.
- Plugins installés en cours de session : non chargés avant une session neuve.
- graphify ne lit pas les `.sql` sans l'extra `graphifyy[sql]` : 72 fichiers SQL,
  dont les 62 migrations, sont absents du graphe.
