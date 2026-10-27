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

## Reprise du 27 octobre — Edge Score v2 (correctif validé)

- [x] Suppression des deux mesures corrélées calculées sur l'absence de tags d'erreur.
- [x] Suppression de la limite de risque arbitraire issue de 1,5 fois le risque médian.
- [x] Adhérence déduite uniquement de verdicts par trade explicitement vérifiés ; UNKNOWN ne devient pas PASS.
- [x] Risque calculé uniquement avec un solde vérifié avant l'entrée et un plafond attesté historiquement.
- [x] Couverture pondérée indépendante de la note, exigence de 10 trades sur 5 séances au minimum.
- [x] Checklist indicative, exclue de la note de discipline.
- [x] Historique du score versionné sous tv.edge.v2.* : pas de mélange des algorithmes.
- [x] UI et réponse de l'outil Jarvis adaptées à une note indéterminable.
- [x] Tests de suppression frauduleuse des tags, couverture partielle, risque, séances et continuité.
- [x] CI complète vérifiée : GitHub Actions #40477601517, succès (typecheck, lint, build, tests multi-TZ et SQL).
- [ ] Bloquant : aucune source de règles historiquement versionnées ni d'equity à l'entrée n'alimente encore le score.
- [ ] Vérifier les parcours Dashboard/Jarvis sur données réelles et réconcilier les scores affichés.

Le Score d'Edge reste intentionnellement null sur les comptes sans historique vérifié.
Ce n'est PAS un achèvement du lot 0. Les lots 1–6 restent NON COMMENCÉS.

---
## Validation de la roadmap et séparation des dépendances — 27 octobre 2026

Programme **approuvé** par le propriétaire pour les lots 0 à 6, avec trois
clarifications obligatoires :

1. **Lot 0 — validité des calculs, pas disponibilité magique des historiques.**
   Les moteurs doivent être exacts avec des fixtures indépendantes, retourner
   `UNKNOWN` / `null` quand les entrées sont invérifiables et informer tous
   les consommateurs pertinents. L'absence de broker OAuth ou d'un flux
   d'equity historique ne peut pas être maquilllée en preuve.
2. **Lot 1 — provenance et historiques.** Reconstruction idempotente des
   exécutions, dépôts/retraits, soldes à chaque entrée, dates UTC et fuseaux
   source via des imports/brokers autorisés. Ce lot seul peut activer les
   vérifications historiquement dépendantes de ces entrées.
3. **Données de marché sous licence** : les fonctionnalités de saisonnalité
   par actif sont reportées tant qu'aucune série historique utilisable
   commercialement n'est disponible. Les approximations ne seront pas réactivées.
4. **Tests commerciaux et partenaires réels** : pas de DONE pour une
   intégration Stripe/Tradovate non vérifiée en environnement autorisé.
5. **Branches dédiées et PR traçables**, aucune écriture directe sur main ni
   fusion automatique.

### Lot 0 — Ajouts et corrections de cette reprise

- [x] Analyse des heures de session : refuser heures impossibles, y compris
  horaires hors 24 h et minutes invalides.
- [x] Conventions de récupération après drawdown : distinguer récupération
  intrajournalière (0 jour) d'absence de récupération (-1).
- [x] Tri du P&L réalisé par heure de **clôture**, sans modifier le tri
  par entrée du Journal ; sorties simultanées / overnight restent invérifiables.
- [x] Rapports mensuels et données fournies à Jarvis ne publient pas un
  drawdown « exact » lorsque l'ordre de clôture n'est pas prouvé.
- [x] Réconciliation des erreurs : P&L des trades multi-tags compté une seule
  fois dans l'agrégat, sans attribution causale.
- [x] Sessions broker : heures importées sans fuseau source ne sont pas
  arbitrairement considérées comme heure Eastern ; exclusions et avertissement
  visible dans Analytics.
- [x] Scénarios de tests indépendants ajoutés : clôtures superposées,
  passage à minuit, égalité des timestamps, sessions inconnues, P&L multi-tags.
- [ ] Confirmer les tests complets sur le commit final de ces modifications.
- [ ] Revue transversale de tous les consommateurs et gestion des rapports
  préexistants, pouvant contenir d'anciens agrégats non vérifiés.
- [ ] Validation d'accessibilité/visualisation réelle en préproduction.

**Lot 0 toujours IN PROGRESS ; lots 1–6 NOT STARTED.**

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

## Reprise lot 0 — vérification des conventions de dates et de risque

- [x] Inspection : `quantStats.getSession` acceptait des heures impossibles telles que 24:00 et 09:60 ; mêmes invalidités dans les agrégats horaires.
- [x] Parser 24 h explicite partagé avec les buckets ; calcul du jour de semaine indépendant du fuseau de l'appareil.
- [x] Corriger le calcul de `recoveryDays` : une récupération après le creux le même jour vaut 0 jour, et l'indice de creux prévaut sur la simple date.
- [x] Avec un solde initial connu, zéro drawdown observé retourne 0 et non `null`.
- [x] Nouveaux jeux de cas indépendants : horaires invalides, récupération intrajournalière et absence de drawdown.
- [ ] Vérifier la CI sur le commit combiné de ce lot et contrôler tous les consommateurs pertinents.
- [ ] Validation des heures des imports broker dans leur fuseau source, et normalisation temporelle du lot 1.

**Dépendance approuvée :** le lot 0 valide les calculs et les états `UNKNOWN` avec des données de référence ; le lot 1 fournit les historiques broker et soldes d'entrée manquants. Aucune valeur n'est fabriquée pour contourner cette séparation.

## Lot 0 — P&L associé aux erreurs : pas de double comptage causal

- [x] Audit : un trade comportant deux erreurs apparaissait deux fois dans `totalCost` et dans les P&L hebdomadaires.
- [x] Les incidents restent comptés par tag, mais le P&L agrégé ne compte chaque trade qu'une fois.
- [x] Jarvis reçoit la définition explicite : il s'agit du P&L des trades déclarés, pas d'un coût causal contrefactuel.
- [x] Test de non-régression multi-tags avec réconciliation P&L global et ventilation.
- [ ] Vérifier cette modification sur la CI combinée et ses consommateurs finaux.

**Statut lot 0 : IN PROGRESS ; aucun lot suivant autorisé avant validation complète.**

## Lot 0 — Chronologie réalisée vs ouverture

- [x] Audit : trier par heure d'entrée un P&L reconnu à la clôture produit une chronologie d'equity erronée pour positions superposées.
- [x] Tri par clôture prouvable pour le drawdown et la série de résultats ; tri d'entrée du Journal conservé indépendamment.
- [x] Date complète de clôture absente, trades overnight ou horodatages identiques → ordre non vérifié et ratios de drawdown / récupération non publiés comme exacts.
- [x] Jeux de référence : positions qui se chevauchent, même minute, overnight, sensibilité au fuseau de date.
- [ ] Vérifier CI et cohérence avec les consommateurs Dashboard, Analytics, rapports et Jarvis.

**Statut lot 0 : IN PROGRESS.**

## Lot 0 — Propagation du drawdown réalisé aux rapports et à Jarvis

- [x] Rapports mensuels : un drawdown fondé sur une chronologie de clôtures ambiguë n'est plus présenté comme une mesure exacte ; retour `null` et affichage « — ».
- [x] Jarvis : le P&L réalisé peut manquer d'un ordre prouvable ; valeur `null` + indicateur `maxDrawdownOrderVerified` au lieu d'une affirmation non établie.
- [x] Jeu de référence indépendant, avec positions qui se chevauchent et sorties simultanées.
- [ ] Contrôler les contrats de données historiques de rapports déjà persistés (lot 1 : éventuelle migration additive sans perte).
- [ ] Validation CI sur le dernier commit applicatif.

**Lot 0 non terminé : dépendent encore de la vérification des consommateurs, des autres KPI et de la documentation finale des métriques.**

## Lot 0 — Précision sur la provenance CSV

- [x] Un CSV Journal non relu, même sans marqueur broker, n'est plus classé arbitrairement dans une session Eastern.
- [x] Le nombre d'horaires exclus affiché dans Analytics inclut broker et CSV non relus ; tests de couverture ajoutés.
- [ ] Limite explicitement conservée pour le lot 1 : la relecture CSV retire `reviewPending` sans enregistrer pour autant un fuseau source immuable. Un horodatage complet UTC et sa provenance devront être persistés pour une session certifiée après relecture.
- [ ] Valider sur la CI du commit final ; ne pas considérer le lot 0 DONE pour ce seul correctif.

## Revue des consommateurs de session / fuseaux (lot 0)

- [x] Moteur Jarvis behaviorSignals : même `getSessionForTrade` que les statistiques pures, évite des « pires sessions » reposant sur des horaires importés non vérifiés.
- [x] Filtres Journal/deep-links : sessions et heures excluent broker et CSV non relus en l'absence de fuseau certifié ; un filtre et un graphique restent cohérents.
- [x] Détail des trades mobile et formulaire de relecture : ne promettent pas une session NY à partir de l'heure locale d'un broker.
- [x] Tests de régression sur analyses Jarvis et filtres transverses ; heures identiques et origines différentes.
- [ ] Après validation CI finale, vérifier les consommateurs statiques restants et tester les états réels d'import après relecture.

## Lot 0 — Claims « after loss » sans fuite temporelle

- [x] Les filtres et Jarvis partageaient un tri à la date seule : une perte encore ouverte pouvait être utilisée pour qualifier une entrée précédente.
- [x] Prédécèsseur vérifié centralisé : entrée suivante strictement postérieure à la clôture réelle ; simultanéité, chevauchement, comptes différents et horaires importés incertains sont exclus.
- [x] Les comparaisons de risque Jarvis excluent les risques initiaux absents et les résultats de prédécesseurs non vérifiables.
- [x] Régressions ajoutées pour les chevauchements, égalités minute, comptes et imports incertains.
- [ ] Revue CI sur commit final et vérification des conclusions en contexte réel.

Lot 0 toujours IN PROGRESS, lots suivants verrouillés.
