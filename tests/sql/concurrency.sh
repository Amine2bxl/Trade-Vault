#!/usr/bin/env bash
#
# La course que le code applicatif perdait.
#
# `recordPromoRedemption` lisait `uses_count`, puis écrivait `uses_count + 1`.
# Deux checkouts simultanés lisaient la MÊME valeur et écrivaient la MÊME
# valeur + 1 : sur un code à un seul usage, deux personnes obtenaient l'accès.
# Aucun test à session unique ne peut montrer ça — il faut deux connexions qui
# se chevauchent réellement.
#
# Le scénario : un code à UN SEUL usage, deux sessions qui le réclament en même
# temps. Exactement une doit obtenir `redeemed`, l'autre `exhausted`, et
# `uses_count` doit valoir 1 à la fin.
#
# Usage : PSQL_ARGS="-h /var/tmp -p 55432 -U postgres -d tv_test" ./concurrency.sh
set -euo pipefail

PSQL_ARGS=${PSQL_ARGS:-"-h ${PGHOST:-/var/tmp} -p ${PGPORT:-55432} -U ${PGUSER:-postgres} -d ${PGDATABASE:-tv_test}"}
# shellcheck disable=SC2086
run() { psql $PSQL_ARGS -v ON_ERROR_STOP=1 -tAq "$@"; }

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

run -c "
  delete from public.promo_redemptions where code = 'RACE1';
  delete from public.promo_codes where code = 'RACE1';
  insert into auth.users (id, email) values
    ('aaaaaaaa-0000-0000-0000-000000000001', 'race1@example.com'),
    ('aaaaaaaa-0000-0000-0000-000000000002', 'race2@example.com')
  on conflict (id) do nothing;
  insert into public.promo_codes (code, plan, max_uses) values ('RACE1', 'pro_yearly', 1);
" >/dev/null

# Les deux sessions ouvrent une transaction, attendent le même top de départ,
# puis appellent la fonction. `pg_sleep` avant l'appel garantit un vrai
# chevauchement : sans lui, la première aurait le temps de valider.
claim() {
  local uid=$1 email=$2 out=$3
  # shellcheck disable=SC2086
  psql $PSQL_ARGS -v ON_ERROR_STOP=1 -tAq -c "
    begin;
    select pg_sleep(0.25);
    select public.redeem_promo_code('RACE1', '$uid', '$email', 'pro_yearly', 'free');
    commit;
  " | tr -d '[:space:]' > "$out"
}

claim 'aaaaaaaa-0000-0000-0000-000000000001' 'race1@example.com' "$WORK/a" &
claim 'aaaaaaaa-0000-0000-0000-000000000002' 'race2@example.com' "$WORK/b" &
wait

A=$(cat "$WORK/a")
B=$(cat "$WORK/b")
COUNT=$(run -c "select uses_count from public.promo_codes where code = 'RACE1';" | tr -d '[:space:]')
ROWS=$(run -c "select count(*) from public.promo_redemptions where code = 'RACE1';" | tr -d '[:space:]')

echo "session A -> $A"
echo "session B -> $B"
echo "uses_count -> $COUNT   redemptions -> $ROWS"

fail() { echo "ÉCHEC: $1" >&2; exit 1; }

# Exactement un gagnant, exactement un perdant.
if [ "$A" = "redeemed" ] && [ "$B" = "exhausted" ]; then :
elif [ "$B" = "redeemed" ] && [ "$A" = "exhausted" ]; then :
else fail "max_uses=1 doit produire un 'redeemed' et un 'exhausted', obtenu A=$A B=$B"
fi

[ "$COUNT" = "1" ] || fail "uses_count doit valoir 1, vaut $COUNT"
[ "$ROWS" = "1" ]  || fail "une seule rédemption doit exister, il y en a $ROWS"

echo "CONCURRENCY OK — le verrou de ligne sérialise bien les rédemptions"
