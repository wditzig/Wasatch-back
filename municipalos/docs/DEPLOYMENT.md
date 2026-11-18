# Deployment

**Nothing has been deployed. No cloud accounts, domains or infrastructure exist, and none will be
created without explicit approval.** This document describes local setup precisely and the
intended production shape at the level of decisions still to be made.

## Local environment

| Requirement | Version                                        |
| ----------- | ---------------------------------------------- |
| Node.js     | 22+                                            |
| pnpm        | 10                                             |
| PostgreSQL  | 16 (`docker compose up -d`, or a local server) |

```bash
pnpm install
cp .env.example .env
pnpm db:setup      # roles municipalos_owner / municipalos_app, databases *_dev and *_test
pnpm db:migrate
pnpm db:seed
pnpm dev
```

`scripts/db-setup.sh` runs `sudo -u postgres psql` by default. For Docker or CI:
`PGSUPER="psql -h localhost -U postgres" PGPASSWORD=postgres pnpm db:setup`.

### Environment variables

| Variable                                           | Used by              | Purpose                                                                                     |
| -------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                     | api                  | Runtime connection as the restricted role                                                   |
| `DATABASE_MIGRATION_URL`                           | migrate/seed scripts | Schema owner connection                                                                     |
| `TEST_DATABASE_URL`, `TEST_DATABASE_MIGRATION_URL` | tests                | Test database (rebuilt on every run)                                                        |
| `API_PORT`                                         | api                  | Default 4000                                                                                |
| `API_URL`                                          | city-web, staff      | Where the web tier reaches the API                                                          |
| `SESSION_TTL_HOURS`                                | api                  | Default 12                                                                                  |
| `PUBLIC_SITE_URL`                                  | api                  | Origin used in tracking links                                                               |
| `EMAIL_TRANSPORT`                                  | api                  | Only `console` exists                                                                       |
| `SESSION_IDLE_MINUTES`                             | api                  | Idle timeout; default 30                                                                    |
| `STORAGE_DIR`                                      | api                  | Directory for uploaded photos (local-disk driver); default `.data/uploads` at the repo root |
| `PLATFORM_HOSTS`                                   | city-web             | Hostnames never treated as a city's own domain; default `localhost,127.0.0.1`               |
| `RATE_LIMIT_SCALE`                                 | api                  | Multiplier for rate limits; keep at 1 outside automated e2e runs                            |

The API validates its environment at startup and exits with a readable message if it is wrong.
It also refuses to start if `DATABASE_URL` uses a role that could bypass row-level security.

## Migrations

- Change `packages/database/src/schema.ts`, run `pnpm --filter @municipalos/database generate`,
  review the SQL, commit it.
- Policies, grants and functions are hand-written SQL migrations
  (`drizzle-kit generate --custom`). Every new tenant table needs RLS + grants in the same change.
- `pnpm db:migrate` applies pending migrations as the owner role. Migrations are forward-only.
- `pnpm db:reset` only works on databases whose name ends in `_dev` or `_test`.

## Target production shape (proposal — requires owner decisions)

| Concern         | Proposal                                                                                                                         | Decision needed                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Hosting         | Three containers (api, city-web, staff) on a managed container platform in a US region                                           | Cloud provider; GovCloud or commercial |
| Database        | Managed PostgreSQL 16, private networking, PITR, encrypted, PostGIS + pgvector available                                         | Provider/tier                          |
| Identity        | Managed OIDC provider with MFA for staff                                                                                         | Vendor (ADR-004)                       |
| Object storage  | S3-compatible private bucket behind the existing `ObjectStorage` interface (keys are already tenant-prefixed); malware scanning  | With hosting                           |
| Background jobs | Email already uses a Postgres outbox with retry, polled by the API process; move the worker to its own process when scaling out  | —                                      |
| Email           | Transactional provider with per-city sender domains                                                                              | Vendor                                 |
| Edge            | CDN/WAF in front of web apps; API not publicly routable except via web tier (and later an API gateway for integrations)          | With hosting                           |
| Secrets         | Platform secret manager; no secrets in images or repo                                                                            | With hosting                           |
| Observability   | Structured logs, error tracking, uptime checks, DB metrics, alerting                                                             | Vendor                                 |
| Environments    | dev → staging (synthetic data) → production; migrations run as a release step                                                    | —                                      |
| Custom domains  | Host → city routing is built (`municipality_domains` + city-web proxy). Remaining: automated TLS per hostname and DNS onboarding | With hosting                           |

## Release checklist (to be automated)

CI green · migrations reviewed · backup verified · staged rollout · smoke test (health, login,
submit + track a request) · rollback plan. Production deployment requires explicit approval.

## Backup and recovery

Not implemented. Requirements: automated daily backups + PITR, quarterly restore test, documented
RPO/RTO agreed with the pilot municipality.
