# État du projet — mémoire de session

Mis à jour : 2026-11-22 (session `claude/charming-bohr-q2pmq1`).

## Objectif

Faire de TradeVault un espace de travail qui administre à la place du trader :
séance préparée une fois, trade enregistré en quelques gestes, enrichi et
comparé au plan, exécution jugée indépendamment du P&L, checklist rendue à
son identité de terminal (voix, sons).

## État actuel

- Audit complet et récupération de la checklist d'origine faits ; plan en
  lots A→J : `docs/superpowers/plans/2026-11-22-espace-de-travail-intelligent.md`.
- **Aucun code modifié.** Plan en attente de validation (4 décisions, §8 du plan).
- `main` @ `58164db` ; lots 0–6 de l'audit quant tous fusionnés.

## Décisions clés

- D-001 : garder le moteur `sessionPlan` (Plan → Séance → Bilan) et rendre
  l'identité d'origine par un Mode Terminal — proposée.
- D-002 : valeurs calculées dérivées à la lecture, jamais stockées ; seules
  saisies, corrections et suggestions IA le sont, avec leur origine — proposée.
- D-003 : VERROUILLÉE ferme la porte d'entrée de la checklist, n'empêche jamais
  d'enregistrer un trade réel — proposée.

## Prochaines étapes

1. Obtenir les 4 décisions du §8 (voix, couleur du terminal, verrouillage, ordre).
2. Lot A : corriger l'intention réécrite (`store/tradeIntel.ts:146-153`), figer
   le prévu (entrée, stop, cible, scénario), stop et cible réels en prix.
3. Lot B : moteur de qualité d'exécution séparé du P&L, bilan pré-rempli.

## Questions ouvertes

- Voix FR : clips ElevenLabs « Daniel » (payant), F5-TTS local (gratuit) ou
  navigateur seul ?
- Couleur du Mode Terminal : jetons du thème ou cyan d'origine `#22d3ee` ?
- MAE/MFE automatiques : fournisseur intraday payant (clé Databento non lue) ?
