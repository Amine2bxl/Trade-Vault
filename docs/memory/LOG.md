# LOG — TradeVault

## 2026-11-21 — Neural Brain lot 1
- Audit phase 0 → `docs/NEURAL_BRAIN.md` §2.
- Livré : `modules/knowledge`, `features/brain`, `get_discoveries`, `?open=`.
- Bug : canevas vide en dev. Cause : en mode strict React, le nettoyage
  annulait la frame sans remettre `frame.current` à 0 → plus aucune frame
  planifiée. Solution : remise à 0 dans le nettoyage (`GraphCanvas.tsx`).
- Bug : vue d'ensemble déconnectée (trades masqués = moyeux sans liens).
  Solution : liens `shares_trades` agrégés dans `view.ts`.
- Commandes utiles :
  - banc visuel sans compte : `VITE_SUPABASE_URL=http://127.0.0.1:9 VITE_SUPABASE_PUBLISHABLE_KEY=dev-dummy bunx vite dev --host 127.0.0.1` puis `/dev/ui?screen=brain` (le conteneur cloud n'a pas d'IPv6 : `bun run dev` échoue sur `:::8080`).
  - `bunx prettier --write <fichiers>` avant `bun run lint` (5 min).
- Leçon : `expect(x, message)` de bun n'expose pas `toBeTruthy` au typage.
