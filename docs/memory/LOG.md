# Journal

Ajout seulement, entrées datées.

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
