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
- [ ] Propagate evidence coverage to Jarvis and notifications.
- [ ] Correct risk historical balance assumptions.
- [x] Fix signed Average R, monthly chart and core label semantics; add regression tests.
- [x] Order intraday drawdown chronologically and report ambiguous ordering.
- [x] Replace fake Profit Factor 99 with a null observation in domain and core consumers.
- [x] Profit Factor nullable vérifié par la CI 40399601185.
- [ ] Vérifier la sémantique des objectifs Profit Factor si la métrique est non calculable.
- [ ] Replace fictitious import defaults with provenance-aware missing values.
- [ ] Fix all affected drawdown chronology, macro events and session timezones.
- [ ] Finish full reference tests, integration tests and regression review.

Do not mark lot 0 DONE or start lot 1 until every applicable gate has been verified.
Do not merge to main without an explicit approval.

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
