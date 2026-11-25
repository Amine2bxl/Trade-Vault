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

## 2026-11-22 — Audit et récupération de la checklist d'origine

- Clone superficiel au départ : `git fetch --unshallow origin main` pour relire
  les 1 051 commits (sans lui, l'historique s'arrête au 2026-09-29).
- Checklist d'origine : `git show d6bec91:src/tradevault/pages/Checklist.tsx`
  (port « Pre-Trade OS »), `git show d6bec91:JARVIS/Jarvis.html` (HUD importé),
  dernière version immersive `git show 54cfb0c^:src/app/features/checklist/Checklist.tsx`.
- Voix : chaîne ElevenLabs « Daniel » → clips `public/voices/` (voix clonée,
  anglais) → navigateur ; `voice.ts` n'est lu que par `scripts/voices/generate.ts`.
- Défaut trouvé : `saveTradeIntent` réécrit `planned_risk` à chaque
  enregistrement (`store/tradeIntel.ts:146-153`) — à corriger au lot A.
- Défaut trouvé : `ctx.violations` écrit, jamais lu (`modules/automation/engine.ts:116`).
- Leçon : `six_month_goals` n'a plus de lecteur ; la table vivante est `goal_plans`.

## 2026-11-22/23 — Lots A à G livrés sur la branche

- Lots livrés : A (prévu figé), B (exécution), C (séance), D (Mode Terminal),
  E (défauts par compte), F (setups manqués), G partiel (Analytics).
- Erreur : `vite dev` refuse `:::8080` dans le conteneur cloud
  (`EAFNOSUPPORT`) — lancer `bunx vite dev --host 127.0.0.1 --port 8080`.
- Banc visuel sans compte : `/dev/ui?screen=trade&plan` (formulaire depuis la
  séance), `?screen=checklist` avec une journée semée dans `tv-chk-anon-<date>`.
- Erreur : `JarvisNeural` sans taille dans un conteneur → boucle
  `ResizeObserver` ; lui donner `className="h-full w-full"`.
- Leçon : les types générés refusent les colonnes non migrées → `as never`
  sur l'écriture + repli `PGRST204`/`42703`, comme le lot 1.

## 2026-11-24/25 — Moteur de capture, respect du plan, Inbox, liens (PR #256)

- Prod : appliquées `plan_vs_execution`, `missed_setup_model`,
  `lifetime_license` (manquait : `subscriptions_plan_check` refusait
  `lifetime`), puis `capture_items`.
- Erreur : `trades.id` est `text` en prod (pas `uuid`) — `capture_items.trade_id`
  corrigé en `text` avant application.
- Erreur : clés i18n `comp.*` déjà prises (accès offerts) — conformité en `compliance.*`.
- Erreur : insérer un import avant la première ligne `import {` multi-ligne
  casse le fichier ; viser la fin du bloc d'import.
- Test réel : preview protégée par SSO Vercel → lien `_vercel_share` (23 h) ;
  compte `tv-capture-e2e@test.dev` créé en SQL (auth.users + identities,
  profil `onboarded_at`). Script : `scratchpad/e2e/run.cjs`.
- Leçon : Gemini ne lit pas toujours un prix de sortie sur l'outil de position ;
  l'issue « cible touchée » suffit à estimer la sortie.
- Banc visuel : `/dev/ui?screen=capture`, `?screen=compliance`.
