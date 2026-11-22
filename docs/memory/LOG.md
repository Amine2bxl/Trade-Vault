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
