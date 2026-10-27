# TradeVault — Lot 1 / Data Integrity (design préparatoire, NON DÉMARRÉ)

**État : spécification uniquement.** Ce document ne clôt pas le lot 0 et ne constitue pas une autorisation de déployer des migrations. Lot 1 commence exclusivement après acceptation des gates L0.

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
