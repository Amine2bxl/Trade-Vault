# TradeVault quantitative transformation — execution register

Baseline: `079d185f8e1917ca1ef48321f3e1697064db40ba`. Branch: `feat/quant-correctness-lot0`.

## Lot 0 — Quantitative Correctness: IN PROGRESS

- [x] Confirm tri-state ambiguity in historical adherence.
- [x] Add explicit PASS/FAIL/UNKNOWN for rule evaluation.
- [x] Exclude UNKNOWN from adherence rate and report sample coverage.
- [x] Reject ambiguous same-minute/missing-time ordering for cumulative rules.
- [x] Add tests for future-trade leakage, ties, missing risk and timestamps.
- [x] Initial tri-state change validated by CI run 40360602934.
- [x] Interface Mistakes vérifiée par la CI 40361514924.
- [x] Display unknown-only rules and data coverage on the Mistakes page.
- [x] Ne pas envoyer une conformité partielle à Jarvis/notifications comme preuve exhaustive.
- [ ] Faire évoluer les contrats IA pour exposer les preuves partielles avec couverture.
- [ ] Correct risk historical balance assumptions.
- [x] Fix signed Average R, monthly chart and core label semantics; add regression tests.
- [x] Order intraday drawdown chronologically and report ambiguous ordering.
- [x] Replace fake Profit Factor 99 with a null observation in domain and core consumers.
- [x] Profit Factor nullable vérifié par la CI 40399601185.
- [ ] Vérifier la sémantique des objectifs Profit Factor si la métrique est non calculable.
- [x] Calcul du R réalisé limité aux trades à risque initial connu, avec taille d'échantillon et couverture ; test de régression ajouté.
- [x] Sortino indéfini en absence de volatilité baissière au lieu du plafond fictif 99.
- [x] Dates macro NFP/FOMC du détail de trade fondées uniquement sur l'historique économique non approximatif, avec dates NY reproductibles.
- [x] Comparateur de chronologie extrait dans src/domain/tradeOrder.ts pour préserver le découplage des couches.
- [ ] Replace fictitious import defaults with provenance-aware missing values.
- [ ] Revoir les sessions et tous les fuseaux de calcul ; les badges NFP/FOMC du détail utilisent désormais les événements réels.
- [ ] Vérifier le traitement des drawdowns en cas d'exécutions partielles ou de même minute ; indicateur d'ordre ambigu ajouté.
- [ ] Finish full reference tests, integration tests and regression review.

Do not mark lot 0 DONE or start lot 1 until every applicable gate has been verified.
Do not merge to main without an explicit approval.

## Revue du 26 octobre — état technique de cette session

**Dernier commit applicatif vérifié :** `18ec32f2`.
**GitHub Actions :** [40406362690](https://github.com/Amine2bxl/Trade-Vault/actions/runs/40406362690) — typecheck, lint, build, tests Bun et tests SQL **réussis**, y compris les suites multi-fuseaux.

### Livraisons complémentaires vérifiées

- [x] Règle `stop_after_losses` : seules les pertes effectivement clôturées avant l'entrée sont prises en compte ; heure de clôture absente ou simultanée → UNKNOWN.
- [x] Vérification du pourcentage de risque historique uniquement sur un solde d'entrée fourni explicitement et vérifié ; le solde actuel n'est plus assimilé à celui du passé.
- [x] Messages des règles débarrassés des affirmations causales/statistiques génériques non établies par les données du trader.
- [x] Import Journal : direction prouvée obligatoire, sinon ligne écartée ; le CSV destiné à Monte Carlo garde une lecture P&L seule non persistée.
- [x] Les nouvelles entrées CSV sont `reviewPending` : les notes initiales de qualité et de confiance ne produisent plus de corrélations comportementales tant que le trader ne les a pas revues.
- [x] Saisonnalité visible : données personnelles issues du journal, avec échantillons minimums. Les chiffres historiques de marché approximatifs sont masqués, et leur absence de source vérifiée est expliquée.
- [x] Objectifs PF, R moyen et drawdown : aucune progression affichée comme prouvée si la métrique n'est pas calculable ; les objectifs indisponibles sont exclus des mesures envoyées au coach.
- [x] Régression automatisée de ces changements dans les tests d'import, d'adhérence, de comportement et d'objectifs.

### Travail encore ouvert — NE PAS DÉCLARER LOT 0 DONE

- [ ] Construire un producteur de soldes historiquement vérifiés (avec dépôts, retraits, exécutions et ordre réel). Tant qu'il est absent, les contrôles de risque historiques restent UNKNOWN.
- [ ] Migrer définitivement les champs subjectifs importés vers des valeurs inconnues persistées, et vérifier toutes les interfaces consommatrices. `reviewPending` est un garde-fou transitoire, pas un remplacement du modèle nullable.
- [ ] Brancher une source d'historique de marché fiable et autorisée commercialement pour les tendances saisonnières par actif. Ne pas réactiver les tableaux approximatifs.
- [ ] Vérifier et documenter les sessions de trading avec les fuseaux importés (utilisateur/broker versus America/New_York).
- [ ] Auditer le moteur de notation des trades : exécution 70/100 sans MAE/MFE, valeurs non observées et conclusions comportementales non prouvées.
- [ ] Réconcilier les anciens moteurs Monte Carlo encore utilisés, les règles de trailing intraday et les conventions de Profit Factor.
- [ ] Terminer la migration des valeurs inconnues vers tous les consommateurs et les golden datasets quantitatifs indépendants.
- [ ] Revue finale de la PR et tests complets sur le commit final du lot 0.

**Statut : IN PROGRESS.** Les lots 1 à 6 restent NOT STARTED. Aucune fusion sur `main` sans autorisation.

---

## Réconciliation avec l'audit d'origine — 27 octobre 2026

La correspondance **point par point** entre l'audit stratégique original, le
code et la roadmap est versionnée dans
[`QUANT_AUDIT_COVERAGE.md`](QUANT_AUDIT_COVERAGE.md). Ce document inclut
les 8 anomalies, les décisions produit de chaque page, les méthodes
statistiques, les moteurs de recherche/risque/comportement, les modules
reportés et toutes les sorties des lots 0–6.

### Boucle d'exécution supplémentaire du lot 0

- [x] Revue du moteur `modules/trading/analysis` : mise en évidence des
  notes d'exécution fictives, de l'absence de couverture et des hypothèses
  chronologiques non vérifiées.
- [x] Retirer `executionScore=70` quand les excursions MFE sont absentes,
  signaler `null`, publier un `coveragePct` et aucun score/grade global si
  l'une des composantes manque.
- [x] Ne pas assimiler `mistakes=[]` à une conformité au plan ni une note
  subjective CSV non revue à une mesure de qualité. Exiger un taux de règles
  explicitement vérifié pour la composante discipline.
- [x] Supprimer les accusations causales « stop déplacé », « revenge »
  et « statistiquement pire fenêtre » sans preuve.
- [x] Exclure les pertes futures et les trades non classables par leurs
  timestamps des signaux d'analyse temporels.
- [x] Ajouter `tests/tradeAnalysisEvidence.test.ts` : entrées sans MFE,
  notation subjective, balance historique, pertes futures, couverture et
  scénarios entièrement mesurés.
- [x] Distinguer `avgRR` signé, `avgWinR` positif et `avgLossR` signé,
  uniquement parmi les trades au risque initial connu. Cas sans échantillon
  représentés par `null`.
- [x] Supprimer le plafonnement à 99 d'un Profit Factor réellement calculé
  supérieur à 99 dans les objectifs et ajouter un test de régression.
- [x] Validations CI sur les commits applicatifs, jusqu'au
  [run 40420781901](https://github.com/Amine2bxl/Trade-Vault/actions/runs/40420781901).
- [ ] Revoir les consommateurs de l'analyse de trade sous les conditions de
  production ; les scores restent volontairement non disponibles tant
  qu'aucune preuve d'adhérence vérifiée n'est transmise.
- [ ] Validation financière sur des golden datasets indépendants (fills,
  pics latents, plusieurs sorties, dépôts/retraits, devises, DST).
- [ ] Aucun des blocs L1–L6 n'est terminé ni autorisé à démarrer.

**Statut du lot 0 : IN PROGRESS.** Les validations applicatives
intermédiaires ne constituent pas la sortie complète du lot.

---

## Plan de transformation verrouillé — lots strictement séquentiels

Ce registre est une source de suivi, pas une déclaration de livraison. Le passage
au lot suivant est interdit tant que le lot courant n'est pas DONE et que les
critères de sortie sont satisfaits.

| Lot | Périmètre et responsable technique | Dépendances | Critère de sortie | État |
| --- | --- | --- | --- | --- |
| 0 | Exactitude mathématique : `src/domain`, adhérence et métriques des pages | Historique réel et conventions Trade | Golden datasets, typecheck, lint, build, tests et CI sans régression | IN PROGRESS |
| 1 | Data Integrity : imports CSV, brokers, fills, provenance, données brutes/normalisées | Lot 0, contrats des comptes et migrations additives | Imports idempotents, duplications prouvées, couverture et réconciliation testées | NOT STARTED |
| 2 | EdgeLab + BehaviorLab + Research Engine : analyses conditionnelles, bootstrap par séances, protocoles, règles et expériences | Lots 0–1, historique de qualité suffisante | Résultats reproductibles, limites d'échantillon, absence de fuite temporelle et tests hors échantillon | NOT STARTED |
| 3 | Risk Engine V2 : unification Monte Carlo, stress, dépendances et contraintes de prop firms | Lots 0–2, formats de données et règles documentées | Simulations reproductibles, définitions conformes et scénarios de référence validés | NOT STARTED |
| 4 | Jarvis Intelligence : moteur de preuves, conclusions sourcées, expérience de progression | Lots 0–3 | Aucune métrique non vérifiée présentée comme prouvée ; tests de contrats IA et droits d'accès | NOT STARTED |
| 5 | Product Hardening : tests d'intégration, sécurité, performance, RLS, traductions, UX, abonnements | Lots 0–4 | CI + tests réels applicables, risques résiduels et blocages externes recensés | NOT STARTED |
| 6 | Consolidation : dédoublonnage, structure, docs de référence et contrôle transverse | Lots 0–5 | Tous consommateurs validés, chemins/CI/produit documentés et revue finale terminée | NOT STARTED |

### Lot 0 — Contrôles de sortie encore ouverts

- [ ] Saisonnalité non approximative et événements économiques historiques sourcés, aucune conclusion inférée d'une simple date.
- [ ] Absence des plafonds statistiques fictifs restants (par exemple Sortino et anciens moteurs), avec consommateurs et interfaces migrés.
- [ ] Informations inconnues (direction, risque, qualité, confiance) représentées sans valeurs par défaut inventées, avec adaptation des imports et du modèle.
- [ ] Vérification historique du risque : solde réellement disponible à l'entrée, ou état UNKNOWN en absence de preuve.
- [ ] Réconciliation des règles de pause, des trades simultanés et du P&L avant/après trade.
- [ ] Tests indépendants et bornes de confiance sur l'ordre du drawdown lorsque les heures sont insuffisantes.
- [ ] Une fois tous les calculs migrés : vérifier tous les consommateurs (Dashboard, Analytics, Journal, Goals, Reports, Jarvis).
- [ ] Valider tous les contrôles sur le commit final du lot 0, pas uniquement sur les commits intermédiaires.

### Backlog de moteurs avancés — étude, pas engagement de livraison

- **Execution Forensics** : lot 1/2 selon la présence de fills complets ; coûts d'exécution impossibles à déduire d'un P&L agrégé.
- **RegimeX** : après EdgeLab et l'accès à des OHLC historisés/licenciés.
- **EventQuant** : après la validation du calendrier réel et des séries de prix.
- **Setup Genome** : après taxonomie stable de setups et échantillons suffisants.
- **Risk Correlation** : après exposition notionnelle et timestamps compatibles multi-comptes.
- **Strategy Research Notebook** : à intégrer au lot 2, pas comme page isolée.
- **What Changed Engine** : après les validations temporelles du lot 2.
- **Replay Forensics** : après l'accès/licence aux ticks ou bougies et une méthode replay-safe.

### Règles du registre

1. Chaque changement lié à un calcul doit avoir des preuves reproductibles.
2. Les points bloqués ne sont jamais comptés comme terminés ; la CI seule ne
   prouve ni l'exactitude des données externes ni un comportement en production.
3. Toute intégration sensible, migration irréversible, paiement ou accès broker
   nécessite une vérification réelle avant le statut DONE.
4. Aucun push direct sur `main` et aucune fusion automatique de PR.
