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

## 2026-11-21 — Neural Brain v2 (lots A, B, C)
- Bug : WebGL « brain shader: null ». Cause : le démontage (mode strict) appelait
  `loseContext()` ; le remontage récupère le même contexte perdu. Solution : ne
  plus perdre le contexte au `dispose` (`gl/renderer.ts`).
- Bug : graphe minuscule après l'entrée. Cause : une seconde pose (découvertes
  arrivées) relançait le travelling depuis une caméra lointaine. Solution :
  travelling une seule fois (`dollied`, `BrainScene.tsx`).
- Bug de test : une suite arithmétique modulo n'est pas du bruit (elle relie
  un trade au suivant) ; utiliser `makeRng` pour tout contrôle « sur bruit ».
- Playwright : `waitUntil: "networkidle"` n'aboutit pas (polices Google
  injoignables) ; utiliser `load`. WebGL2 en headless :
  `--use-angle=swiftshader --enable-unsafe-swiftshader`.
- Audit sécurité (agent, lecture seule) : 10 constats, dont licence à vie non
  attribuée après un abonnement annulé (`billing.server.ts`), quota IA absent
  sur `generateMyMonthlyReport`, quota gratuit contournable par UPDATE de
  `trade_date`. À vérifier puis corriger dans une PR dédiée.
