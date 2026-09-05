#!/usr/bin/env bash
#
# Exécute les tests SQL de TradeVault contre un vrai Postgres.
#
# POURQUOI UN RUNNER SÉPARÉ. Les garanties de facturation et de quota les plus
# importantes sont portées par du SQL : un verrou de ligne, un `on conflict …
# where`, un déclencheur `before insert`. Les vérifier depuis TypeScript avec un
# client simulé ne prouverait que la forme des appels, pas leur comportement
# sous concurrence — donc rien de ce qui compte.
#
# Deux modes :
#   • une base existante        : PGHOST/PGPORT/PGUSER/PGDATABASE (ou DATABASE_URL)
#   • un cluster jetable local  : sans variables, le script en démarre un
#
# Sortie non nulle au premier échec. Silencieux quand tout passe, sauf le
# récapitulatif final.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MIGRATION="supabase/migrations/20260829090000_billing_and_quota_hardening.sql"
OWN_CLUSTER=0
CLUSTER_DIR=""

find_pg_bin() {
  # `pg_ctl` n'est pas toujours dans le PATH sur Debian/Ubuntu : il vit sous
  # /usr/lib/postgresql/<version>/bin.
  if command -v pg_ctl >/dev/null 2>&1; then
    dirname "$(command -v pg_ctl)"
    return 0
  fi
  local candidate
  candidate=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)
  [ -n "$candidate" ] && echo "$candidate"
}

start_local_cluster() {
  local bin PORT
  bin=$(find_pg_bin)
  if [ -z "$bin" ]; then
    echo "Aucun Postgres disponible : ni variables de connexion, ni binaires locaux." >&2
    echo "Installer postgresql, ou exporter PGHOST/PGPORT/PGUSER/PGDATABASE." >&2
    exit 2
  fi

  CLUSTER_DIR="${TMPDIR:-/tmp}/tradevault-pgtest-$$"
  OWN_CLUSTER=1
  # Un port libre plutôt qu'un port fixe : un cluster déjà lancé sur la machine
  # ferait échouer le démarrage avec un message que personne ne relie à ça.
  PORT=${TV_TEST_PGPORT:-0}
  if [ "$PORT" = "0" ]; then
    PORT=$(python3 -c "import socket;s=socket.socket();s.bind((\"127.0.0.1\",0));print(s.getsockname()[1]);s.close()" 2>/dev/null || echo 55432)
  fi
  rm -rf "$CLUSTER_DIR"
  mkdir -p "$CLUSTER_DIR"

  # `initdb` refuse de tourner en root : on bascule sur l'utilisateur `postgres`
  # quand il existe, ce qui est le cas des images Debian/Ubuntu et de la CI.
  if [ "$(id -u)" = "0" ] && id postgres >/dev/null 2>&1; then
    chown postgres:postgres "$CLUSTER_DIR"
    su postgres -c "$bin/initdb -D $CLUSTER_DIR -U postgres --auth=trust -E UTF8" >/dev/null
    su postgres -c "$bin/pg_ctl -D $CLUSTER_DIR -o '-p $PORT -k $CLUSTER_DIR' -l $CLUSTER_DIR/log start" >/dev/null
  else
    "$bin/initdb" -D "$CLUSTER_DIR" -U postgres --auth=trust -E UTF8 >/dev/null
    "$bin/pg_ctl" -D "$CLUSTER_DIR" -o "-p $PORT -k $CLUSTER_DIR" -l "$CLUSTER_DIR/log" start >/dev/null
  fi

  export PGHOST="$CLUSTER_DIR" PGPORT="$PORT" PGUSER=postgres PGDATABASE=tradevault_test
  # Laisser au serveur le temps d'accepter les connexions.
  for _ in $(seq 1 30); do
    "$bin/pg_isready" -h "$PGHOST" -p "$PGPORT" >/dev/null 2>&1 && break
    sleep 0.3
  done
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -q \
    -c "drop database if exists $PGDATABASE;" -c "create database $PGDATABASE;"
}

stop_local_cluster() {
  if [ "$OWN_CLUSTER" = "1" ] && [ -n "$CLUSTER_DIR" ]; then
    local bin
    bin=$(find_pg_bin)
    if [ "$(id -u)" = "0" ] && id postgres >/dev/null 2>&1; then
      su postgres -c "$bin/pg_ctl -D $CLUSTER_DIR stop -m immediate" >/dev/null 2>&1 || true
    else
      "$bin/pg_ctl" -D "$CLUSTER_DIR" stop -m immediate >/dev/null 2>&1 || true
    fi
    rm -rf "$CLUSTER_DIR"
  fi
}
trap stop_local_cluster EXIT

if [ -z "${DATABASE_URL:-}" ] && [ -z "${PGDATABASE:-}" ]; then
  start_local_cluster
fi

# Deux façons de désigner la base : une URL complète, ou les variables PG*.
# `psql` lit les PG* tout seul, donc le cas courant ne demande aucun argument —
# et c'est ce chemin que prend la CI, avec son conteneur de service.
CONN="${DATABASE_URL:-}"
psql_run() {
  if [ -n "$CONN" ]; then
    psql "$CONN" -v ON_ERROR_STOP=1 -q "$@"
  else
    psql -v ON_ERROR_STOP=1 -q "$@"
  fi
}

echo "→ socle de test"
psql_run -f tests/sql/harness.sql
echo "→ migration $MIGRATION"
# Le filtrage des NOTICE passait par un tube suivi de `|| true` : le code de
# sortie observé était alors celui de `grep`, donc une migration EN ERREUR
# passait pour un succès. On capture la sortie, on vérifie le code de `psql`,
# et on n'affiche les NOTICE que si tout va bien.
MIGRATION_LOG=$(mktemp)
if ! psql_run -f "$MIGRATION" >"$MIGRATION_LOG" 2>&1; then
  grep -v "^NOTICE:" "$MIGRATION_LOG" >&2 || true
  rm -f "$MIGRATION_LOG"
  echo "ÉCHEC : la migration ne s'applique pas." >&2
  exit 1
fi
rm -f "$MIGRATION_LOG"
echo "→ assertions de facturation et de quota"
psql_run -f tests/sql/billing.sql
echo "→ concurrence (deux sessions simultanées)"
if [ -n "$CONN" ]; then
  PSQL_ARGS="$CONN" bash tests/sql/concurrency.sh
else
  PSQL_ARGS="-h ${PGHOST} -p ${PGPORT} -U ${PGUSER} -d ${PGDATABASE}" bash tests/sql/concurrency.sh
fi

echo
echo "SQL: tout est vert."
