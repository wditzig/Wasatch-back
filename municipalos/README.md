# MunicipalOS

An AI-native, multi-tenant operating system for local government. One platform gives each
municipality a branded website, resident services, and a staff dashboard, with every city's data
isolated from every other's.

> **Status: Phase 1 foundation.** The first vertical slice — a resident reports a problem, the
> right department works it, the resident sees the result — is implemented end to end with
> persistent data and automated tests. This is **not production-ready**; see
> [Feature status](#feature-status) and [docs/SECURITY.md](docs/SECURITY.md). All data in this
> repository is synthetic.

## What works today

| Area                                                                                                                                    | State                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Multi-tenant foundation (PostgreSQL row-level security, tenant-scoped API, roles, audit log)                                            | Working, tested                                                                        |
| Service requests: resident submit / track / reply / photos                                                                              | Working, tested                                                                        |
| Service requests: staff queue, triage, assign, status, notes, messages, completion photos                                               | Working, tested                                                                        |
| Staff dashboard (role-aware queue, metrics, notifications, audit log)                                                                   | Working                                                                                |
| Municipal website: per-city branding, services, departments, announcements, accessibility and privacy statements, custom-domain routing | Working, tested                                                                        |
| Website CMS: pages from reusable blocks, preview, draft → review → publish, scheduling, archive, menu, announcements                    | Working, tested. Missing: documents, meetings, homepage/footer editing                 |
| Administration: request categories and routing, city settings, staff access and role reference                                          | Working, tested                                                                        |
| Records management: retention schedule, legal holds, approved disposition, record and audit-log export                                  | Working, tested                                                                        |
| Resident email                                                                                                                          | Queued durably with retry; **no real provider connected, so nothing is actually sent** |
| OpenAPI document                                                                                                                        | Generated from code: [docs/openapi.json](docs/openapi.json)                            |

Not built yet: AI knowledge engine, permitting, resident mobile app, platform administration,
resident accounts, MFA / managed identity, any deployment. See
[docs/DEVELOPMENT_ROADMAP.md](docs/DEVELOPMENT_ROADMAP.md).

**Compliance:** MunicipalOS holds no certification or attestation. The structure for government
requirements (accessibility, security controls, records retention, privacy) and its honest
status are in [docs/COMPLIANCE.md](docs/COMPLIANCE.md).

## Quick start

Requirements: Node 22+, pnpm 10, PostgreSQL 16 (`docker compose up -d` provides one).

```bash
pnpm install
cp .env.example .env
pnpm db:setup            # creates roles + dev/test databases (see script for PGSUPER override)
pnpm db:migrate
pnpm db:seed             # two fictional cities: Cedar Ridge, UT and Marlow Springs, CO
pnpm dev                 # API :4000, city website :3000, staff dashboard :3001
```

- Resident site: http://localhost:3000
- Staff dashboard: http://localhost:3001 — sign in with a seeded account, e.g.
  `luis.ortega@cedarridge.example` (Public Works Director). All seeded accounts share the
  development password printed by `pnpm db:seed`. The full list is in
  [docs/TESTING.md](docs/TESTING.md#seeded-accounts).
- API description: http://localhost:4000/openapi.json

## Commands

| Command                                        | Purpose                                                                 |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`                                     | Run all apps in watch mode                                              |
| `pnpm test`                                    | Unit tests + API integration/security tests (needs the test database)   |
| `pnpm test:e2e`                                | Playwright end-to-end + accessibility tests (run `pnpm db:reset` first) |
| `pnpm lint` / `pnpm typecheck` / `pnpm format` | Static checks                                                           |
| `pnpm db:reset`                                | Drop, migrate and reseed the development database                       |
| `pnpm --filter @municipalos/api openapi`       | Regenerate `docs/openapi.json`                                          |

## Repository layout

```
apps/
  api/         Hono REST API — the only component that talks to the database
  city-web/    Next.js public municipal website + resident services (all cities)
  staff/       Next.js employee dashboard
packages/
  database/    Drizzle schema, SQL migrations (incl. row-level security), seed data
  permissions/ Permission catalogue, system roles, visibility rules
  workflows/   Small state-machine engine + the service request workflow
  validation/  Zod schemas shared by API and web apps
  auth/        Password hashing and session token primitives (development identity provider)
  notifications/ Email transport interface and templates
  ui/          Design system: tokens and accessible React components
docs/          Architecture, security, testing, roadmap, decisions
tests/e2e/     Playwright end-to-end and accessibility tests
```

`marketing`, `resident-mobile` and `platform-admin` apps and the `ai` and `integrations` packages
are intentionally not scaffolded until their milestone starts — empty shells would misrepresent
progress.

## Documentation

[Architecture](docs/ARCHITECTURE.md) · [Product requirements](docs/PRODUCT_REQUIREMENTS.md) ·
[Database](docs/DATABASE_SCHEMA.md) · [API](docs/API_SPECIFICATION.md) ·
[Security](docs/SECURITY.md) · [AI governance](docs/AI_GOVERNANCE.md) ·
[Compliance](docs/COMPLIANCE.md) ·
[Roadmap & backlog](docs/DEVELOPMENT_ROADMAP.md) · [Deployment](docs/DEPLOYMENT.md) ·
[Testing](docs/TESTING.md) · [Decisions](docs/DECISIONS.md)

## Feature status

Tracked honestly against the definition of done in
[docs/DEVELOPMENT_ROADMAP.md](docs/DEVELOPMENT_ROADMAP.md#feature-completion-status).
