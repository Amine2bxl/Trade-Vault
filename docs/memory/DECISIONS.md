# DECISIONS — TradeVault

## D-001 — Le graphe de connaissance est dérivé, jamais stocké
- Date : 2026-11-21 · Statut : acceptée
- Contexte : le cahier des charges Neural Brain proposait `knowledge_entities`, `knowledge_relationships`… Le produit recalcule déjà toutes ses statistiques en mémoire depuis les trades.
- Décision : `modules/knowledge` construit le graphe à l'affichage depuis les sources existantes ; chaque lien porte sa provenance (origine, validation, méthode, sources).
- Alternatives écartées : tables de graphe (duplication, divergence, migration sur la base réelle).
- Conséquences : aucune migration ; coût CPU client au rendu ; un journal très gros demandera un Worker.

## D-002 — Rendu 3D en Canvas 2D, sans three.js
- Date : 2026-11-21 · Statut : acceptée
- Contexte : vue plafonnée à 1 200 nœuds (500 sur téléphone) par le niveau de détail.
- Décision : perspective maison (`features/brain/camera.ts`), disposition force seedée (`modules/knowledge/layout.ts`).
- Alternatives écartées : three.js / 3d-force-graph (~600 Ko, rendu générique, halos contraires au design).
- Conséquences : passage au GPU à prévoir seulement si la vue doit montrer des milliers de nœuds.

## D-003 — Découvertes publiées seulement au-dessus des seuils
- Date : 2026-11-21 · Statut : acceptée
- Décision : deux groupes sur une dimension, `MIN_GROUP` trades + `MIN_GROUP_SESSIONS` (nouveau, 5) séances par groupe, intervalle bootstrap par séances excluant zéro, BH sur tous les tests ; manqués et simulations = hypothétiques sans test.
- Conséquences : peu de découvertes sur un petit journal — dit à l'écran (« c'est aussi un résultat »).

## D-004 — Revues des découvertes dans `user_preferences`
- Date : 2026-11-21 · Statut : acceptée (raccourci)
- Décision : clé `brain.feedback.v1`, empreinte de la preuve gardée pour signaler un changement.
- Alternative écartée : table dédiée (migration sur la base réelle pour quelques dizaines d'entrées).
- Conséquences : à migrer si l'historique des revues doit être interrogé côté serveur.

## D-005 — Lumière bornée dans le canevas du Neural Brain
- Date : 2026-11-21 · Statut : acceptée (demande du propriétaire : « flux lumineux », « connexion qui s'illumine »)
- Décision : lueur additive plafonnée sur nœuds et flux, ciel fixe ; uniquement dans le canevas WebGL.
- Alternatives écartées : halos sur l'interface (contraires à la loi `theme`).
- Conséquences : documentée dans `DESIGN_SYSTEM.md` §1 ; le reste de l'app inchangé.

## D-006 — Combinaisons de conditions validées hors échantillon
- Date : 2026-11-21 · Statut : acceptée
- Contexte : la règle « détecteurs à une dimension » protège des recherches empilées ; le propriétaire demande des combinaisons.
- Décision : deux conditions au plus, chaque combinaison testée comptée dans BH, publication seulement si le sens de l'écart tient sur les 30 % de séances les plus récentes.
- Conséquences : peu de combinaisons publiées sur un petit journal ; c'est voulu.
