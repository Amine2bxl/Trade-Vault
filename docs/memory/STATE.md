# STATE — TradeVault

## Objectif
Journal de trading + espace de performance, Jarvis comme coach IA. Chantier en
cours : **Neural Brain** (graphe de connaissance 3D + découvertes), cahier des
charges en 10 phases — voir `docs/NEURAL_BRAIN.md`.

## État actuel (2026-11-21)
- Branche `claude/magical-allen-dpuret` : Neural Brain lot 1 livré.
  - `src/modules/knowledge/` : graphe dérivé (aucune table), provenance par
    lien, 9 détecteurs de découvertes (BH global), disposition 3D, vue.
  - `src/app/features/brain/` : page `/brain` (section dédiée), canevas 3D,
    inspecteur, découvertes + revue, recherche, filtres, frise, `?node=`.
  - Liens profonds `?open=` (Journal, Setups manqués), conversation Jarvis par id.
  - Outil Jarvis `get_discoveries` (lecture seule).
- Portes : typecheck, lint (fichiers touchés), build, tests (3 fuseaux) verts.

## Décisions clés
- D-001 : graphe DÉRIVÉ à l'affichage, aucune table de nœuds/liens — une seule source de vérité.
- D-002 : rendu Canvas 2D maison, pas three.js — volume borné par le niveau de détail, ~600 Ko évités.
- D-003 : découvertes = moteurs déterministes existants (bootstrap par séances, BH global, seuils `thresholds.ts`) ; Jarvis formule.
- D-004 : revues des découvertes dans `user_preferences` (`brain.feedback.v1`), pas de migration.

## Prochaines étapes
- Extracteurs manquants : objectifs, plan de trading, checklist/séances, intent/reflection.
- Découvertes : scan nocturne + notification ; Worker si gros journal.
- Phases 2/6/7 (multimodal, recherche web, multi-agents) : demandent fournisseurs payants → accord du propriétaire.

## Questions ouvertes
- Fournisseur d'embeddings / vision / recherche web : lequel, quel budget ?
- Conversations Jarvis encore par appareil (localStorage) : synchroniser côté serveur ?
