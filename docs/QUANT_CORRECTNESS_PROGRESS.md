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

## Boucle consolidée — golden dataset quantitatif et chronologie comportementale

- [x] Registre fixe de trades avec calculs de référence manuels : P&L net,
  gains/pertes bruts, Profit Factor 5/3, R moyen +0,2R, drawdown réalisé
  de 250 $ / 25 200 $ et récupération sur 1 jour.
- [x] Cas où l'ordre des clôtures diffère de l'ordre des entrées ; contrôle
  indépendant des notes des erreurs multi-tags, sans double comptage.
- [x] Règle comportementale « après perte » réconciliée entre filtre et
  Jarvis, sur une perte effectivement clôturée avant la nouvelle entrée.
- [x] Contrats des sessions Eastern : import broker et CSV non relu non
  classés comme observations de session.
- [ ] CI finale de la PR et contrôle des consommateurs restants.
- [ ] Migrations/additions de provenance, exécutions fractionnées, cashflows
  et sources historiques de compte au lot 1, selon la dépendance approuvée.
- [ ] Test réel en environnement de préproduction et audit produit final.

**Statut : lot 0 IN PROGRESS, lots 1–6 NOT STARTED.**

## Reprise après approbation — contrôle du score de journal vide

- [x] Le moteur comportemental accordait 100/100 à un compte avec zéro trade,
  sans aucune preuve de qualité ni de discipline.
- [x] `cleanJournalScore` est maintenant `null` sans échantillon. Le nom de
  cette mesure reste explicite : elle concerne les erreurs auto-déclarées,
  et ne prouve pas le respect du plan de trading.
- [x] Test de régression : un historique vide a zéro observation et aucune
  note de journalisation.
- [ ] Contrôle CI sur le dernier commit et revue des consommateurs IA.

**Lot 0 encore IN PROGRESS**, même si CI verte : il reste des gates de
preuve, de migration et de validation d'intégration documentés dans la matrice.

## Reprise autorisée — compatibilité des rapports persistés (27/10/2026)

- [x] Inspection : des rapports JSON historiques étaient affichés après le passage à PF nullable, au drawdown par clôture et au Sortino sans valeur fictive, sans version de calcul.
- [x] Les nouveaux rapports déclarent `reportMethodVersion=2`, sans migration destructive.
- [x] À la lecture, les rapports non versionnés ou de version inconnue conservent leurs données originales en base ; PF, R, Sharpe, Sortino, drawdown, classements de setups, « coûts » d'erreurs et texte IA non revalidés sont masqués dans la vue.
- [x] Avertissement visible et recalcul à la demande pour un mois archivé : le serveur réécrit le même mois via UPSERT, sans synthèse IA non vérifiée.
- [x] Régressions ajoutées : ancien PF=99 / métriques fictives masquées, rapport originel non muté, PF légitime >99 préservé en version actuelle, version future inconnue non supposée valide.
- [ ] Contrôle final CI/typecheck/lint/build/tests sur le HEAD de cette reprise et revue de l'interface sur un historique réel.
- [ ] Audit transversal des consommateurs hors page Rapports ; validation en préproduction et import des historiques restent à documenter.

**Statut : lot 0 IN PROGRESS. Lots 1–6 non commencés. `main` inchangée.** Les historiques de transactions et de cashflows destinés au lot 1 ne sont ni fabriqués ni annoncés comme complets.

### Contrôle supplémentaire — attribution du P&L aux erreurs

- [x] Les tableaux du rapport distinguent désormais `P&L des trades avec erreurs déclarées` d'un coût causal de l'erreur. Les tags peuvent se chevaucher.
- [x] Le résumé mensuel IA ne peut plus additionner les tags ni qualifier leur P&L de « pertes évitables » ; pas d'edge démontré sans échantillon, pas de métrique inventée quand la donnée est nulle.
- [x] Golden test : un seul trade à deux tags (-100 $) apparaît dans deux catégories mais reste -100 $ de P&L total, et non -200 $ de pertes imputables.
- [ ] CI sur le dernier commit de cette itération et revue UX des mentions dans les langues secondaires (fallback anglais).

## Reprise approfondie L0 — validation des imports et préparation vérifiable du lot 1

- [x] CSV P&L : interdiction des préfixes numériques suivis de texte, des exposants hors contrat, de l'infini et des séparateurs de milliers malformés.
- [x] CSV date et heure : validation de la date civile y compris février/bissextile ; refus des heures impossibles et des suffixes non reconnus ; aucun instant UTC deviné sans source.
- [x] Régressions métier ajoutées dans `src/app/features/journal/tests/csvImport.test.ts`.
- [x] Contrôles CI du commit `637d0fec` réussis (typecheck, lint, build, tests multi-fuseaux, SQL) et aperçu Vercel READY.
- [x] Design préparatoire documenté dans `docs/DATA_INTEGRITY_LOT1_DESIGN.md` : modèle brut / fills / cashflows, idempotence, sécurité et contrats attendus par le lot 2. **Cela ne démarre pas le lot 1**.
- [ ] Vérifier la CI au dernier SHA et la prévisualisation authentifiée du parcours import → journal → rapports → Jarvis ; comparaison à des comptes représentatifs avant statut DONE.
- [ ] Revue finale des autres consommateurs de statistiques, états `UNKNOWN` et compatibilité de tous les rapports réels persistés.
- [ ] Vérification du plan L0/L1 sur branche dédiée, sans migration sur base active ni fusion sur `main`.

La connexion Supabase active a été consultée **en lecture seule** pour inventorier les colonnes ; aucune migration ni donnée utilisateur modifiée. Les futurs tests Tradovate et Stripe ne sont pas présentés comme validés. Tant que ces gates sont ouverts : **L0 IN PROGRESS, L1–L6 NOT STARTED**.

### Revue transverse des consommateurs de R et des annonces économiques

- [x] Calendrier P&L : utilisation des R limitée aux observations portant un risque initial non nul, hors import broker non certifié ou CSV non relu. Sinon, composition par P&L, sans mélange d'unités.
- [x] Détail hebdomadaire : ne pas afficher un multiple R en cas d'absence de risque initial mesurable.
- [x] News Day Split : une moyenne de R ne peut pas intégrer un multiple sans risque initial, un import non relu ou un broker dont les stops ne sont pas certifiés.
- [x] Association événement → trade : aucun badge d'événement « durant la position » sur heures broker/CSV sans provenance, sorties overnight sans date UTC ou heures invalides. Les annonces de la journée restent consultables sans revendication de chevauchement.
- [x] Régressions ciblées dans `tests/calendarTone.test.ts` et `tests/tradeNews.test.ts`.
- [ ] CI et revue réelle des consommateurs sur le SHA final. L'attribution des timestamps UTC et du risque certifié par exécution relève du lot 1.

## Dernière passe ciblée du lot 0 — 27 octobre 2026 (avant transfert à Claude)

### Correctifs applicatifs supplémentaires terminés

- [x] **Monte Carlo legacy** : `computeStatistics` ne remplace plus le Profit Factor non définissable par `99`. Le contrat passe à `number | null`.
- [x] **Second calcul Monte Carlo** : `computeProfitFactor(wr, aw, al)` ne renvoie plus de plafond fictif 99 si le dénominateur est nul.
- [x] **Calendrier P&L mensuel** : suppression du R moyen `Math.abs(rMultiple)` qui masquait les pertes ; R signé uniquement sur trades au risque initial observable.
- [x] **Indétermination calendrier** : si un trade du mois manque de risque vérifié ou porte une provenance broker/CSV non certifiée, `avgRR` et `totalRR` sont `null` et les cartes affichent « — », pas 0R artificiel.
- [x] **Tests de régression Monte Carlo** : 0 perte → PF `null`, gains 500/pertes 300 → 5/3, PF légitime 120 et scénario PF 198, sans plafonnement.
- [x] **CI du HEAD `69a6d75fb74269f3c98c7e9a3d19777f2aa20978`** : [workflow #40571428895](https://github.com/Amine2bxl/Trade-Vault/actions/runs/40571428895) **SUCCESS** (typecheck, lint, build, tests Bun multi-fuseaux, SQL). Les tests ciblés exécutés en sandbox passent également.

### Bilan honnête des critères de sortie

- **Correctifs quantitatifs du noyau et ces consommateurs** : implémentés et validés par tests/CI.
- **Reste une gate d'acceptation** : revue **authentifiée** du parcours complet import → Journal → Analytics → Goals → Reports → Jarvis avec historique représentatif et UI mobile/desktop. Aucune preuve de ce parcours de bout en bout n'a été produite dans ce travail.
- **Reste à faire** : revue exhaustive des consommateurs résiduels et de tous les rapports persistés réellement utilisés, ainsi que validation de certains cas broker réels.
- **Dépendances explicitement transférées à L1** : migrations additives, données brutes immuables, snapshots du solde d'entrée, fills complets et fuseau source vérifié. **Ne jamais débloquer le score par des valeurs inventées.**
- **Dépendances externes** : OHLC/ticks licenciés, autorisation broker, preuves de paiement Stripe sont reportées aux lots compétents.

**Statut formel : L0 IN PROGRESS (tests verts, acceptation E2E non prouvée). L1–L6 NOT STARTED, `main` intacte, PR #234 draft.** Cela permet la passation mais PAS une attestation mensongère « lot 0 100 % fini ».

---

## Reprise Claude Code — 28 octobre 2026 : clôture technique du lot 0

**Point de départ vérifié :** PR #234 draft, HEAD `b7b1f87`, CI 40572696796 verte, `main@079d185` inchangée.
**Méthode :** audit du code réellement monté (client, fonctions serveur, crons, Jarvis), reproduction de chaque défaut par un test qui échoue sur l'ancien code, correction, revue des consommateurs, CI.

### Défauts trouvés et corrigés (tous reproduits avant correction)

| # | Défaut (avant) | Correction (après) | Preuve |
|---|---|---|---|
| 1 | Sept définitions du « R mesuré » : Analytics/Dashboard/Goals/Jarvis comptaient un import broker non relu, le Calendrier l'écartait ; total R du Dashboard, motifs nocturnes et contexte IA lisaient le `r_multiple = 0` stocké d'un risque inconnu comme 0R | `domain/trade.measuredR` / `hasMeasuredRisk` / `totalMeasuredR`, définition unique (P&L net / risque, `null` sans risque, import non relu ou broker) ; `avgRR` nullable ; tous les consommateurs migrés | `tests/rEvidenceConsistency.test.ts` (référence calculée à la main) · `3653f58`, `239da09` |
| 2 | Chargeurs serveur de Jarvis (`ai-tools/trades.ts`), des rapports mensuels et du scan de motifs sans `account_id`, `broker`, `review_pending` : toutes les protections de provenance du lot 0 étaient contournées côté serveur | Colonnes de preuve lues (existence vérifiée en production, lecture seule) | `3653f58` |
| 3 | Édition rapide du risque/R et formulaire de relecture : `pnl = risque × R` réécrivait le P&L OBSERVÉ (broker, CSV) ; saisir le risque d'un import sans risque écrivait **0 $** en base | `withPnlFromRiskAndR` et le formulaire gardent le P&L observé et en déduisent le R | `rEvidenceConsistency` + harnais : sur `b7b1f87` le P&L importé de 125,50 $ tombe à 0 $, corrigé à 125,50 $ / 2,51R · `3653f58` |
| 4 | `review_pending` n'était écrit en base que pour un trade broker : un CSV importé redevenait « relu » au rechargement (qualité 3 / confiance 50 par défaut, risque et heures non vérifiés comptés comme observations) | Écrit dès que l'état de relecture est connu | `tests/tradeStore.test.ts` + harnais (contre-épreuve sur `b7b1f87`) · `05240f3` |
| 5 | « Après une perte » encore calculé à la date seule dans les motifs nocturnes (`modules/patterns`), la page Erreurs (`mistakePlan`), l'observation d'après-trade (`modules/coaching`) ; analyse de trade : une position ouverte plus tard et sortie le lendemain passait pour une perte antérieure | `verifiedPriorClosedTrade` partout ; série de pertes lue dans l'ordre des clôtures et tue si l'ordre d'une journée mixte est inconnu | `tests/patternDetectors.test.ts`, `tests/mistakePlan.test.ts`, `coaching/tests/afterTrade.test.ts`, `tests/tradeAnalysisEvidence.test.ts` · `3653f58`, `2badf49` |
| 6 | Motifs : un trade à deux erreurs d'une même famille compté deux fois (part des pertes > 100 % possible) ; tranches horaires sur heures broker/CSV ; le rédacteur formatait un R moyen en pourcentage (−0,8R → « −80 % ») | Un trade par famille, impact R retenu seulement si chaque R est mesuré, heures non certifiées exclues, rédacteur sensible à l'unité | `tests/patternDetectors.test.ts`, `tests/proposalWriter.test.ts` |
| 7 | Notifications push/e-mail causales : « « X » t'a coûté 500 $ », « signal de tilt », « ce que tu as changé fonctionne », « elle te coûte » | Constats non causaux (« P&L des trades marqués… association observée ») | `src/modules/notifications/rules.test.ts` (échoue sur l'ancien code) |
| 8 | Analytics : taux par jour/setup/mois sans plancher d'échantillon ; PF et distribution sur l'étiquette « be » (divergent du Dashboard) ; R mensuel tracé sur l'axe 0–100 % (R négatif coupé) ; carte Tendances couronnant un mois d'un trade | `winRateOf`, P&L net, axe R dédié, `MIN_BUCKET_SAMPLE` | `3653f58`, `dec14ac` |
| 9 | Dashboard : R net additionnant les 0 de risques inconnus ; win rate « 0,0 % » sans trade tranché ; Journal et fiches : « 0.0R » pour un risque inconnu | « — » | harnais (bureau + mobile) |
| 10 | Rapport mensuel : win rate arrondi au centième (57,0 % vs 57,1 % au Dashboard) ; rapport archivé étiqueté du compte actif alors qu'il agrège tous les comptes | Précision au dix-millième ; « Tous les comptes » si plusieurs comptes ; `REPORT_METHOD_VERSION = 3` | `05240f3`, `17cad4a` |
| 11 | Contexte IA : `rMultiple` et `setupQuality` obligatoirement numériques (R inconnu et qualité par défaut envoyés comme observations) ; suggestions « Pourquoi je perds le … », « Ce que me coûte … » | Champs nullables (schéma Zod) ; questions descriptives | `rEvidenceConsistency` |

### Vérification de rendu (préproduction SIMULÉE — pas un E2E authentifié)

`scripts/l0-ui-check/` : l'application réelle (composants, moteurs, fonctions serveur, écritures REST) tourne sur une doublure Supabase en mémoire avec 20 trades aux chiffres calculés à la main.

- **Résultat : 30/30** — bureau 1440×900 et mobile 390×844 : R net « — », PF 3,06, win rate 65,0 %, R moyen 0,59R avec « 14 of 20 trades with known risk », aucun « 0.0R », rappel des imports à relire, rapport hérité masqué (PF 99, synthèse IA) ; parcours import CSV (2 valides / 1 refusée faute de direction, `review_pending` persisté) → relecture (P&L 125,50 $ conservé) → recalcul du rapport (v3, PF 5,5, sans synthèse IA) ; aucune exception de page.
- **Contre-épreuve** sur les fichiers de `b7b1f87` : 2 échecs (P&L écrasé à 0 $, `review_pending` absent).
- **Accessibilité (axe-core 4.10, WCAG 2 A/AA)** : bandeau d'avertissement et bouton de recalcul nommés et focalisables, aucune violation sur ces éléments. Constats globaux transférés au lot 5 : `meta viewport` interdit le zoom (`user-scalable=no`, critique, WCAG 1.4.4) ; parts SVG Recharts sans alternative textuelle.

### Données de production — inventaire en lecture seule (agrégats, aucun contenu lu)

- 49 traders avec trades, 1 467 trades ; **0 trade broker, 0 import en attente, 0 trade sans risque** : la règle stricte du R mesuré ne modifie aucun chiffre existant.
- 15 rapports mensuels, 2 traders, **tous sans version de méthode** (2 avec PF = 99, 8 avec synthèse IA) : tous affichés comme hérités, métriques masquées, recalcul explicite sans synthèse IA ; le cron ne régénère que le mois clos.
- 2 traders multi-comptes, dont 1 avec rapports archivés (périmètre « tous comptes » désormais affiché).
- Dérive de schéma : `trades.replay_session_id` présent en base, absent des migrations versionnées → audit lot 1 (`calibration_factor` est bien versionné par `20260808020000`).

### Statut des gates du lot 0

| Gate (handoff §2.2) | Statut | Preuve / reste |
|---|---|---|
| P0.1 Consommateurs montés | **DONE** | Dashboard, Analytics, Journal, Calendrier, Goals, Rapports, Erreurs, Saisonnalité, Jarvis (contexte, outils, motifs, suggestions), notifications, observation d'après-trade, analyse de trade. Monte Carlo : PF nullable (reprise précédente) ; le R « estimé » par perte médiane de `probability/strategy.ts` est déclaré (`estimated`) et relève de l'unification du lot 3 |
| P0.2 Rapports hérités | **DONE** | Masquage + recalcul explicite vérifiés sur l'app ; inventaire prod ; aucune réécriture automatique |
| P0.3 Valeurs manquantes persistées | **DONE pour le lot 0** | `review_pending` persisté ; colonnes subjectives nullables et provenance du risque → **lot 1** (dépendance approuvée) |
| P0.4 Cas quantitatifs indépendants | **DONE (portée L0)** | goldens existants + `rEvidenceConsistency` ; fills partiels / frais par exécution → lot 1 |
| P0.5 Parcours authentifié réel | **BLOCKED_EXTERNAL** | L'hôte `tjikygsipblatubyzbrt.supabase.co` est refusé par la politique réseau du conteneur (CONNECT 403). Remède : l'ajouter aux domaines autorisés de l'environnement, puis rejouer `scripts/l0-ui-check` sans doublure avec un compte `tv*@test.dev` supprimé après usage. Vérification de rendu simulée faite (ci-dessus) — elle ne remplace pas ce gate |
| P0.6 Assertions IA | **DONE (portée L0)** | Contexte et outils nullables, motifs/rédacteur/notifications non causaux ; contrat Evidence complet → lot 4 |
| P0.7 CI du SHA final | voir la PR | typecheck, lint (0 erreur), build, 1 866 tests × 3 fuseaux en local ; CI GitHub sur chaque push |
| P0.8 Accessibilité des avertissements | **DONE** | axe-core ci-dessus |

**Transfert au lot 1 (sans valeur inventée) :** provenance du risque broker (stop observé vs risque par défaut), colonnes subjectives nullables, `account_id` des rapports mensuels, fuseau source des heures, fills et frais par exécution, soldes à l'entrée, dérive de schéma (`replay_session_id`).

**Statut : lot 0 techniquement clos, sauf le gate P0.5 `BLOCKED_EXTERNAL`** (preuve manquante et remède documentés ci-dessus). Le passage au lot 1 suit la règle du programme : un contrôle extérieur inaccessible est consigné, pas déclaré validé.

## Lot 1 — Data Integrity (30 octobre 2026, PR #236)

Branche `feat/data-integrity-lot1`, empilée sur `feat/quant-correctness-lot0`. Migration additive `20261028140000_data_integrity_provenance.sql` — **non appliquée en production ni sur une branche de preview**. Détail de la réalisation : `docs/DATA_INTEGRITY_LOT1_DESIGN.md` § Réalisation.

### Défauts corrigés (reproduits par un test qui échoue sur l'ancien code)

| Défaut | Correctif | Preuve |
|---|---|---|
| Deux trades réels identiques d'un même CSV : le second compté « doublon » et perdu | Clé d'occurrence par ligne, plan multi-ensemble | `tests/importKey.test.ts` |
| Frais d'un CSV rangés dans le slippage | Colonne `fees` distincte | `csvImport.test.ts` (lot 1) |
| API de frais Tradovate en panne : frais écrits à 0, P&L brut présenté comme net | Frais `null` (inconnus) | `brokerSync.test.ts`, `roundTrips.test.ts` |
| Risque forfaitaire de la connexion broker indiscernable d'un stop observé | `risk_source` `broker_default` / `broker_stop` ; le forfait ne mesure pas de R | idem + `provenanceEvidence.test.ts` |
| Même numéro de compte/exécution en démo et en live : le second trade ignoré en silence | Clé `tradovate:<env>:<compte>:<exécution>` + reconnaissance de l'ancienne clé | `brokerSync.test.ts` |
| Heure d'un trade broker (fuseau du trader) lue comme heure de New York | Instant UTC enregistré, minute Eastern déduite | `provenanceEvidence.test.ts` (DST mars/novembre) |
| Rapport mensuel lu sans pagination : calculé sur 1 000 trades au plus, sans le dire | Chargeur serveur paginé unique | `tradeProvenance.test.ts` (faux PostgREST plafonné à 1 000 ; mutation détectée) |
| Trades sans compte (299/1 470 en prod) hors de l'index d'idempotence (NULL ≠ NULL) | Index partiel dédié | `tests/sql/data-integrity.sql` (mutation détectée) |
| Copie de trades sans provenance | `source = copy` | revue de code |

### Gates de sortie L1 (handoff §5)

| Gate | Statut | Preuve / reste |
|---|---|---|
| Même export deux fois = zéro P&L ajouté ; permutation d'ordre sans effet | **DONE** | `importKey.test.ts` ; index unique par compte (SQL) |
| Même ID broker sur deux comptes / environnements ≠ collision | **DONE** | `brokerSync.test.ts` ; clés par compte (SQL bloc 7) |
| Multi-fills, partiels, commissions, minuit, DST, mêmes horodatages, annulations | **DONE (moteur), PARTIAL (persistance)** | Appariement déterministe testé ; exécutions brutes conservées ; pas de table de fills normalisés (voir design) |
| Snapshot sans un retrait historique → jamais « exact » | **DONE** | `balanceAtEntry.test.ts` (PARTIAL + écart chiffré au rapprochement) |
| RLS tenant A/B | **DONE (Postgres local)** | `tests/sql/data-integrity.sql`, 12 blocs en rôle `authenticated` ; non rejoué sur la base Supabase (accès réseau bloqué) |
| Compatibilité des historiques et trades manuels | **DONE** | Provenance NULL = inconnue ; repli sans colonnes (`tradeProvenance.test.ts`) |
| CI, SQL | **DONE** localement : typecheck, lint 0 erreur, build, 1 933 tests × 3 fuseaux, SQL vert ; CI GitHub sur la PR |
| Intégration preview | **BLOCKED_EXTERNAL** | Hôte Supabase refusé par la politique réseau du conteneur ; migration à appliquer sur une branche de preview Supabase avant fusion |
| Tests broker réels et rapprochement avec relevés | **BLOCKED_EXTERNAL** | Aucun environnement Tradovate autorisé ; aucune « synchro validée » n'est affirmée |
| Data Quality (L1.7) | **PARTIAL** | Comptages et écarts affichés (`domain/dataQuality`, Réglages → Comptes) ; arbitrage manuel traçable d'un conflit non construit |

**Vérification de rendu (doublure, pas un E2E authentifié)** : section Trésorerie et soldes, bureau 1 360 px et mobile 360 px — aucune erreur de page, aucun débordement horizontal, ajout d'un dépôt reflété, lignes en quarantaine affichées.

**Statut : lot 1 implémenté et testé ; non clos à 100 %** — deux gates `BLOCKED_EXTERNAL` (preview Supabase, Tradovate réel) et deux restes internes documentés (fills normalisés persistés, arbitrage des conflits). Aucune donnée historique n'a été réécrite.

## Lot 2 — EdgeLab, BehaviorLab, Research Notebook (30 octobre 2026)

Branche `feat/research-edge-behavior-lot2`, empilée sur `feat/data-integrity-lot1`. Migration additive `20261030160000_research_notebook.sql` — **non appliquée en production**.

### Livré

- **Moteur pur `modules/research`** :
  - bootstrap par blocs de séances, avec graine, tirages et version rendus avec le résultat ;
  - Benjamini-Hochberg ;
  - analyse par dimension (setup, symbole, session NY prouvée, jour, compte) ;
  - verdicts « écart observé » / « indiscernable », jamais « meilleur » ;
  - fragilité au trade extrême ;
  - stress de coût par trade ;
  - découpe chronologique 60/20/20 par séances ;
  - scénario BehaviorLab hypothétique ;
  - protocole du Research Notebook.
- **Seuils** : ceux du produit (`modules/patterns/thresholds` : 30 trades, 20 séances). Aucun nouveau seuil.
- **Interface** : une carte dans Analytics → Exécution (Conditions de performance, hypothèses suivies) et une carte dans la page Erreurs (scénario). Aucune nouvelle page.

### Critères de sortie L2 (handoff §6)

| Critère | Statut | Preuve |
|---|---|---|
| Bootstrap reproductible à graine identique, variation compréhensible sinon | **DONE** | `research.test.ts` |
| Faible n bloqué ; holdout jamais utilisé pour sélectionner | **DONE** | `research.test.ts` (mutation détectée : sélection sur tout l'historique → échec) |
| Détails chronologiques : séances, découpe par jour, multi-comptes | **DONE** | Séance = jour NY de l'instant prouvé, sinon date ; scénario groupé par compte et séance |
| Tests multiples corrigés, couverture incomplète visible | **DONE** | BH sur les seules valeurs testées ; couverture et inconnus affichés |
| Gains contrefactuels étiquetés hypothétiques | **DONE** | `behaviorLab` (`label: "hypothetical"`), badge et avertissement à l'écran |
| Research Notebook : protocole figé, révisions sans altérer l'hypothèse, invalidation après ingestion | **DONE (local)** | `notebook.test.ts` ; `tests/sql/research-notebook.sql` (protocole figé — mutation détectée, RLS A/B) |
| Cohérence analytique / rapports / exports / coach | **PARTIAL** | EdgeLab réutilise `measuredR`, les sessions et l'ordre du lot 1 ; Jarvis n'interroge pas encore EdgeLab (→ lot 4, contrat de preuve) |
| Expériences comportementales prospectives (hypothèse, durée, conformité) | **PARTIAL** | Le Notebook couvre l'hypothèse d'espérance ; une expérience de RÈGLE (conformité mesurée) n'est pas encore modélisée |

**Validations manquantes** : migration non appliquée sur une base Supabase (réseau bloqué) ; rendu vérifié sur doublure, pas en parcours authentifié réel.

## Lot 3 — Risk Engine V2 / PropRisk / Monte Carlo (30 octobre 2026)

Branche `feat/prop-risk-engine-lot3`, empilée sur `feat/research-edge-behavior-lot2`. Aucune migration.

### Audit — trois moteurs
1. `modules/probability/strategy` + `rules` : **moteur canonique**, monté (page Monte Carlo, Workers).
2. `features/monte-carlo/monteCarloEngine.ts` : ancien moteur. Ses fonctions ne sont plus appelées par aucun écran, seulement par des tests (`monteCarloCsv`, `csvBrokerFormats`). Ses types restent lus par `monteCarloViz`. Rien de discordant n'est affiché. Candidat à suppression au lot 6, avec la preuve exigée par `ARCHITECTURE.md` §7.
3. `features/simulator/Simulator.tsx` : interface complète sur `probability/engine` (mêmes règles), **non montée**. Le prompt de Jarvis renvoyait le trader vers « the Simulator » : corrigé vers la page Monte Carlo.

### Défauts corrigés (test qui échoue sur l'ancien code)

| Défaut | Correctif | Preuve |
|---|---|---|
| Le R du Monte Carlo ignorait la définition unique : un risque broker forfaitaire ou un import non relu étaient comptés comme R mesuré (transféré depuis le lot 0) | `historicalModel` passe par `measuredR` ; sinon unité estimée, comptée | `strategy.test.ts` |
| Drawdown « trailing intraday » calculé sur les soldes de trades clôturés, sans le dire ; une règle de firme sur le plus haut latent est plus sévère | `trailing` documenté et marqué `trailingBasis: closed_trade` + avertissement dans l'éditeur ; `trailingLatent` refusé (`LATENT_PATH_REQUIRED`) | `rules.test.ts`, `strategy.test.ts` |
| Jarvis renvoyait vers une page inexistante | Prompt du coach → page Monte Carlo | revue de code |

### Ajouts
- **Mode C** : tirage par séances entières, qui conserve l'enchaînement de chaque journée. L'échantillon effectif est le nombre de séances, avec un minimum de 10 ; en dessous, la projection est refusée.
- **Mode B** : stress « gains réduits » (0 à 50 %), en plus du coût par trade existant.
- **Échantillon effectif affiché** : plus de trajectoires n'ajoute aucune observation (test).

### Critères de sortie L3 (handoff §7)

| Critère | Statut | Preuve |
|---|---|---|
| Trajectoires manuelles : ordre, perte journalière, trailing contre clôture, gel, consistance, jours minimum, frais transformant un P&L brut nul en perte | **DONE** | `rules.test.ts` |
| Même graine et mêmes entrées : résultats identiques ; Worker et thread principal cohérents | **DONE** | `strategy.test.ts` ; le Worker appelle la même fonction pure |
| Plus de simulations n'augmente pas la certitude des entrées | **DONE** | `effectiveSample` invariant (test) |
| Refus du trailing intraday exact sans MFE/ticks | **DONE** | `LATENT_PATH_REQUIRED` |
| Contrats de firms datés ou marqués non vérifiés | **DONE** | Aucune règle de firme codée en dur ; règles saisies par le trader, avec l'avertissement `lab.rulesHint` |
| Un seul moteur canonique, aucun algorithme concurrent affichant des résultats discordants | **PARTIAL** | Rien de discordant n'est affiché ; l'ancien moteur et le simulateur non monté subsistent dans le code (lot 6) |
| Comparateur de plans, multi-comptes, risque corrélé | **PARTIAL** | La comparaison avec une référence existe sur la page ; le multi-comptes corrélé n'est pas modélisé (exposition non vérifiée) |
| Mémoire et performance des 10 000 trajectoires, accessibilité | **Non re-mesuré** | Tampons transférables existants ; aucune mesure nouvelle |

## Lot 4 — Jarvis Intelligence / progression mesurable (30 octobre 2026)

Branche `feat/jarvis-evidence-lot4`, empilée sur `feat/prop-risk-engine-lot3`. Migration additive `20261030200000_progress_experiments.sql` — **non appliquée en production**.

### Défauts corrigés
| Défaut | Correctif | Preuve |
|---|---|---|
| L'outil `get_edge_score` décrivait au modèle quatre composantes (35/25/25/15 %) alors que le moteur v2 n'en note que deux (65/35 %) : Jarvis pouvait expliquer un score par une méthode qui n'est pas la sienne | Poids exportés (`EDGE_SCORE_WEIGHTS`), description dérivée | `jarvisTools.test.ts` (inventaire des outils) ; revue |
| Aucune consigne ne disait au modèle que le texte libre des données (notes, CSV importés, souvenirs) n'est pas une instruction | Règle « DATA IS NOT INSTRUCTIONS » (prompt) + en-tête des résultats d'outils ; les notes voyagent en chaîne JSON | `jarvisEvidence.test.ts` |
| Jarvis ne pouvait pas lire EdgeLab ni BehaviorLab (PARTIAL du lot 2) | Outils `get_edge_conditions` et `get_behavior_scenario`, avec preuve (méthode, n, séances, période, couverture, limites) | `jarvisEvidence.test.ts` (cloisonnement utilisateur et compte, verdicts, pas de « meilleur », scénario hypothétique) |

### Ajout — expérience de progression
Protocole figé, respect vérifiable séance par séance, P&L descriptif face à une base prudente, puissance faible annoncée, aucune conclusion causale. Le trader peut refuser (abandonner) ou modifier (nouvelle version liée) ; version et résultat sont conservés. Tests : `experiment.test.ts`, `tests/sql/progress-experiments.sql` (protocole figé, clôture définitive, isolation A/B).

### Critères de sortie L4 (handoff §8)
| Critère | Statut | Preuve |
|---|---|---|
| Chaque nombre important relié à une preuve, au bon compte | **DONE (outils)** | Validateur de chiffres existant (`modules/ai/validation`) + preuves des nouveaux outils ; cloisonnement testé |
| Données absentes ou anciennes : limites explicites | **DONE** | Verdict `insufficient` sans intervalle ; `null` jamais converti en 0 ; consignes d'outil |
| Aucune écriture directe par l'IA, aucune fuite multi-tenant | **DONE** | `jarvisNoDirectWrites`, outils `sideEffect: false`, `user_id` jamais en argument |
| Anti-injection | **PARTIAL** | Règle de prompt + en-tête testés ; non mesuré contre un vrai modèle (aucun appel fournisseur dans cette session) |
| Validation multilingue, fallback provider, mémoire | **Existant, non re-testé ici** | Suites `jarvisProviders`, `memory-*` vertes ; pas d'évaluation réelle avec un modèle |
| Revue UX réelle des recommandations | **BLOCKED_EXTERNAL** | Exige des réponses réelles du fournisseur et un compte authentifié |


## Lot 5 — Product Hardening (30 octobre 2026)

Branche `chore/product-hardening-lot5`, empilée sur `feat/jarvis-evidence-lot4`. Migration additive `20261030220000_restrict_cross_tenant_functions.sql` — **appliquée en production le 30 octobre 2026 sur autorisation du propriétaire** (version distante `restrict_cross_tenant_functions`).

### Défauts corrigés
| Défaut | Correctif | Preuve |
|---|---|---|
| `effective_tier(p_user_id)` et `count_trades_in_month(p_user_id, …)` sont SECURITY DEFINER et exécutables par `PUBLIC`, `anon` et `authenticated` : n'importe qui, sans compte, lit le palier et le nombre de trades mensuels de n'importe quel utilisateur dont il a l'id. Constaté **en production** (lecture seule de `pg_proc` : `proacl` contient `=X`, `anon=X`, `authenticated=X` ; corps identiques à la migration du 29 août) | Garde « un utilisateur connecté n'interroge que lui-même », `EXECUTE` retiré à `PUBLIC`/`anon` ; les fonctions de déclencheur de quota ne sont plus appelables en RPC. Corps repris à l'identique, rollback documenté dans la migration | `tests/sql/tenant-functions.sql` (A ≠ B, `anon`, déclencheur de quota pour soi, rôle de service) ; mutation (garde retirée) détectée |
| `meta viewport` interdisait le zoom (`user-scalable=no`) et `lock-zoom.ts` bloquait le pincement : WCAG 1.4.4 (constat axe du lot 0) | Viewport `width=device-width, initial-scale=1, viewport-fit=cover` ; `src/shared/lock-zoom.ts` retiré (seul import : `__root.tsx`) | typecheck, build, suite complète |
| `public/llms.txt` affirmait « never connects to a brokerage account » alors que l'app contient une liaison Tradovate (OAuth, lecture seule par construction : `tradovate.server.ts` refuse tout chemin hors liste) — audit E10 | Formulation vraie que la liaison soit activée ou non : pas de courtier, aucun ordre ; liaison Tradovate optionnelle, en lecture seule, quand elle est activée | relecture ; `seo.test.ts` (présence du fichier) |
| Libellés visibles codés en dur `lang === "fr" ? … : …` (code promo de l'abonnement, « vérifiés » des règles dans Mistakes, unité « mois » et suffixe « % » de l'onboarding) | Clés `billing.promo*`, `mistakes.verifiedPct` (EN + FR) ; `perMonth`, `pctSuffix` dans `onboardingCopy.ts` | typecheck, lint, suite complète |

### Mesures
- **Performance EdgeLab / BehaviorLab, 10 000 trades** (≈ 1 250 séances, CPU du conteneur, thread principal) : dimension stratégie 407 ms + hors-échantillon 205 ms ; symbole 279 + 174 ms ; jour 84 + 53 ms ; BehaviorLab 27 ms. Le bootstrap travaille déjà sur des blocs pré-sommés ; calcul mémoïsé par dimension. Risque résiduel : plusieurs secondes sur un téléphone lent pour un historique de cette taille — un worker serait la suite si ce cas apparaît.

### Critères de sortie L5 (handoff §9)
| Critère | Statut | Preuve |
|---|---|---|
| Sécurité multi-tenant des fonctions privilégiées | **DONE, appliqué en production** | `tenant-functions.sql` ; en production après application : `has_function_privilege` (`anon` : aucun `EXECUTE` ; déclencheurs non appelables par `authenticated`), garde éprouvée avec des identifiants fictifs (soi : autorisé ; autre : `insufficient_privilege`) ; l'advisor « Public Can Execute » ne cite plus ces fonctions. Appelants en base vérifiés : tous passent l'utilisateur lui-même |
| Accessibilité : zoom | **DONE** | viewport, `lock-zoom.ts` retiré |
| Accessibilité : graphiques Recharts sans alternative textuelle | **OPEN** | constat axe du lot 0, non traité |
| Documentation publique (`llms.txt`) vs intégration broker | **DONE** | ci-dessus |
| Landing : « No broker connection — there is no API » (`landing/i18n.tsx`) | **DÉCISION PRODUIT** | vrai pour l'utilisateur tant que la liaison Tradovate n'est pas activée en production ; à réécrire le jour où elle l'est |
| i18n : chaînes codées en dur | **PARTIAL** | cas `lang === "fr" ?` corrigés ; restent 111 ternaires `fr ? "…"` bilingues (facturation, `ChecklistWizard`, un `aria-label` de Goals) — les dix autres langues y voient l'anglais |
| Stripe sandbox (checkout, 3DS, refus, webhooks rejoués, portail) | **NON VALIDÉ — écarté par le propriétaire** (30 octobre 2026) | aucune preuve ; ne pas présenter Stripe comme validé |
| OAuth Tradovate réel (refresh, 403/429, idempotence) | **NON VALIDÉ — écarté par le propriétaire** (30 octobre 2026) | aucune preuve ; ne pas présenter la synchro Tradovate comme validée |
| E2E authentifié, charge, reprise après panne | **BLOCKED_EXTERNAL** | hôte Supabase bloqué par le réseau de la session |
| Protection de `main` | **BLOCKED_EXTERNAL** | réglage du dépôt, hors de portée de la session |
| Advisor Supabase « Leaked Password Protection Disabled » | **ACTION PROPRIÉTAIRE** | réglage Auth du tableau de bord Supabase |
