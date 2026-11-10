#!/usr/bin/env bash
# Creates the local development roles and databases. Idempotent.
# Usage: PGSUPER="psql -h localhost -U postgres" bash scripts/db-setup.sh
# Defaults to the local postgres OS user (sudo -u postgres psql).
set -euo pipefail
PGSUPER=${PGSUPER:-"sudo -u postgres psql"}

$PGSUPER -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'municipalos_owner') THEN
    CREATE ROLE municipalos_owner LOGIN PASSWORD 'dev_owner_password' NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'municipalos_app') THEN
    -- The runtime role must never be a superuser, table owner, or BYPASSRLS.
    CREATE ROLE municipalos_app LOGIN PASSWORD 'dev_app_password' NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;
SELECT 'CREATE DATABASE municipalos_dev OWNER municipalos_owner'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'municipalos_dev')\gexec
SELECT 'CREATE DATABASE municipalos_test OWNER municipalos_owner'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'municipalos_test')\gexec
\c municipalos_dev
CREATE EXTENSION IF NOT EXISTS citext;
\c municipalos_test
CREATE EXTENSION IF NOT EXISTS citext;
SQL
echo "Databases ready. Next: pnpm db:migrate && pnpm db:seed"
