#!/usr/bin/env sh
# Recreate the local schema and load synthetic seed data. LOCAL DEVELOPMENT ONLY — destroys data.
# Usage: DATABASE_URL=postgresql://finpilot:finpilot@localhost:5432/finpilot ./scripts/db-reset.sh
set -eu
: "${DATABASE_URL:?set DATABASE_URL}"
case "$DATABASE_URL" in
  *localhost*|*127.0.0.1*|*@db:*) ;;
  *) echo "Refusing to reset a non-local database." >&2; exit 1 ;;
esac
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
for f in database/migrations/*.sql; do echo "migrate $f"; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"; done
for f in database/seed/*.sql; do echo "seed $f"; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"; done
