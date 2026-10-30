# TradeVault — Lot 1 / Data Integrity

**État (30 octobre 2026) : implémenté sur `feat/data-integrity-lot1` (PR #236, empilée sur #234), migration NON appliquée en production.** La conception d'origine est conservée ci-dessous ; la section « Réalisation » dit ce qui a été construit, ce qui s'en écarte et pourquoi, et ce qui reste.

## Réalisation

| Élément de la conception | Réalisé | Écart / reste |
|---|---|---|
| `raw_ingest_events` immuables | Table insert-only (déclencheur `RAW_INGEST_IMMUTABLE`), unique `(user_id, source_key, payload_sha256)`, même clé + autre empreinte → `conflict` forcé en base. CSV : une ligne par ligne du fichier (`store/imports`), AVANT tout trade. Broker : chaque exécution et chaque relevé de frais (`broker-sync.recordRawFills`) | Pas d'outil de décision sur un conflit : il est compté et affiché (Réglages → Comptes), pas encore arbitrable |
| `canonical_fills` / `canonical_trades` (projection versionnée) | Les exécutions brutes sont conservées ; l'appariement plat → plat reste la machine à états déterministe en mémoire (`modules/brokers/roundTrips`, testée : renforts, sorties partielles, retournement, frais au prorata, exécution annulée) | Pas de table de fills normalisés ni de projection versionnée : à reprendre quand une synchro réelle autorisée permettra de valider le format (gate broker `BLOCKED_EXTERNAL`) |
| `cash_ledger`, `account_snapshots` | Tables, RLS (le client n'écrit que `source = 'user'`), signe contraint, UI de saisie (Réglages → Comptes) | Aucun écrivain `broker`/`statement` : aucune source observée n'est encore branchée (Tradovate non validable ici) |
| Solde avant l'entrée `VERIFIED / PARTIAL / UNKNOWN` | `domain/balanceAtEntry` : VERIFIED exige snapshot observé antérieur + instant d'entrée prouvé + intervalle placé, frais connus, aucune déclaration, réconcilié au cent par le snapshot observé suivant ; devise différente → UNKNOWN ; le solde de départ actuel n'est jamais un substitut | Tant qu'aucun snapshot observé n'existe, tout solde est au mieux PARTIAL : la règle de risque en % reste UNKNOWN, ce qui est exact |
| ID broker qualifié | `tradovate:<env>:<compte>:<exécution>` ; l'ancienne clé sans environnement est reconnue (pas de doublon) | La connexion n'entre pas dans la clé : se reconnecter au même login ne doit pas recréer les mêmes faits |
| Dates d'origine, fuseau, instant UTC | `source_timezone`, `entry_at`, `exit_at` ; sessions et ordre DÉDUITS de l'instant (`domain/easternClock`, heure d'été comprise) | Heures CSV sans décalage : aucun instant deviné |
| CSV : empreinte + ligne | Clé d'occurrence `csv:<empreinte>#<rang>` ou `csv-id:<id>` ; multi-ensemble face à l'historique sans clé ; permutation d'ordre sans effet (test) | — |
| Rapports et trades manuels existants | Aucune réécriture ; colonnes de provenance NULL = inconnues ; repli de lecture/écriture tant que la migration n'est pas passée | — |

## Contrat de données et preuves

Les faits sont distingués des observations et des estimations.

- `raw_ingest_events` immutables, par `user_id`, `source_kind`, `source_account_id`, `event_kind`, `source_event_id`, `payload_hash` et horodatage d'ingestion. Payload original protégé par RLS, jamais exposé à un autre utilisateur. La relecture du même identifiant et même hash retourne le même événement ; un identifiant identique mais un contenu différent crée un conflit explicite, pas une modification silencieuse.
- `canonical_fills` : exécution élémentaire sourcée, `quantity`, `price`, `side`, `fee`, devise, `executed_at_utc`, référence immuable de l'événement brut. Même compte, même broker et même environnement requis. `quantity > 0`. Un fill sans ID externe vérifiable ne peut pas être antidoublonné comme un événement certifié.
- `cash_ledger` : dépôts, retraits, frais hors-trade, ajustements et soldes broker observés, avec `occurred_at_utc`, devise et origine. Les ajustements sans pièce probante ne deviennent jamais des cashflows vérifiés.
- `account_snapshots` : état de compte à date et niveau de confiance. Le solde d'entrée ne peut être reconstruisible que si un snapshot antérieur vérifié et TOUS les flux et exécutions intermédiaires sont disponibles. Pas de remplacement par le starting balance actuel.
- `canonical_trades` est une **projection versionnée**, pas une copie mutable du broker. Un trade peut comporter plusieurs fills et plusieurs sorties ; son P&L se rapproche de la somme des exécutions et frais dans la devise pertinente.

## Principes non négociables

1. L'ID broker doit être qualifié par l'environnement, l'identifiant de connexion et de compte : un ID `123` chez deux comptes différents ne désigne pas une même exécution.
2. Conserver les dates d'origine, le fuseau IANA quand il est attesté, l'instant UTC quand il est prouvé et le décalage UTC observé. Les heures locales ambiguës lors du DST restent `UNKNOWN`.
3. L'import CSV n'invente pas un identifiant broker ni une direction. Empreinte de fichier + index de ligne pour déduplication du même fichier ; une réimportation d'un fichier réordonné exige une réconciliation explicite.
4. Les montants et la devise doivent être stockés en décimal (numeric), sans utiliser le P&L agrégé pour inventer les fills.
5. Toute projection porte `source`, `schema_version`, `build_version`, `quality_flags`, `coverage`, `reconciled_at`. Anomalie = donnée bloquée pour une preuve, jamais correction automatique opaque.
6. Migrations exclusivement additives avec rollback documenté, RLS et séparation des propriétaires, et tests multi-tenant (RLS), replay, doublons, partiels, simultanéité, cashflows, DST et arrondis.
7. La synchro Tradovate actuelle n'est pas certifiée par les tests de modules seuls ; validation partenaire, permissions réelles OAuth et rapprochement broker nécessaires avant `DONE`.
8. Les trades manuels existants et rapports restent consultables ; les migrations ne recalculent pas ni ne réécrivent silencieusement leur historique.

## Ordre d'implémentation après sortie du lot 0

1. Audit du schéma actuel et du droit d'accès des tables `trades`, `accounts`, `broker_accounts`, `broker_connections`.
2. Migrations additives avec unique constraints et RLS, puis tests Postgres concurrentiels.
3. Import brut transactionnel et déduplication cross-replay ; journaux de conflits observables.
4. Projection fills → positions/trades à base d'une machine à états déterministe, et rapprochement cents/quantity.
5. Ledger cashflows et reconstruction solde avant entrée, avec états `VERIFIED / PARTIAL / UNKNOWN`.
6. Adapters CSV / Tradovate et revue des consommateurs Dashboard, Journal, Analytics, Goals, Reports et Jarvis.
7. Tests E2E/preview puis tests partenaires dans environnement autorisé, et critères de sortie documentés.

## Entrées demandées au lot 2 (aucune implémentation du lot 2 dans ce fichier)

- Périodes et séances de trading normalisées, UTC et timezone conservés.
- R initial vérifié, verdicts des règles historiquement applicables, coverage et états indéterminés.
- Événements par trade, frais et résultats réconciliés pour EdgeLab et BehaviorLab.
- Séries ordonnées et identifiants immuables pour bootstrap par session, validation temporelle OOS, protocole de Research Notebook.
- Toute mesure qui ne dispose pas d'un échantillon approprié reste nullable.
