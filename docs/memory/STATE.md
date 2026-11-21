# STATE — TradeVault

## Objectif
Journal de trading + espace de performance, Jarvis comme coach IA. Chantier en
cours : **Neural Brain** (environnement immersif : graphe 3D, découvertes,
simulation, évolution) — voir `docs/NEURAL_BRAIN.md` (§6 bis = v2).

## État actuel (2026-11-21)
- Branche `claude/magical-allen-dpuret`, PR #254 (brouillon), CI verte au dernier push.
- Lot 1 + v2 (lots A, B, C) livrés : `src/modules/knowledge/` (graphe dérivé,
  behavior/bibliothèque d'erreurs, 20 détecteurs, simulate, evolution) et
  `src/app/features/brain/` (plein écran WebGL2, 4 modes, Worker, sons).
- Portes : typecheck, lint (fichiers touchés), build, 2 222 tests × 3 fuseaux.
- Audit sécurité (agent) : 10 constats backend à trier — voir LOG 2026-11-21.

## Décisions clés
- D-001 : graphe DÉRIVÉ, aucune table de nœuds/liens.
- D-002 : rendu maison (Canvas 2D puis WebGL2), pas three.js.
- D-003 : découvertes au-dessus des seuils (n, séances, IC bootstrap, BH global).
- D-004 : revues dans `user_preferences` (`brain.feedback.v1`).
- D-005 : lumière bornée permise DANS le seul canevas du Neural Brain.
- D-006 : combinaisons à deux conditions publiées seulement si confirmées sur les séances récentes.

## Prochaines étapes
- Vérifier sur un vrai compte ; mesurer sur un gros journal (Worker déjà en place).
- Trier/corriger les constats de l'audit sécurité (facturation licence, quota IA des rapports).
- Extracteurs objectifs, plan de trading, checklist/séances.

## Questions ouvertes
- Fournisseurs payants (embeddings, vision/OCR, recherche web) : lesquels, quel budget ?
- « Confirm email » est-il activé dans Supabase ? (conditionne un constat élevé de l'audit)
