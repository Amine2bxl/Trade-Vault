# TradeVault — couverture de l'audit stratégique du 26 octobre 2026

**Source de référence :** audit en 15 sections partagé dans la conversation du 27 octobre.
**Base revue :** `main@079d185f` ; branche de travail `feat/quant-correctness-lot0` ; PR #234.
**Règle :** DONE signifie livré, testé, consommateurs revus ET validé par la CI finale du lot.
La CI et les corrections ponctuelles ne suffisent pas pour déclarer tout le chantier terminé.

## Statuts et propriétaire
- **PARTIAL** : correction locale présente, mais critère final incomplet.
- **OPEN** : non livré ou vérification toujours requise.
- **DEFERRED** : report intentionnel motivé, non compté comme DONE.
- **OWNER** : lot responsable, et non une personne désignée.

## A — Huit anomalies critiques de la section 2

| ID | Problème exact de l'audit | Responsable / priorité | Dépendances | État vérifié | Acceptation |
| --- | --- | --- | --- | --- | --- |
| A1 | Saisonnalité marché approximative | L0/L1 P0 | Séries OHLC fiables + licence | PARTIAL : séries fictives masquées ; journal réel affiché | Source, période, ajustements, tests reproductibles ; aucune série approximative exposée |
| A2 | Average R:R utilise `abs` | L0 P0 | Risque initial sourcé | PARTIAL : R signé, couverture exposée | Distinguer R réalisé, gain moyen R et perte moyenne R ; tous consommateurs concordent |
| A3 | Profit Factor `99` fictif | L0 P0 | Convention PF nullable | PARTIAL : moteur central + consommateurs majeurs migrés | Aucun `99` substitut dans les moteurs actifs, objectifs et exports ; cas sans perte documenté |
| A4 | Edge Score redondant auto-déclaratif | L0/L2 P0 | Règles vérifiées et couverture | OPEN : `domain/edgeScore.ts` récompense encore cleanTrades 35 % + cleanDays 25 % | Score non amélioré par suppression de tags ; mesures prouvées, inobservables marquées |
| A5 | Trade Analysis attribue 70/100 sans MFE | L0 P0 | Modèle evidence-aware | PARTIAL : correctif `modules/trading/analysis` en cours de validation | Score null si composante non mesurable ; couverture ; aucun diagnostic causal inventé |
| A6 | CSV défaut long / qualité 3 / confiance 50 | L0 puis L1 P0 | Migration additive des champs et consommateurs | PARTIAL : le Journal exige direction ; `reviewPending` neutralise signaux subjectifs ; valeurs stockées non-null | Inconnus persistés comme tels, import/export/broker/IA/UI compatibles |
| A7 | Drawdown sans ordre intrajournalier | L0 P0 | Horodatages et fills normalisés | PARTIAL : tri canonique, indicateur d'ambiguïté | Référence indépendante avec simultanéité, positions partielles, ordre d'exécution |
| A8 | FOMC/NFP calendrier présumé | L0 P0 | Cache économique sourcé + TZ NY | PARTIAL : détail trade vérifié via événements réels ; autres consommateurs à auditer | Tous usages du calendrier historisé, aucun jour NFP supposé |

## B — Vérification des règles de trading (section 4)

| ID | Tâche | Owner/priorité | Dépendances | État | Acceptation |
| --- | --- | --- | --- | --- | --- |
| B1 | Verdicts PASS / FAIL / UNKNOWN | L0 P0 | Dates, risque, historiques | PARTIAL : coeur et Mistakes implémentés | Tous consommateurs propagent status et couverture |
| B2 | Exclure UNKNOWN des taux et éviter les fuites futures | L0 P0 | Entrées/sorties fiables | PARTIAL : protections et tests réalisés | Cas minuit, DST, positions ouvertes, simultanéité démontrés |
| B3 | Vérifier risque au solde réellement disponible à l'entrée | L0 P0 | Historique dépôts/retraits/exécutions | OPEN : absent → UNKNOWN | Preuves de chaque solde, aucun substitut de solde actuel |
| B4 | Empêcher les notifications/IA de conclure sur une preuve partielle | L0/L4 P0 | Objet Evidence | PARTIAL : affirmation chiffrée complète uniquement | Contrat Evidence avec méthode/source/échantillon/limitations, tests IA |

## C — Destin de chaque fonctionnalité existante (section 6)

| Surface | Décision de l'audit | Owner/priorité | État / dépendances | Critère de sortie |
| --- | --- | --- | --- | --- |
| Dashboard | Diagnostic prioritaire, réduire KPI | L4/L5 P1 | OPEN ; moteurs de preuve | Une conclusion prioritaire sourcée, pas de score trompeur |
| Journal | Exécutions et audit de trade traçable | L1 P0 | PARTIAL ; imports et fills | Détail reconstituable, sources et couverture |
| Analytics | Incertitude, conditionnels, hors échantillon | L2 P0 | OPEN ; données normalisées | CIs/échantillon/OOS reproductibles |
| Monte Carlo | Stress, dépendance, prop firm | L3 P0 | OPEN ; moteur existant | Modes séparés, règles et limites testées |
| Jarvis | Analyste de preuves, pas d'affirmation gratuite | L4 P0 | PARTIAL ; contrats incomplets | Référence aux observations/méthodes/limites |
| Checklist | Préparation reliée aux règles | L4/L5 P1 | OPEN | Correspondance pré/post-session mesurable |
| Calendar P&L | Navigation anomalies/revues | L5 P2 | OPEN | Accès aux événements et preuves |
| Calendrier économique | Sources, timestamps, conditions | L0/L2 P0 | PARTIAL | Reconstitution historique et TZ |
| Saisonnalité | Reconstruction par OHLC historiques | L0/L1/L2 P0 | PARTIAL / donnée de marché manquante | Exclure approximations ; reconstituer échantillons par actif |
| Erreurs | Intégrer au Behavior Engine | L2/L5 P1 | OPEN ; conserve page actuelle | Pas de classement causal sans preuves |
| Setups manqués | Occasion observée ≠ opportunité prouvée | L2 P1 | OPEN ; historique marché | Séparer étiquettes et contrefactuels |
| Rapports mensuels | Synthèses de recherche testée | L4/L5 P1 | OPEN | Reproduire résultats/versions/périodes |
| Goals | Objectifs processus, métriques disponibles | L0/L4 P1 | PARTIAL ; PF/R null gérés | Processus vérifiables et baselines comparables |
| Trading Plan | Règles versionnées | L2 P1 | OPEN ; règles persistées sans version temporelle | Règles applicables à la date du trade |
| Calculateur de position | Frais, slippage, limites | L3/L5 P1 | OPEN | Risque restant documenté et cas broker comparés |
| Brokers | Réconciliation des données/fills | L1 P0 | OPEN ; OAuth réel et sync | Import idempotent, totaux rapprochés |
| Inbox | Notifications ciblées | L4/L5 P2 | OPEN | Alertes fondées sur conséquences vérifiables |
| Profil | Préférences pertinentes | L5 P2 | OPEN | Cohérence des réglages |
| Appearance | Gel nouvelles variantes | L5 P3 | DEFERRED : éviter travail cosmétique | Aucune régression thème existant |
| Settings | Simplification, suppression doublons | L5/L6 P2 | OPEN | Navigation et préférences testées |
| Subscription | Valeur et parcours réel | L5 P0 | OPEN ; Stripe et contrôle externe | Parcours payants/retour Free/webhook vérifiés |

## D — Moteurs, études et méthodes scientifiques (sections 5, 7, 8, 9, 10)

| ID | Fonction attendue | Lot / priorité | Précondition | État / acceptation |
| --- | --- | --- | --- | --- |
| D1 | DATA ENGINE — provenance, normalisation, score qualité | L1 P0 | L0 | OPEN : raw immutable, anomalies explicites, idempotence |
| D2 | EDGE ENGINE / EdgeLab — expectancy conditionnelle | L2 P0 | L1 | OPEN : sous-groupes, CIs, échantillons et OOS |
| D3 | BEHAVIOR ENGINE / BehaviorLab | L2 P0 | B1-B4 | OPEN : expériences de règles vérifiables et scénarios contrefactuels honnêtes |
| D4 | RESEARCH ENGINE / Strategy Research Notebook | L2 P0 | D1-D3 | OPEN : hypothèse/protocole/version de données/holdout verrouillé |
| D5 | RISK ENGINE / PropRisk | L3 P0 | L2 | OPEN : barrières, règles de contrat versionnées, sur-risk, consistance |
| D6 | Jarvis Intelligence Layer / Evidence Store | L4 P0 | D1-D5 | OPEN : `metricId`, sources trades, couverture, période, méthode, limitations |
| D7 | Bootstrap par séances | L2 P0 | Horodatages | OPEN : blocs par jour, référence analytique indépendante |
| D8 | CI ou crédibilité / puissance d'échantillon | L2 P0 | D2 | OPEN : incertitude explicite et cas faible puissance |
| D9 | Validation temporelle hors échantillon | L2 P0 | Research Engine | OPEN : aucune fuite temporelle, holdout immuable |
| D10 | Correction tests multiples | L2 P0 | D8-D9 | OPEN : contrôle FDR ou méthodologie déclarée |
| D11 | Sensibilité, stress des frais, valeurs extrêmes | L2/L3 P0 | D1 | OPEN : scénarios explicites et reproductibles |
| D12 | Monte Carlo historique / stress / blocs & régimes | L3 P0 | D7/D11 | OPEN : trois modèles séparés, distributions vérifiées |
| D13 | Trailing prop firm basé sur pic LATENT | L3 P0 | Fills/ticks | OPEN : approximation signalée en leur absence |
| D14 | Unifier simulateur non monté et Monte Carlo visible | L3 P1 | D12 | OPEN : moteur canonique, conserver capacités utilisées |
| D15 | Expériences de progression / règle suivie | L2/L4 P0 | D3/D6 | OPEN : version, cohorte, limites et suivi multi-séances |

### Modules avancés explicitement classés

| Module | Décision | Condition de réexamen |
| --- | --- | --- |
| Execution Forensics | DEFERRED → étude dans L1/L2 | Fills normalisés + coûts exacts |
| RegimeX | DEFERRED | OHLC fiables, segmentation testable |
| EventQuant | DEFERRED | Calendar + OHLC horodatés et licenciés |
| Setup Genome | DEFERRED | Taxonomie stable + échantillon |
| Risk Correlation | DEFERRED | Notionnel et superposition positions/comptes |
| What Changed Engine | DEFERRED | Fenêtres OOS et incertitude |
| Replay Forensics | DEFERRED | Rejeu sans future leak + données licenciées |
| Crypto DeFi/memecoins, blockchain, DCF actions, prédicteur NQ | OUT OF SCOPE | Aucun ajout : diluerait la cible futures/prop firms |

## E — Architecture, suppression, qualité et opérations (sections 11–13)

| ID | Livrable | Owner/priorité | État et contrôle |
| --- | --- | --- | --- |
| E1 | Flux raw → validation → canonical trade → moteurs versionnés → Evidence → surfaces | L1–L4 P0 | OPEN : contrats de provenance et versions |
| E2 | Préserver migrations additives et utilisateurs existants | Chaque lot P0 | GATE : aucun schéma destructif, rollback documenté |
| E3 | Golden datasets indépendants et invariants | L0 puis chaque lot P0 | OPEN : multi-exécutions, DST, fills, frais, PF, propagation UNKNOWN |
| E4 | Évaluer les tests en production/charge | L5 P0 | OPEN : preuves test/preview/replay |
| E5 | RLS, confidentialité, accessibilité/zoom | L5 P0 | OPEN : audit et validation manuelle |
| E6 | Stripe abonnement/annulation/3DS/webhooks | L5 P0 | OPEN : compte test et secrets nécessaires |
| E7 | Broker OAuth et synchronisation réelle | L1/L5 P0 | OPEN : permissions, déduplication, migrations, vérification réelle |
| E8 | Traductions, navigation, mauvais composants montés | L5/L6 P1 | OPEN : couverture de toutes les langues et reachability |
| E9 | Nettoyer moteurs IA jamais branchés et calculs redondants | L6 P1 | OPEN : usage vérifié avant suppression |
| E10 | Faire concorder `public/llms.txt` et intégration broker | L5/L6 P1 | OPEN : fact-check documentation publique |
| E11 | `main` protégée, branches par lots, PR revue | Chaque lot P0 | PARTIAL : PR dédiée, mais protection de branche à vérifier |
| E12 | Restructuration repo et docs finales | L6 P0 | NOT STARTED : ne pas déplacer de code avant validation des lots |
| E13 | Revue transverse finale (moteurs, IA, UI, sécurité, abonnements) | L6 P0 | NOT STARTED : données et sorties cohérentes |

## Ordonnancement et boucle d'exécution

`Lot 0 → Lot 1 → Lot 2 (EdgeLab + BehaviorLab + Research Engine) → Lot 3 (Risk/PropFirm) → Lot 4 (Jarvis) → Lot 5 (Hardening) → Lot 6 (Consolidation)`.

**Pour chaque tâche :** AUDIT → PLAN → IMPLÉMENTATION → TESTS → REVUE → CORRECTIONS → NOUVEAUX TESTS → VALIDATION. Aucun DONE sans test d'intégration applicable, source/référence indépendante et consommateurs vérifiés.

**Interdictions :** ne pas fusionner sur `main`, inventer des balances/échéances/plafonds, désactiver des tests pour passer, réintroduire des statistiques de marché approximatives ou passer au lot suivant lorsqu'un P0 reste bloqué.

**Registre d'exécution :** `docs/QUANT_CORRECTNESS_PROGRESS.md`. Ce document est la matrice de traçabilité de l'audit d'origine. Une case OPEN ne doit jamais être masquée par le succès de la CI.
