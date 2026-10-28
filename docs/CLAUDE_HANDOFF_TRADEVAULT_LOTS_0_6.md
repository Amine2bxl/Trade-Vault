# TRADEVAULT — DOCUMENT MAÎTRE DE PASSATION À CLAUDE CODE
## Programme validé de transformation en Trading Intelligence System — Lots 0 à 6

**Version du dossier :** 27 octobre 2026 — point de reprise après la PR #234  
**Destinataire :** Claude Code / autre agent de développement disposant des accès autorisés GitHub, Vercel et Supabase  
**Statut :** spécification + état factuel. **CE DOCUMENT N'EST PAS une attestation de livraison des lots 0–6.**  
**Portée :** préserver le produit existant, renforcer la vérité de ses données, de ses calculs, de ses simulations et des conclusions de Jarvis.

> IMPORTANT : le programme a **sept étapes numérotées de 0 à 6** : le lot préliminaire 0, puis les **six lots 1 à 6**. Respecter exactement cet ordre. Une partie des tests du lot 0 passe, mais le lot 0 n'est pas déclaré terminé.

### Entrée rapide pour Claude

1. Lire ce fichier ENTIER, puis `docs/QUANT_AUDIT_COVERAGE.md` (matrice complète A1–A8, B1–B4, C, D1–D15, E1–E13), `docs/QUANT_CORRECTNESS_PROGRESS.md` (journal des réalisations) et `docs/DATA_INTEGRITY_LOT1_DESIGN.md`.
2. Lire `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/FEATURES.md`, `docs/AI.md`, `docs/ROADMAP.md` et le code effectivement présent. **Le registre peut contenir d'anciennes cases non mises à jour ; vérifier, ne pas supposer.**
3. Relever le statut réel de la PR #234, son HEAD, sa CI et le SHA de `main`. Actualiser ce document si GitHub a changé depuis la date indiquée.
4. Ne PAS commencer le lot 1 avant d'avoir satisfait, documenté et fait valider toutes les gates techniques vérifiables du lot 0, en appliquant les dépendances ajustées ci-dessous. Ne jamais fabriquer une preuve absente.
5. Réaliser des changements limités, chacun avec tests, revue des consommateurs, CI, preuves reproductibles et PR dédiée. **Aucun merge sur `main`**, aucun déploiement production ni migration destructrice sans autorisation distincte.
6. Si une validation requiert Stripe test, accès réel broker, compte de test, source sous licence ou une revue authentifiée, la déclarer **BLOCKED_EXTERNAL**, fournir les étapes et preuves manquantes, et distinguer « implémenté », « testé », « validé en conditions réelles ».

---

# 1. CONTEXTE INITIAL, OBJECTIF ET CONTRAT PRODUIT

## 1.1 Pourquoi ce programme existe

Audit stratégique et technique réalisé le **26 octobre 2026** sur le dépôt `Amine2bxl/Trade-Vault`, basé sur `main@079d185f8e1917ca1ef48321f3e1697064db40ba`. L'audit original faisait **15 sections** : constats sur le dépôt, huit anomalies critiques, vérification des règles, cinq moteurs, sort des pages actuelles, nouvelles capacités, méthodologie statistique, Monte Carlo, Jarvis, architecture, séquencement, consolidation et positionnement produit.

TradeVault n'est pas un prototype vide. Il contient déjà une application React / TanStack, Supabase, un journal, Analytics, Monte Carlo, des comptes, des règles, un calendrier, des rapports, des modules probabilistes, des workers, des tests et Jarvis. **NE PAS reconstruire les fondations.** Le défaut systémique principal est un risque de transformer des entrées incertaines en statistiques précises, puis en conseils convaincants mais non démontrés.

**Cible produit :** passer de « journal de trading + IA » à un **Trading Intelligence System pour traders futures et prop firms** :

- DATA ENGINE : importer, rapprocher, documenter les sources, révéler les inconnus.
- EDGE ENGINE (EdgeLab) : mesurer la performance conditionnelle et son incertitude.
- BEHAVIOR ENGINE (BehaviorLab) : mesurer règles, événements et expériences de discipline.
- RISK ENGINE (PropRisk) : simuler des risques documentés, contraintes et scénarios.
- RESEARCH ENGINE : protocoles reproductibles, jeux de données versionnés, validation OOS.
- JARVIS INTELLIGENCE LAYER : interpréter uniquement des preuves générées par ces moteurs, présenter les limites et accompagner des expériences mesurables.

**Question que TradeVault doit savoir traiter :** « Qu'est-ce que mes données permettent réellement de conclure sur mon edge, mon risque et mes décisions, et que devrais-je tester ensuite ? »

## 1.2 Ce qu'il ne faut pas faire

- Pas de « 100/100 » ou « 99 » arbitraire pour une observation manquante.
- Pas de chiffres de marché historiques fictifs, pas de NFP présumé systématiquement le premier vendredi, pas de date FOMC codée en dur considérée comme confirmation.
- Pas d'affirmation causale (« cette erreur t'a coûté 500 $ ») à partir du seul P&L des trades associés à un tag.
- Pas d'analyse d'un trade à partir d'une perte qui s'est clôturée **après** son entrée.
- Pas de duplication des moteurs statistiques, de Monte Carlo ou de systèmes de notifications.
- Pas de refonte cosmétique, nouveaux thèmes, animations de Jarvis, projet crypto/DeFi/actions ou prévisions de prix tant que les lots de fiabilité ne sont pas terminés.
- Pas de modifications directes sur `main`, ni de rebase/force-push destructif d'autres branches, ni de suppression de données utilisateurs.
- Pas de secrets, accès broker, comptes personnels ou jetons exposés dans les commits, tests, logs ou documents.
- Pas d'annonce de DONE à partir d'une CI seule.

## 1.3 Trois ajustements de dépendances définitivement approuvés

**Ajustement 1 — Lot 0 vérifie la vérité des calculs, PAS l'existence magique des historiques.** On vérifie les méthodes à partir de données indépendantes et on rend `UNKNOWN` / `null` / couverture explicite si données réelles insuffisantes. Les soldes à l'entrée, fills complets et timestamps vérifiés viennent du lot 1. Leur absence ne doit pas bloquer indéfiniment la correction mathématique du lot 0, mais les surfaces ne doivent pas prétendre disposer de la preuve.

**Ajustement 2 — Lot 1 fournit les historiques/provenances et rend possible la vérification réelle.** Les règles historiquement dépendantes du solde avant chaque trade, du stop initial, des fills, des dépôts/retraits et du fuseau source ne deviennent vérifiées qu'après ingestion/reconstruction et contrôle. Ne rétro-remplir aucune colonne avec de fausses observations.

**Ajustement 3 — Dépendances externes sous contrôle.** Une saisonnalité par actif ou un replay forensique fondé sur OHLC/ticks demande des données fiables et une licence d'usage adaptée. En absence de licence, **masquer/report explicite** et conserver les fonctions de journal personnel vérifiables ; ne pas inventer des séries. Stripe et Tradovate nécessitent des parcours d'acceptation réels dans des environnements autorisés. Distinguer implémentation technique de validation partenaire/commerciale.

Ces trois décisions prévalent sur une checklist antérieure ambiguë du registre.

---

# 2. ÉTAT RÉEL VÉRIFIÉ À LA PASSATION

| Élément | État au 27/10/2026 |
|---|---|
| Dépôt | `Amine2bxl/Trade-Vault` |
| `main` | `079d185f8e1917ca1ef48321f3e1697064db40ba` ; inchangée durant la reprise |
| Lot 0 | **IN PROGRESS** : partie substantielle implémentée, non signée techniquement et fonctionnellement |
| Branche lot 0 | `feat/quant-correctness-lot0` |
| PR lot 0 | **#234**, ouverte, draft ; ne pas fusionner |
| Commit applicatif HEAD vérifié | `1c6801155de5e69dfad357ede9a01a5cf7c17202` |
| CI | Workflow **40556362836 — SUCCESS** : TypeScript, ESLint, build, Bun multi-TZ, SQL |
| Lot 1 | **NOT STARTED** ; conception préparatoire dans `DATA_INTEGRITY_LOT1_DESIGN.md` |
| Lots 2–6 | **NOT STARTED** |
| Supabase | Projet TradeVault ; inspection de schéma en lecture seule dans la reprise ; aucune nouvelle migration distante appliquée au titre de ces lots |
| Preview | Une preview Vercel READY a été observée sur la branche ; ne pas confondre ce constat avec un E2E authentifié |
| Protection GitHub `main` | **À vérifier via des droits appropriés** : consultation API de protection refusée (403). Le document d'audit ancien la signalait non protégée ; ne pas annoncer que cela a été revalidé aujourd'hui |

Preuves : [PR #234](https://github.com/Amine2bxl/Trade-Vault/pull/234) · [CI HEAD 40556362836](https://github.com/Amine2bxl/Trade-Vault/actions/runs/40556362836) · [matrice de couverture](QUANT_AUDIT_COVERAGE.md) · [registre technique](QUANT_CORRECTNESS_PROGRESS.md).

## 2.1 Travaux du lot 0 déjà implémentés et testés

- Adhérence aux règles : **PASS / FAIL / UNKNOWN**, dénominateur vérifiable, couverture séparée et garde-fous contre les informations futures et l'ordre intrajournalier ambigu.
- Risque historique : le solde actuel n'est plus substitué arbitrairement au solde d'entrée passé ; manque de preuve → UNKNOWN.
- Statistiques : average R réalisé **signé** ; avgWinR/avgLossR distingués ; échantillon/coverage ; profit factor nul lorsqu'aucune perte observée ; Sortino et Sharpe non inventés ; drawdown réalisé ordonné par clôtures vérifiables.
- Edge Score v2 : absence de tags et checklist ne prouvent pas la discipline ; échantillon requis (au moins 10 trades / 5 séances dans le moteur concerné), méthodes versionnées, score indisponible sans sources historiques.
- Analyse des trades : suppression d'un score d'exécution par défaut quand MFE/MAE manquent ; pas de diagnostic causal sans observation.
- CSV Journal : direction explicite obligatoire, valeurs non relues marquées, risque zéro non traité comme R mesuré ; parsers de montants et dates durcis (dates impossibles, séparateurs ambigus, caractères parasites).
- Sessions : pas de NY/Eastern arbitraire pour les heures broker ou CSV non certifiées ; tables et filtres concernés revus.
- News économiques : dates historisées préférées aux règles approximatives, pas de fausse preuve « pendant ce trade » lorsque la chronologie importée est inconnue.
- P&L d'erreurs : un trade multi-tags n'est jamais plusieurs pertes causales ; rapports et synthèses IA avertissent du chevauchement.
- Rapports mensuels : méthode `reportMethodVersion=2` ; les anciens JSON non certifiés conservent leur archive mais masquent des métriques non fiables jusqu'au recalcul explicite.
- Golden cases et régressions : `tests/quantGoldens.test.ts`, `tests/monthlyReportCompatibility.test.ts`, `tests/tradeAnalysisEvidence.test.ts`, `tests/quantStats.test.ts`, `tests/calendarTone.test.ts`, `tests/tradeNews.test.ts`, `tests/behaviorSignals.test.ts`, et suites de la feature CSV.

**Attention :** « implémenté + CI verte » ne signifie pas encore « validé sur tous les comptes réels ni consommateur audité ».

## 2.2 Blocages résiduels concrets du lot 0

**P0 — à résoudre ou à prouver explicitement :**

1. Audit du code réellement **monté/exécuté** : Dashboard, Analytics, Journal, Calendar, Goals, Reports, Mistakes, Jarvis, exports, notifications, calculateur de position et Monte Carlo. Le même champ doit garder la même définition et la même indétermination partout.
2. Revue du chemin « un compte avec anciens rapports JSON → consultation/recalcul → données cohérentes », avec migrations déjà actives et contrats de compatibilité. Ne jamais écraser automatiquement une synthèse archivée.
3. Revue des valeurs manquantes persistées : direction CSV rejetée, risque null/zero, qualité et confiance par défaut **non attestées**. Les valeurs subjectives anciennes restent non certifiées tant que le lot 1 ne conserve pas la provenance de manière native.
4. Cas quantitatifs indépendants : entrées/sorties même seconde, overnight, DST, fills partiels, comptes multiples, débits/frais, valeurs infimes, drawdown par clôture, Sharp/Sortino indéfinis ; **résultats vérifiables ou UNKNOWN**, ne pas simuler le solde absent.
5. Parcours authentifiés sur une **préproduction sûre** : import CSV → Journal → Analytics/Goals/Reports/Jarvis, mobile/desktop, compte vide et historique ambigu ; vérifier que les labels expliquent « inconnu / échantillon insuffisant ».
6. Conformité finalisée aux assertions IA : une métrique absente ou une couverture partielle ne devient jamais un conseil chiffré positif.
7. Dernière passe CI et preuve du SHA **final** du lot 0, sans ignorer les tests échoués.
8. Validation d'accessibilité essentielle des avertissements et actions de recalcul, sans confondre avec la campagne complète du lot 5.

**À transférer vers le lot 1 (sans bloquer un algorithme du lot 0 correctement nullable) :** ledger cashflows, soldes à l'entrée, IDs d'exécutions normalisés, timestamps UTC + zone broker, subjectifs nullable persistés, méthode d'import immuable et rapprochement réel des brokers.

**À reporter jusqu'à données externes :** saisonnalité OHLC/ticks licenciée, calendrier historique incomplet, validation OAuth Tradovate partenaire, certains tests Stripe. Masquer les preuves non disponibles, documenter le verrou exact.

## 2.3 Définition de DONE du lot 0

**Tous** les items P0 applicables ci-dessus ont une preuve (fichier + test + SHA/CI + consommateur), et toutes les dépendances L1/externes sont notées comme `UNKNOWN` / `DEFERRED_LICENSE` / `BLOCKED_EXTERNAL` sans prétention. Une revue d'intégration en préproduction est acceptée, la PR reste isolée, et le registre + matrice A/B/C/D/E sont mis à jour. **Ne pas sauter la revue fonctionnelle sous prétexte qu'une suite unitaire passe.**

---

# 3. ARCHITECTURE CIBLE ET INVARIANTS TRANSVERSAUX

## 3.1 Pipeline à construire progressivement

    RAW INPUTS: broker OAuth / CSV / déclarations utilisateur / événements
       ↓ Validation format, identité compte, devise, sécurité, qualité
    RAW IMMUTABLE EVENTS + PROVENANCE + QUARANTINE
       ↓ Canonical executions + cash ledger + reconciled account snapshots
    CANONICAL TRADES + vérifiabilité / couverture / order timestamps
       ↓ Moteurs métier déterministes, versionnés, testés
    EVIDENCE STORE / EVIDENCE OBJECTS
       ↓ même vérité exploitable
    Dashboard | Journal | Analytics | EdgeLab | RiskLab | Reports | Jarvis

**Séparer systématiquement :** données *observées* (courtier), *déclarées* (utilisateur), *calculées* (algorithme, version et hypothèses), *estimées* (modèle) et *inconnues*.

## 3.2 Contrats obligatoires

- Identité : toutes les données dérivées conservent `user_id`, `account_id`, une clé source et une isolation RLS. Un compte broker peut posséder le même identifiant externe qu'un autre compte sans collision.
- Temps : date locale d'origine, zone IANA et offset lorsqu'attestés, instant UTC lorsqu'établi. Pas d'inférence silencieuse de la zone du broker à partir de l'heure d'affichage.
- P&L : net/brut, commissions, slippage et cashflows explicitement définis, devises préservées, rapprochement en décimaux monétaires.
- Risque : `initialRisk` vérifié ≠ risque estimé / risque saisi après coup. Un R ne se prouve pas sans risque initial suffisant.
- Chronologie : une clôture ne peut influencer une décision antérieure. Les égalités/chevauchements impossibles à départager donnent `UNKNOWN`.
- Échantillon : `n`, nombre de séances, période, couverture, source et version de méthode ; pas de moyenne ou certitude fictive à `n=0`.
- Plans et règles : une règle modifiée aujourd'hui ne s'applique pas rétroactivement aux trades d'hier sans version historique.
- Immutabilité/réexécution : réimporter les mêmes faits n'en crée pas deux ; changement contradictoire de payload pour un même identifiant → conflit documenté.
- Evidence : modèle de langage ne recalcule pas les chiffres ; il rapporte des objets calculés et ne produit aucune conclusion au-delà des preuves.

## 3.3 Contrat Evidence proposé à confirmer durant L2/L4

    type Evidence = {
      evidenceId: string;
      metricId: string;
      value: number | null;
      unit: "USD" | "EUR" | "R" | "percent" | "count";
      sampleSize: number;
      sessionCount?: number;
      period: { from: string; to: string };
      accountIds: string[];
      sourceTradeIds: string[];
      dataCoverage: number; // 0..1
      quality: "VERIFIED" | "PARTIAL" | "UNKNOWN";
      sourceVersion: string;
      methodVersion: string;
      assumptions: string[];
      limitations: string[];
      computedAt: string;
    };

**Ce contrat est une PROPOSITION de cible, pas un type existant déjà livré.** Versionner les adaptations, prévoir provenance pour données autres que trades, coût CPU/DB et contrôle d'accès ; ne pas créer une méga-table universelle sans usage.

---

# 4. LOT 0 — QUANTITATIVE CORRECTNESS

**Priorité : P0 ; état : IN PROGRESS ; branche/PR existantes.**

## Mission

Faire de tous les calculs existants un système mathématiquement correct, cohérent, reproductible et honnête sur les données manquantes, **avant** toute nouvelle fonctionnalité majeure.

## Backlog d'acceptation détaillé

- **L0.01 R signé.** Construire des tests ±R indépendants. Exemple +2R, −1R, −1R = **0R** réalisé moyen et non 1,33R ; gains en R et pertes en R séparés ; vérifier les consumers.
- **L0.02 Profit Factor.** Gains bruts/pertes brutes ; zéro perte observée → `null` / non déterminable, jamais `99` ; préserver PF légitimes supérieurs à 99.
- **L0.03 Sharpe/Sortino.** Exiger séries comparables de rendements et soldes historiquement observés, neutraliser les cashflows, identifier les jours non tradés et la convention d'annualisation. Déviation nulle → ratio non déterminable. Ne pas calculer Sharpe « journalier » sur les seuls jours avec trades et le présenter comme risque de compte.
- **L0.04 Drawdown.** Courbe sur clôtures réellement ordonnables, bilan avant/après, pics, récupération intrajournalière, trades simultanés, overnight, ambiguïté de timestamps. Ne pas revendiquer drawdown latent sans MFE/ticks.
- **L0.05 Verdicts des règles.** PASS/FAIL/UNKNOWN avec raison, variables manquantes et couverture ; journée « zéro entrée horodatée » ne vaut pas 100 % d'adhérence ; maximum trades/arrêt après pertes n'utilisent pas de trades futurs.
- **L0.06 Notation Edge/trade.** Ne pas récompenser l'absence d'erreurs déclarées ni calculer « qualité 70/100 » sans observation, éviter les métriques corrélées doublement pondérées, versions distinctes, échantillons suffisants.
- **L0.07 Imports et séances.** Les heures et risques manquants ne sont pas présumés ; validation des nombres, heures et dates, DST. La persistance canonique évoluera au lot 1.
- **L0.08 Événements et saisonnalité.** Événements économiques historiques sourcés, pas de calendrier NFP/FOMC inventé ; analyses saisonnières personnelles sur journal seulement tant que les données de marché fiables sous licence manquent.
- **L0.09 Causalité.** P&L de trades marqués FOMO/revenge est une association, pas une somme de pertes évitables ; les tags peuvent se chevaucher. Projections comportementales avec échantillon et contre-exemples.
- **L0.10 Contrats persistés.** Reports versionnés/compatibles ; historique de scores incompatible entre algorithmes ; pas d'overwrite silencieux.
- **L0.11 Tous les consommateurs.** Dashboard, Goals, Reports, Jarvis, Analytics, Monte Carlo, Calendar, notifications, exports et tests d'accessibilité.
- **L0.12 Goldens et CI finale.** Jeux de données **calculés indépendamment** (pas en dupliquant les fonctions production), invariants et exécution multi-fuseaux.

## Jeux de référence obligatoires

1. Trois trades +2R / −1R / −1R : moyenne 0R.
2. Gains bruts 500, pertes 300 : PF 5/3 ; sans pertes PF indéterminable ; PF réel >99 non tronqué.
3. Trade −100 étiqueté « FOMO » + « revenge » : P&L du portefeuille **−100**, pas −200.
4. Une perte clôturée à 10:30 ne peut expliquer une entrée 10:00 ; égalité à la minute → chronologie insuffisante.
5. Une equity « pic puis creux puis récupération » intrajournalière : récupération 0 jour ; pas de récupération : état distinct.
6. Trade sans risque initial : R non vérifié ; sans heure broker connue : session NY inconnue.
7. Deux contrats avec sorties partielles et fees : l'agrégation du lot 0 ne feint pas connaître le chemin latent ; l'état exact exige les fills du lot 1.
8. Un compte sans trades ou sans règles vérifiables : aucun score de discipline parfait.

## Fichiers centraux à revalider

`src/domain/tradeCalcs.ts`, `quantStats.ts`, `edgeScore.ts`, `ruleCheck.ts`, `tradeOrder.ts`, `monthlyReport.ts`, `tradeNews.ts` ; `src/modules/trading/analysis/engine.ts` ; `src/app/trading/ruleAdherence.ts` et consumers ; `src/app/features/journal/csvImport.ts` ; `tests/quantGoldens.test.ts` et autres tests référencés au `QUANT_CORRECTNESS_PROGRESS.md`.

**Exit L0 :** toutes les vérifications applicables ci-dessus avec preuve de leurs consommations et test E2E authentifié, sans transformer les données manquantes de L1 en valeurs inventées. Note de transfert L1 publiée.

---

# 5. LOT 1 — DATA INTEGRITY / BROKER FORENSICS

**Dépendance : clôture de L0. État : NOT STARTED (spec `DATA_INTEGRITY_LOT1_DESIGN.md` disponible).**

## Mission

Créer une chaîne de provenance immuable, imports CSV et broker reproductibles, réconciliation fills/trades/cashflows/soldes, et qualité de preuve utilisable par tous les moteurs suivants. **Ne pas effacer les trades existants.**

## Sous-lots recommandés

**L1.1 — Audit et stratégie de migration.**
- Inspecter le schéma réel `trades`, `accounts`, `broker_connections`, `broker_accounts`, `monthly_reports` et leurs RLS/contraintes. Comparer migrations versionnées, base test/preview et types générés.
- Identifier les identités de comptes, devises, calibrages, snapshots existants, conflits externes, champs optionnels ; aucun « copy » intercomptes ne doit convertir une source en fait broker authentique.
- Établir contrat de compatibilité des écrans actuels avant tout DDL.

**L1.2 — Données brutes immuables.**
- Table d'événements d'import bruts, source/connexion/environnement/compte, type d'événement, identifiant stable, hash, horodatage réception, version de schéma, éventuelle erreur/diagnostic de parsing.
- Garantir unicité qualifiée et replay idempotent. Même ID, autre hash → conflit explicite en quarantaine, pas d'écrasement.
- Séparer logs opérationnels et payload sensibles ; accès minimal et RLS owner-only, service_role serveur encadré.

**L1.3 — Fills normalisés et Trade Projection.**
- Fills individuels avec side, quantity, price, fee, devise, symbole/échéance, timestamps complets, clé externe qualifiée et référence brute.
- Machine à états déterministe : ouverture, ajout, réduction partielle, flatten, renversement, netting selon règles courtier ; tick/pointValue connus ; arrondis décimaux ; reconcilier le P&L net.
- Ne pas fabriquer des fills à partir du P&L agrégé ni assurer des pics latents sans source de prix.

**L1.4 — Cash ledger et balances à l'entrée.**
- Dépôts, retraits, frais hors-trade, ajustements, funding, resets de comptes, snapshots broker ; devises et dates vérifiées.
- État `VERIFIED / PARTIAL / UNKNOWN` pour le solde avant chaque trade. Snapshot ancien + TOUS les flux et P&L nécessaires présents, sinon solde inconnu.
- Cas accounts calibrés et multi-devises : historique original conservé, aucune conversion implicite.

**L1.5 — CSV universel mais vérifiable.**
- Prévisualiser la correspondance de colonnes avec exemples et niveaux de confiance ; paramètres de locale/devise explicités ; rejeter un `1,234` ambigu sans locale source.
- Direction absente = refus/relecture requise pour Journal ; notes subjectives nullables, pas de « qualité 3 » ni « confiance 50 » perçues comme observation.
- Empreinte de fichier + ligne brute, imports relançables, rapport lignes acceptées/refusées/doublons/conflits ; préférer IDs broker réels quand présents.

**L1.6 — Broker Tradovate et multi-comptes.**
- Conserver la connexion OAuth lecture seule (liste blanche serveur), chiffrement des jetons, refresh et permissions selon configuration partenaire.
- IDs externes qualifiés **par broker + environnement + connexion + compte + fill** ; même ID sur deux comptes = deux faits indépendants.
- Polling/curseur et reprise après panne, déduplication cross-run, stabilité après correction/annulation ; contrôle d'accès RLS et absence d'insertion sur un compte TradeVault non choisi.
- Réconcilier les totaux avec un relevé broker vérifié. Aucun environnement live ni ordre de trading requis pour tester l'ingestion en lecture seule.

**L1.7 — Data Quality.**
- Indices de couverture par source/champ/période ; anomalies explicites : temps inconnu, risque absent, devise incertaine, contrat inconnu, doublon, mismatch de frais.
- Blocage systématique des métriques qui nécessitent la donnée manquante. Outil de revue des anomalies, décision manuelle traçable (ne pas réécrire le raw).

## Fichiers / surfaces de départ

`supabase/migrations/`, `src/integrations/supabase/types.ts` (types à **régénérer**, jamais éditer manuellement), `src/app/store/trades.ts`, `src/app/features/journal/ImportCsvModal.tsx`, `csvImport.ts`, `src/backend/broker-sync.server.ts`, `src/backend/tradovate.server.ts`, `src/modules/brokers/roundTrips.ts`, `toTrade.ts`, `src/app/features/brokers/Brokers.tsx`, `docs/DATABASE.md`.

## Gates/tests de sortie L1

- Import du même export deux fois = **zéro P&L supplémentaire** ; permutations d'ordre préservant les faits n'altèrent pas le résultat.
- Deux comptes avec même ID broker ≠ collision.
- Multi-fills, partiels, commissions, conversions, trades autour de minuit, DST spring/fall, mêmes timestamps et annulations : résultats et inconnus vérifiés.
- Snapshot sans un retrait historique : balance marquée PARTIAL/UNKNOWN, jamais « recalculée exactement ».
- RLS tenant A/B : lecture, insertion, UPDATE de `user_id`, compte d'autrui, source privée ; refus démontré.
- Lecture compatibilité des historiques/trades manuels existants.
- Tests de retry/concurrence/quota ; sécurité tokens ; CI, SQL et intégration preview.
- Tests broker réels autorisés et rapprochement avec relevés. Si permissions partenaires manquantes : **BLOCKED_EXTERNAL** et aucune « synchro validée » proclamée.

**Sortie L1 :** base normalisée et sourcée avec logs de qualité, soldes et risques vérifiés uniquement lorsque les preuves existent ; toutes les dépendances du lot 2 documentées.

---

# 6. LOT 2 — EDGELAB + BEHAVIORLAB + RESEARCH ENGINE

**Dépendance : données normalisées L1. État : NOT STARTED.**

## 6.1 EdgeLab — analyse des conditions de performance

- Dimensions : setup, instrument, session, heure NY prouvée, jour, période, environnement macro réel, coût de transaction, compte, qualité de données.
- Afficher **n, séances, coverage, expectancy nette, dispersion et incertitude**, jamais « meilleur setup » sans qualification.
- Estimation bootstrap par **séances/blocs**, pas seulement trades individuels ; choix de blocs documenté ; seeds, intervalle, méthode/version conservés.
- Règles contre la sélection opportuniste : correction des tests multiples (FDR ou protocole équivalent déclaré), taille minimale selon méthode, estimations instables masquées, power/effective sample size signalés.
- Validation chronologique **train → validation → holdout OOS**, sans sélection sur la période test. Portée du setup immuable pour le holdout.
- Stress de données : frais +X, sous-échantillons, outliers, trades sans R, sessions inconnues, régimes si sources disponibles.
- Conclusions : « écart observé » ≠ « avantage durable prouvé ». Afficher les hypothèses qui invalident l'analyse.

## 6.2 BehaviorLab — preuves et expériences

- Chaque règle dispose d'une définition, version, période de validité, champs nécessaires, verdict trivalent et coverage.
- Analyser overtrading, stop-after-loss, risk-limit, heures, trades après perte, FOMO **auto-déclaré**, discipline mesurable, sans fuite d'information future.
- Différencier observation, proxy et expérience contrefactuelle. Rejouer « retirer les trades après 2 pertes » comme **scénario**, pas comme gain qui se serait produit.
- Expérience prospective : hypothèse enregistrée avant observation, durée/séances, règles fixées, observables, conformité et résultat ; collecte proportionnée.
- Mesurer discipline et résultat financier séparément : respecter une règle ne prouve pas à lui seul son effet causal.
- Taxonomie unifiée d'erreurs, déduplication des incidents et liens vers Journal/Reports.

## 6.3 Research Notebook — protocole reproductible

- Hypothèse, définition du setup, cohorte, filtres, période, snapshot de données, version de méthode, random seed, tests multiples, holdout fixé et rapport.
- Mettre les résultats en lien avec EdgeLab et BehaviorLab ; stocker comparaisons, scénarios et révisions sans altérer rétroactivement l'hypothèse initiale.
- Analyses qui changent : avertir si les comparaisons ne sont plus valides après une nouvelle ingestion ou un changement de méthode.

## Interfaces

Priorité valeur, pas multiplication des écrans : intégrer dans Analytics/Journal/Reports, cartes lisibles, drill-down vers trades, contexte de preuve, comparaison et note de recherche. Aucune page nouvelle par algorithme si elle n'apporte pas une action distincte.

## Tests / exit L2

- Bootstrap reproductible à seed identique, variation compréhensible avec seed différente.
- Blocage/signal faible n, égalité de périodes, holdout jamais utilisé pour sélectionner les gagnants.
- Détails chronologiques : journées, sessions, overlaps et filtrages multi-comptes.
- Résultats de plusieurs tests corrigés, couverture incomplète visible ; aucun score amélioré artificiellement en effaçant les tags.
- Cohérence analytique / rapports / exports / coach.
- Gains contrefactuels toujours étiquetés hypothétiques ; limitation prouvée par tests.

## Moteurs avancés conditionnels (pas des obligations de livraison sans données)

Execution Forensics après fills fiables ; RegimeX avec OHLC licenciés ; EventQuant avec calendrier/prix alignés ; Setup Genome après taxonomie et échantillon ; What Changed Engine après OOS. Ces activités passent après le noyau scientifique, pas avant.

---

# 7. LOT 3 — RISK ENGINE V2 + PROPRISK / MONTE CARLO

**Dépendance : L2 et source L1 ; état NOT STARTED.**

## Mission

Unifier le Monte Carlo visible, les moteurs dans `src/modules/probability/` et le simulateur historique éventuellement non monté. Produire des trajectoires reproductibles et **des décisions sur la survie sous contraintes**, plutôt que seulement 10 000 courbes agréables.

## 7.1 Trois modèles strictement distingués

**Mode A — Historical Bootstrap.** Rééchantillonnage de résultats réellement observés, hypothèse de stationnarité explicite, frais et taille ajustables ; avertir sur le manque de régimes/séquences.

**Mode B — Stress Scenarios.** Chocs déclarés : frais/slippage, série de pertes, queue de distribution, performance réduite, erreurs d'exécution ; ce sont des hypothèses utilisateur, pas des « prévisions ».

**Mode C — Session Blocks / Dependence / Regimes.** Rééchantillonnage par blocs/journées et, quand données suffisantes, modèles de dépendance/régime ; afficher réduction d'échantillon effectif et robustesse.

Pour tous : seed, nombre de trajectoires, méthode, version, période, échantillon, unité, normalisation et incertitudes. Les 10 000 trajectoires existantes restent possibles, mais **n'inventent pas plus d'observations**.

## 7.2 Moteur PropRisk

- Règles firm et produit **versionnées + source officielle + date de validité** : profit target, drawdown (fixe / end-of-day / trailing), daily loss, consistency, objectifs, contrat/market/time restrictions.
- Calcul de l'état dans l'ordre exact des événements : peak/balance/equity, resets session, changement de seuil, passage challenge → funded, fees, calendrier local.
- **Trailing intraday** : si règle fondée sur le plus haut unrealized P&L, exiger la trajectoire latente / price path suffisante ; à défaut, mode « approximation de clôture » clairement séparé, ou refuse la certitude.
- Simuler probabilité **conditionnelle au modèle** de violation, de réussite, drawdown, temps/trajectoires, risque par trade, worst cases, tests de sensibilité et coût des règles.
- Préserver les règles configurées par le trader ; ne pas coder par défaut les seuils d'une prop firm particulière comme vérité universelle.
- Comparateur de plans : taille de position, risque maximal, nombre de trades/jour, RR, drawdown ; choix d'hypothèses lisible.
- Gestion des cas multi-comptes/risque corrélé seulement après exposition vérifiée.

## 7.3 Expérience UI

Une page Monte Carlo/Risk Lab principale : paramètres au même endroit, comparaison des scénarios, courbes fluides lisibles, distribution, barrières, pertes extrêmes, état de preuve et actions. Conserver les fonctionnalités utiles déjà codées ; pas de sous-pages redondantes. Moteur pur en Workers, visualisation séparée, pas de blocage UI.

## Tests / exit L3

- Scénarios à trajectoires manuelles : ordre, peak latent, perte journalière, trailing vs EOD, reset, break-even net avec frais, limite de consistance, seuil atteint/perdu.
- Seed + mêmes entrées = résultats identiques ; workers/main-thread cohérents ; drift numérique contrôlé.
- Variation de nombre de simulations n'améliore pas magiquement la certitude des entrées.
- Contrats externes des firms datés ou marqués non vérifiés.
- Refus de simuler « trailing intraday exact » sans MFE/ticks adéquats.
- Vérification mémoire/performance des 10k courbes et accessibilité.
- Un seul moteur canonique, aucun algorithme concurrent non branché affichant des résultats discordants.

---

# 8. LOT 4 — JARVIS INTELLIGENCE / PROGRESSION MESURABLE

**Dépendance : preuves et moteurs L0–L3 ; état NOT STARTED.**

## Mission

Jarvis devient un **analyste de preuves** et un mentor de progression mesurable, pas un chatbot qui transforme des chiffres incertains en confiance artificielle.

## Contrats d'ingénierie

- Moteurs déterministes calculent ; Jarvis **formule**. Chaque affirmation quantitative importante pointe vers Evidence : métrique, valeur, unité, méthode, sample, période, sources, coverage, limites.
- `null / UNKNOWN / PARTIAL` jamais réinterprétés comme `0 / PASS / COMPLETE`. Les chiffres absents déclenchent une demande de donnée ou une explication, pas un score inventé.
- Aucune conclusion de cause démontrée à partir de corrélation ou de P&L de tags.
- Multi-comptes, time boundaries, autorisations et isolation RLS par outil. Les outils IA restent **read-only**, écriture uniquement après action explicite du trader sur une proposition validée.
- Évaluations adversariales : prompts déformant le score, mélange de devises, recherche d'un gain contrefactuel, données incomplètes, faux exemples, injection provenant de notes de trade ou CSV.
- Mémoires anti-répétition, versions, expirations et suppression de compte ; pas de croyances permanentes fondées sur peu d'observations.
- Modes de réponse : diagnostic prioritaire, explication des limites, expérience à tester, contrôle de progression et revue après session.

## Expériences de progression

Exemple : « Tester une pause après deux pertes pendant N séances ». Enregistrer protocole **avant** observation, mesurer respect vérifiable et P&L descriptif, comparer à une baseline prudente, annoncer la puissance limitée. Permettre au trader de refuser ou modifier l'expérience, conserver version et résultat.

## UX Jarvis

Conserver l'identité visuelle existante. Réduire les panneaux imbriqués, relation « face-à-face », cartes claires reliées au Journal, orb visible **seulement sans détériorer l'usage**. Ce lot vise surtout les preuves et l'utilité, pas des animations supplémentaires. Éviter « AI slop » et commentaires génériques.

## Fichiers utiles

`src/modules/ai/agents/coach.orchestrator.ts`, `src/modules/ai/validation.ts`, `src/modules/ai/tools/`, `src/backend/ai-tools/`, `src/app/features/jarvis/`, `src/modules/patterns/`, `src/modules/coaching/`, `docs/AI.md`.

## Tests / exit L4

- Chaque nombre dans les réponses importantes relié à preuve contrôlée et au bon compte.
- Réponses sur données inexistantes ou anciennes : limites explicites, aucune affirmation non vérifiée.
- Aucune écriture directe par l'IA, aucun secret dans le prompt/log, aucune fuite multi-tenant.
- Validation multi-langue, anti-injection, outils/read-only, mémoire/relecture, fallback provider.
- Revue UX réelle des recommandations et des liens de vérification vers trades/méthodes.

---

# 9. LOT 5 — PRODUCT & PRODUCTION HARDENING

**Dépendance : cœur produit stabilisé L0–L4 ; état NOT STARTED.**

## Mission

Passer des modules fonctionnels à un produit exploitable : sécurité, performance, compatibilité, accessibilité, fiabilité d'auth, intégration réelle des offres et observabilité.

## Périmètre

**Sécurité/auth/RLS**
- Vérifier toutes tables et vues (security_invoker si applicable), triggers, contrôles `user_id`, politiques UPDATE avec WITH CHECK, Storage, service-role serveur, fonctions privilégiées, auth sessions, suppression RGPD, secrets, ratelimit, CORS et CSRF.
- Vulnérabilités d'import / prompts non fiables / accès cross-account / extraction d'informations par Jarvis et analytics.
- Protéger `main` avec checks et revue ; le statut de protection doit être vérifié par un propriétaire disposant des droits.

**Performance**
- Benchmarks froid/chaud : Dashboard, Journal >1000 trades, Analytics 10k, graphes, animations, Workers Monte Carlo, synchronisation temps réel, mobile PWA.
- Budgets bundle et render ; supprimer les calculs redondants, améliorer skeletons / pagination / cache / initial load, sans introduire de résultats incomplets.
- Charges imports multi-milliers, bruit realtime, limites CPU/mémoire et retry.

**UX/A11y/I18n**
- États vides, indisponibles et erreurs ; aucun popup envahissant, accès actions mobile, navigation clavier, labels ARIA, focus, contrastes, champs tactiles >=44px, lecteurs d'écran.
- Vérifier toutes traductions affichées et les repli FR/EN ; pas de chaînes brutes non traduites dans les nouveaux parcours.
- Cohérence Dashboard, Journal, Calendrier, Analytics, Reports, Jarvis, Profile, Settings, Brokers, Subscription ; éviter empilement de cartes inutile.

**Stripe, plans et commerce**
- Tests **sandbox Stripe autorisés** : checkout mensuel/annuel, 3DS, paiements refusés, past_due, upgrade/downgrade, portail, retour Free, doublons clients, quotas, webhooks rejoués/hors ordre, signature invalide, expiration de timestamp, usage de secrets.
- Réconciliation entitlements serveur, jamais faire confiance à un flag client ; facture et obligations TVA/OSS UE à vérifier avec le responsable légal.
- Aucun changement de prix/config live ni activation d'abonnement par simple test.

**Brokers/Production**
- Tester OAuth/refresh/read-only Tradovate avec accès partenaire autorisé, déconnexions, erreurs 403/429, annulations, idempotence et RLS.
- Logs structurés sans PII, alertes basées sur anomalies réelles, checklist de déploiement/rollback, backups et migrations non destructives.
- Vérifier documentation publique y compris `public/llms.txt` : pas de promesse « aucun compte broker connecté » si l'intégration existe.

## Tests / exit L5

E2E anonymes + authentifiés, tests de sécurité multi-tenant, charge, accessibilité, récupération après panne, paiement test et OAuth partenaire **avec pièces de preuve**. External blockers listés si droits indisponibles ; ne pas faire semblant qu'une CI unitaires couvre la conformité commerciale.

---

# 10. LOT 6 — CONSOLIDATION, RESTRUCTURATION ET VALIDATION FINALE

**Dépendance : L0–L5 validés ; état NOT STARTED.**

## Mission

Réduire la dette et les moteurs concurrents APRÈS stabilisation, sans casser des fonctionnalités réellement utilisées. Consolider documentation, architecture, tests et traçabilité.

## Travaux

- Cartographier pages/routes montées et modules réellement appelés ; démontrer absence d'usage avant suppression. Le simulateur legacy/ancien moteur de Jarvis ne doivent pas être supprimés uniquement parce qu'une recherche statique ne trouve pas d'import direct.
- Fusionner moteurs probabilistes redondants autour des interfaces canoniques ; dédoublonner calculs de KPI, conventions d'adhérence, calendriers, notifications, composants.
- Déplacer les fichiers uniquement avec une carte import/export, un plan de migration et tests reachability/SSR/routeTree ; régénérer les types et imports nécessaires.
- Aligner `docs/ARCHITECTURE.md`, `PRODUCT.md`, `FEATURES.md`, `AI.md`, `BACKEND.md`, `DATABASE.md`, `ROADMAP.md`, notes de release, FAQ publique et matrices d'Evidence.
- Vérifier sécurité et confidentialité des anciens rapports, historique des algorithmes et parcours de suppression/export utilisateurs.
- Refaire toute la matrice A/B/C/D/E contre une version finale intégrée. Montrer ce qui est DONE, OPEN, DEFERRED_LICENSE, BLOCKED_EXTERNAL, avec propriétaire de blocage et preuve.
- Préparer un plan de release, déploiement progressif autorisé, rollback, vérification d'observabilité post-release et guide de reprise incident.
- Maintenir la cible futures/prop firms ; pas d'expansion crypto/actions générale.

## Exit L6

1. Aucune fonctionnalité essentielle cassée ; modules morts retirés UNIQUEMENT après démonstration.
2. Tous consumers et versions de statistiques compatibles, aucune source fictive réactivée.
3. Tests unitaires, intégration, SQL, E2E, sécurité, performances et accessibilité conformes aux critères documentés.
4. Contrôle comptes anciens/vides/importés, rapports hérités, comptes multiples, devises, billing et effacement RGPD.
5. Documentation réellement exploitable par un nouveau développeur et un opérateur de production.
6. Journal consolidé des preuves, risques résiduels et dépendances externes ; signature de fin par le propriétaire.
7. **Pas de merge sur main avant autorisation distincte**, même lorsque toutes les PR sont vertes.

---

# 11. MATRICE DE TRAÇABILITÉ DE L'AUDIT ORIGINAL

## 11.1 Les huit anomalies critiques A1–A8

| ID | Origine du défaut | Lot propriétaire | État actuel et règle de livraison |
|---|---|---|---|
| A1 | Saisonnalité statique approximative | 0, puis 1/2 sous licence | Masquée partiellement ; ne pas réactiver sans OHLC sourcées/licenciées |
| A2 | Average R en valeur absolue | 0 | Correctif signé présent ; vérifier tous consumers |
| A3 | PF fictif plafonné à 99 | 0 | Noyau nullable ; vérifier héritages, Goals, exports |
| A4 | Edge Score redondant et auto-déclaratif | 0 puis 2 | v2 présent, score null sans données historiques |
| A5 | Trade Analysis = 70/100 sans MFE | 0 | Score/coverage corrigés ; revue réalité à finir |
| A6 | CSV long/qualité/confidence inventés | 0 puis 1 | Direction obligatoire, pending guard ; nullable/provenance persistés en L1 |
| A7 | Drawdown à simple date, chronologie fausse | 0 puis 1/3 | Algorithme corrigé avec ambiguïté ; faits intratrade en L1 |
| A8 | FOMC/NFP supposés | 0/2 | Événements réels selon couverture ; contrôler surfaces et histoire |

## 11.2 Règles de trading B1–B4

- B1 états PASS/FAIL/UNKNOWN ; L0 mathématique, L1 provenance.
- B2 ordre temporel strict, aucune donnée future ; L0, tests L1 sur UTC/fills.
- B3 risque/solde avant entrée ; UNKNOWN L0, reconstruire L1.
- B4 IA et notifications n'affirment pas sur preuve partielle ; garde L0, formalisation Evidence L4.

## 11.3 Surfaces du produit C (décision)

| Surface | Décision | Phase principale |
|---|---|---|
| Dashboard | Une conclusion prioritaire vérifiable, KPI sobres | L4/L5 |
| Journal | Exécutions, champs sourcés, audit détaillé | L1 |
| Analytics | Edge conditionnel, incertitude, OOS | L2 |
| Monte Carlo | Risque, stress, dépendance, firm | L3 |
| Jarvis | Mentor fondé sur Evidence, expériences | L4 |
| Checklist | Préparation et contrôle après séance | L4/L5 |
| Calendar P&L | Navigation événements et anomalie | L5 |
| Economic Calendar | Références, horaires, couverture | L0/L2 |
| Seasonality | Source vérifiable ; absence explicite si licence | L0/L2 |
| Mistakes | BehaviorLab, associations non causales | L2 |
| Missed Opportunities | Distinguer scénario déclaré et contrefactuel prouvé | L2 |
| Monthly Reports | Analyses versionnées et revue fidèle | L4/L5 |
| Goals | Objectifs de processus et baselines mesurables | L0/L4 |
| Trading Plan | Règles historiques versionnées | L2 |
| Lot Size Calculator | Frais, limites et risque du compte | L3 |
| Brokers | Réconciliation/qualité des données | L1 |
| Inbox | Alertes ciblées et explicables | L4/L5 |
| Profile | Préférences utiles cohérentes | L5 |
| Appearance | Geler nouveaux thèmes, préserver existant | L5 |
| Settings | Simplifier sans perte de fonctions | L5/L6 |
| Subscription | Entitlements et paiement test réel | L5 |

## 11.4 Moteurs/tests à couvrir D1–D15

- D1 Data Engine → L1 ; D2 EdgeLab → L2 ; D3 BehaviorLab → L2 ; D4 Research Engine → L2 ; D5 PropRisk → L3 ; D6 Evidence Store → L4.
- D7 bootstrap séances, D8 intervalles/power, D9 OOS, D10 correction tests multiples → L2.
- D11 frais/outliers/sensibilité → L2/L3 ; D12 Monte Carlo historique/stress/blocs → L3 ; D13 trailing latent → L3 avec source appropriée ; D14 unification simulateurs → L3 ; D15 expériences de progression → L2/L4.

## 11.5 Architecture/production E1–E13

- E1 pipeline raw→canonical→Evidence L1–4 ; E2 migrations additives tout lot ; E3 golden invariants tout lot.
- E4 charge L5 ; E5 RLS/accessibilité L5 ; E6 Stripe réel L5 ; E7 OAuth réel L1/L5.
- E8 i18n/routes L5–6 ; E9 moteur IA redondant L6 ; E10 documentation publique L5–6.
- E11 protection main/revue chaque lot ; E12 structure/doc L6 ; E13 validation transversale L6.

**Source de suivi détaillée :** `docs/QUANT_AUDIT_COVERAGE.md`. Chaque ID doit recevoir un statut et un lien de preuve dans la PR concernée ; cette section résume les obligations, elle ne remplace pas la matrice complète.

---

# 12. TESTS GLOBAUX, MESURES ET CRITÈRES DE PREUVE

## Tests reproductibles transversaux

- **Isolation** : sous-comptes, users, devises, import broker ; aucune dérive en changeant de compte actif.
- **No future leak** : à date T, aucun événement postérieur à T n'affecte score, coaching ou risque historique.
- **Round-trip** : même CSV réimporté sans doublons ; ordre permuté si IDs et temps suffisamment qualifiés ; plusieurs occurrences légitimes distinctes préservées.
- **Qualité** : « non mesuré » ≠ 0, « pas de tag » ≠ absence de défaut, « pas de perte observée » ≠ PF infini utilisable.
- **Comptabilité** : somme des fills et fees → net P&L, bilan périodes et balances + cashflows, erreurs multi-tags non additionnées au P&L.
- **Temps** : UTC vs America/New_York vs Europe/Brussels vs Pacific/Auckland, printemps/automne DST, minutes égales, overnight, sessions de marché.
- **Simulations** : seed, convergence et précision Monte Carlo, source des règles et mouvement latent.
- **IA** : pas de numérique inédit, pas de conclusions causales, droits à lecture seule, pas d'injection de données non fiables dans les instructions.
- **Données persistées** : utilisateurs anciens et rapports archivés non réinterprétés sans version explicite.

## Commandes CI du projet, à vérifier contre package.json et workflow

    bun install --frozen-lockfile
    bun run typecheck
    bun run lint
    bun run build
    bun test
    TZ=America/New_York bun test
    TZ=Pacific/Auckland bun test
    bash scripts/test-sql.sh

Ajouter les checks spécialisés adaptés au lot ; ne pas modifier les tests pour les rendre artificiellement verts. S'appuyer sur les goldens indépendants et l'audit des consommateurs, pas seulement sur l'absence d'exception.

## Critère de preuve par tâche

Le compte rendu de chaque tâche doit documenter :

    taskId / lot / propriétaire
    statut: OPEN | IN_PROGRESS | DONE | BLOCKED_EXTERNAL | DEFERRED_LICENSE
    fichier(s) inspecté(s) et modifié(s)
    comportement AVANT (fixture ou défaut reproduit)
    comportement APRÈS (résultat mesuré)
    tests/fixtures ajoutés et résultat
    consommateurs vérifiés
    SHA de commit / CI URL / PR URL
    migration appliquée? environnement? plan de rollback?
    limites, hypothèses et risques non résolus

**Une tâche n'est DONE que lorsque chaque assertion de son critère d'acceptation est démontrable.**

---

# 13. PROTOCOLE DE TRAVAIL AUTONOME POUR CLAUDE CODE

**L'utilisateur a autorisé le programme 0→6 et le travail autonome**, mais a explicitement interdit les merges sur `main`. Les actions sensibles sur des utilisateurs/abonnements/production ne sont pas incluses implicitement dans cette autorisation.

### Boucle stricte pour chaque lot

1. AUDIT du code réel (y compris branche actuelle, différences, consommateurs et données nécessaires).
2. MICRO-PLAN ordonné, sans reconstruire ce qui fonctionne.
3. IMPLÉMENTATION par fichiers limités et branches/PR dédiées.
4. TESTS unités/propriétés/goldens/SQL/intégration pertinents.
5. REVUE indépendant des chiffres/conclusions, sécurité, migrations et régressions.
6. CORRECTION jusqu'à disparition des régressions.
7. VALIDATION CI sur le SHA final + revue UX/preview pour les parcours concernés.
8. REGISTRE de sortie complet ; passer au lot suivant seulement si les critères sont remplis et les blocages externes documentés honnêtement.

### Branches suggérées

- Lot 0 en cours : `feat/quant-correctness-lot0` et PR #234. Ne pas écraser ce travail.
- L1 après acceptation L0 : `feat/data-integrity-lot1` (nouvelle branche à partir d'une base compatible explicitement choisie ; **attention à l'absence de merge sur main**, les changements L0 doivent être inclus sans copier deux fois).
- L2 : `feat/research-edge-behavior-lot2`.
- L3 : `feat/prop-risk-engine-lot3`.
- L4 : `feat/jarvis-evidence-lot4`.
- L5 : `chore/product-hardening-lot5`.
- L6 : `chore/final-consolidation-lot6`.

Branches et noms sont des **suggestions de traçabilité**, non des branches que ce document prétend avoir créées.

### Règles de coordination entre agents

- Une branche avec des changements non fusionnés ne doit pas être écrasée par un agent parallèle.
- Pas de duplication de migrations SQL, même si plusieurs branches touchent Supabase.
- Les diffs générés peuvent être longs ; vérifier que les transferts d'outils n'ont pas tronqué un fichier. Comparer le nombre de bytes, compiler et revoir le diff.
- Commits courts, revue et log de validation à chaque étape ; ne pas amalgamer refonte UX et changement d'algorithme.
- Ne pas lancer un lot plus tardif sous prétexte qu'il est plus visible/attrayant.
- Demander seulement les accès externes indispensables ; expliquer précisément la preuve qui manque.

### Prompt initial prêt pour Claude Code

> Lis intégralement `docs/CLAUDE_HANDOFF_TRADEVAULT_LOTS_0_6.md` ainsi que les trois références `QUANT_AUDIT_COVERAGE.md`, `QUANT_CORRECTNESS_PROGRESS.md` et `DATA_INTEGRITY_LOT1_DESIGN.md`. Tu reprends la PR #234 sans perdre aucun correctif. Établis l'état réel du HEAD et les gates non validés. Termine d'abord le lot 0 en suivant les trois ajustements de dépendances acceptés : vérité des calculs et UNKNOWN au lot 0, faits sourcés et soldes au lot 1, OHLC/ticks/licences et intégrations externes jamais inventés. Pour chaque gate : reproduis, corrige, ajoute un golden indépendant, vérifie tous les consommateurs, lance la CI finale, teste la preview authentifiée quand tu disposes des accès et consigne la preuve. Tu n'as pas le droit de fusionner sur main, de masquer les inconnus ni de déclarer DONE sans acceptation. Une fois le lot 0 véritablement clôturé, crée la branche dédiée L1, implémente l'architecture, les migrations additives, l'import idempotent, les fills, cashflows, timestamps source, reconcilie et teste, puis prépare L2. Travaille de façon séquentielle et auditable.

---

# 14. DECISIONS DE PORTÉE / BACKLOG À NE PAS CONFONDRE

**À préserver et améliorer :** trading futures, prop firm, NQ, journal, IA Jarvis, calculs quantitatifs, expérience cohérente, données réelles.

**À examiner uniquement après préconditions :**
- Execution Forensics : seulement après fills sourcés.
- RegimeX : OHLC autorisés.
- EventQuant : macro réel + OHLC/retours alignés.
- Setup Genome : taxonomie setup stable, n suffisant.
- Risk Correlation : positions simultanées et notionnel.
- What Changed Engine : fenêtres temporelles comparables.
- Replay Forensics : données replay-safe et droits sur les bougies/ticks.

**Hors périmètre des lots validés :** scanner de memecoins, moteurs DeFi/blockchain, valuation fondamentale d'actions, prédicteur magique du prochain mouvement NQ, nombre illimité de nouvelles animations de Jarvis.

---

# 15. DERNIER CHECKLIST DE PASSATION

- [x] Programme initial et les 8 défauts récupérés depuis l'audit source.
- [x] Lots 0 à 6 et dépendances validées représentés.
- [x] Branche, PR, main et CI HEAD vérifiés au 27/10/2026.
- [x] L0 corrections/test coverage et blocages réels distingués.
- [x] L1 architecture approfondie présente et référencée.
- [x] L2–L6 objectifs, sous-tâches, fichiers, tests et exits définis.
- [x] Décisions par page, moteurs avancés, out-of-scope et qualité/sécurité inclus.
- [ ] Revue authentifiée finalisée / accord de clôture L0.
- [ ] Développement et acceptation L1–L6.
- [ ] Statut exact de protection `main` vérifié avec privilèges adaptés.
- [ ] Migrations, broker OAuth, Stripe, données licenciées et E2E réel validés quand autorisés.

**Instruction finale :** poursuivre, vérifier, mesurer et documenter ; pas de faux « terminé », pas de chiffres inventés, pas de régression et aucune fusion sur `main`. Le critère est la vérité du produit, pas le nombre de commits.

---

# ADDENDUM — Derniers correctifs quantitatifs du lot 0

Les éléments suivants sont **postérieurs** à l'état du HEAD `1c680115` mentionné plus haut. Pour tout travail ultérieur, consulter **la HEAD actuelle** de `feat/quant-correctness-lot0`, puis `docs/QUANT_CORRECTNESS_PROGRESS.md`, et ne pas prendre les SHA historiques de ce document pour l'état le plus récent.

- `src/app/features/monte-carlo/monteCarloEngine.ts` : `SampleStatistics.profitFactor` et le calcul de PF d'un scénario retournent désormais `null` lorsque le dénominateur n'existe pas ; les PF réels supérieurs à 99 sont préservés.
- `tests/monteCarloViz.test.ts` : goldens supplémentaires pour 500/300, PF 120, PF 198 et échantillon sans perte.
- `src/app/features/calendar/CalendarPage.tsx` : retrait du `Math.abs(rMultiple)` dans le R moyen mensuel ; total et R moyen affichés « — » si la provenance d'un seul trade du mois ne suffit pas à prouver le R ; état neutre ; break-even déterminé sur P&L net.
- Typecheck et tests ciblés Monte Carlo/calendrier/news exécutés en sandbox : **34 tests réussis** sur les trois suites ciblées ; CI complète du dernier SHA à confirmer via GitHub Actions.

**Statut de passage de relais :** les correctifs mathématiques du lot 0 progressent, mais la validation authentifiée des parcours applicatifs avec des données représentatives et la revue exhaustive des historiques persistés n'ont toujours pas de preuve d'acceptation. Ne pas marquer `L0 DONE` ou démarrer les migrations L1 seulement sur la base de ces contrôles techniques. Les préconditions de données L1 et les validations partenaires restent séparées comme approuvé.

---

# ADDENDUM 2 — Reprise Claude Code du 28 octobre 2026

- Point de départ vérifié : PR #234 HEAD `b7b1f87`, CI verte, `main@079d185` inchangée.
- Lot 0 : onze défauts supplémentaires trouvés dans les consommateurs réellement montés (dont deux altérations de données : P&L importé réécrit à 0 $ à la relecture, état « à relire » d'un CSV non persisté) et corrigés avec tests reproduits sur l'ancien code. Détail, preuves, inventaire de production et statut de chaque gate : `docs/QUANT_CORRECTNESS_PROGRESS.md`, section « Reprise Claude Code — 28 octobre 2026 ».
- Gate P0.5 (parcours authentifié réel) : **BLOCKED_EXTERNAL** — l'hôte Supabase est refusé par la politique réseau du conteneur ; une vérification de rendu sur doublure (`scripts/l0-ui-check`, 30/30) a été faite et ne s'y substitue pas.
- Lot 1 : branche `feat/data-integrity-lot1`, empilée sur `feat/quant-correctness-lot0` (aucune fusion sur `main`).
