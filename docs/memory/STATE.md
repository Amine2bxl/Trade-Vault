# État du projet — mémoire de session

Mis à jour : 2026-11-23 (session `claude/charming-bohr-q2pmq1`, PR #255 en brouillon).

## Objectif

Faire de TradeVault un espace de travail qui administre à la place du trader :
séance préparée une fois, trade enregistré en quelques gestes, enrichi et
comparé au plan, exécution jugée indépendamment du P&L, checklist rendue à
son identité de terminal (voix, sons).

## État actuel

- Plan : `docs/superpowers/plans/2026-11-22-espace-de-travail-intelligent.md`.
- **Livrés sur la branche** (un commit par lot, portes vertes) : A (prévu figé,
  prix et plan dans le formulaire), B (qualité d'exécution), C (états de séance,
  limites bloque/avertit, dérogation, pause), D (Mode Terminal, voix, sons),
  E (défauts par compte, setups du plan), F (setups manqués), G partiel
  (carte exécution × résultat dans Analytics).
- **Deux migrations NON appliquées en production** :
  `20261122120000_plan_vs_execution`, `20261122130000_missed_setup_model`.
  Le code a un repli tant qu'elles manquent (le nouveau n'est pas enregistré).
- Restent : G (panneau comportemental du Dashboard, calendrier, objectifs),
  H (note → champs par IA + dictée), I (revues générées, Jarvis enrichi),
  J (modèles d'import).

## Décisions clés

- D-001 : un cerveau (`sessionPlan`), deux peaux (page + Mode Terminal) — appliquée.
- D-002 : le calculé ne se stocke pas ; seules saisies, corrections et
  suggestions IA le sont — appliquée.
- D-003 : le verrou ne bloque jamais l'enregistrement d'un trade réel — appliquée.
- D-004 : voix du terminal — clips d'abord, voix hébergée existante ensuite,
  navigateur en secours ; aucun nouvel achat — appliquée.

## Prochaines étapes

1. Appliquer les deux migrations (accord du propriétaire), puis régénérer
   `integrations/supabase/types.ts` et retirer les `as never` ajoutés.
2. Lot G restant, puis I (revues), H (extraction), J (import).
3. Régénérer les clips (`scripts/voices/generate.ts`) pour les répliques
   ajoutées (verrou de limite, pause, fin de séance) et, au choix, en français.

## Questions ouvertes

- Clips français : ElevenLabs « Daniel » (payant) ou F5-TTS local (gratuit) ?
- MAE/MFE automatiques : fournisseur intraday payant (clé Databento non lue) ?
