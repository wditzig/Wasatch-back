# Architecture

## System overview

```
 Resident browser          Staff browser
       │                        │
       ▼                        ▼
 ┌────────────┐          ┌────────────┐
 │  city-web  │          │   staff    │   Next.js (server components + server actions)
 │  :3000     │          │   :3001    │   Hold no data. Staff session token lives in an
 └─────┬──────┘          └─────┬──────┘   httpOnly cookie and is forwarded as a bearer token.
       │   server-to-server    │
       └──────────┬────────────┘
                  ▼
            ┌───────────┐
            │    api    │   Hono + Zod + OpenAPI. The single security boundary:
            │   :4000   │   authentication, tenant resolution, authorization, validation,
            └─────┬─────┘   rate limiting, audit logging, business rules.
                  ▼
            ┌───────────┐
            │ PostgreSQL│   Row-level security on every tenant table. The API connects as a
            └───────────┘   role that cannot bypass it.
```

Browsers never call the API directly. The web apps are thin: they render, collect input and call
the API. All rules live in the API and the database, so a future mobile app or third-party
integration gets the same guarantees.

## Application boundaries

| Unit            | Responsibility                                                      | Must not                                                            |
| --------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `apps/api`      | All reads/writes, authn/authz, workflow rules, notifications, audit | Render UI                                                           |
| `apps/city-web` | Public site and resident flows for every municipality               | Hold secrets, apply business rules, trust its own filtering         |
| `apps/staff`    | Employee dashboard                                                  | Decide permissions (it only hides what the API would refuse anyway) |
| `packages/*`    | Pure shared logic (no I/O except `database`)                        | Depend on apps                                                      |

It is a modular monolith: one API process, one database. No microservices, queue or cache until
load or team structure justifies them (see DECISIONS.md).

## Multi-tenancy

One database, shared schema, `municipality_id` on every tenant-owned row. Isolation is enforced in
three independent layers:

1. **Tenant resolution (API).** Staff routes are `/v1/staff/{slug}/…`. The slug is only a
   request. `requireStaff` looks up the caller's _active staff membership_ in that municipality;
   no membership → 403 and an audit event. Platform administrators have no implicit access.
2. **Row-level security (PostgreSQL).** Every request runs inside `withTenant()`, a transaction
   that sets `app.tenant_id`. Policies on each tenant table restrict both reads and writes to that
   tenant. The API's database role is not a superuser, not the table owner and has no `BYPASSRLS`;
   the API refuses to start otherwise. A query that forgets its `WHERE` clause still cannot cross
   tenants.
3. **Composite foreign keys.** Children reference parents by `(municipality_id, id)`, so a row
   can never point at another tenant's department, category, role or request.

Platform-level tables (`municipalities`, `municipality_domains`, `users`, `sessions`) are not
tenant-scoped; they hold no municipal records.

A user is a global identity; a _staff membership_ ties a user to one municipality with one role
and optionally one department. The same person could work for two cities with different roles.

### Websites and domains

`city-web` serves every city from one deployment at `/{city-slug}/…`. `municipality_domains` maps
hostnames to municipalities and the API can resolve them (`GET /v1/public/domains/{hostname}`),
but host-based routing (custom domains → slug rewrite) is **not wired yet** (backlog P1).

## Authentication

Development identity provider: email + password (scrypt), opaque 256-bit session tokens, only
SHA-256 digests stored, server-side revocation, 12-hour expiry. The API's only dependency on it is
"bearer token → user id" (`requireSession`), which is where a managed provider (OIDC) plugs in.
**MFA is not implemented; a managed identity provider is a pilot prerequisite** (ADR-004).

Residents do not need accounts. A request's tracking number is an unguessable capability that
shows only non-sensitive fields. Resident accounts are a later milestone.

## Authorization

- Permissions are strings (`service_requests.assign`); roles are per-municipality bundles stored
  in the database, seeded from system defaults, so custom roles need no code change.
- Two visibility scopes for requests: `read_all` and `read_department` (own department only).
  Out-of-scope records return 404, not 403.
- Workflow transitions each name the permission they need; the engine checks it.
- The database role itself is least-privilege: e.g. it has no `UPDATE`/`DELETE` on audit or
  history tables and cannot modify roles, memberships or users at all yet.

## Workflow engine

`packages/workflows` defines a workflow as data: states plus transitions, each with a required
permission and optional "note required" / "assignee required" flags. The engine answers "is this
transition allowed?" and "what can this user do next?". The API persists the change with an
optimistic guard (`UPDATE … WHERE status = <expected>`), writes an append-only event, an audit
record and notifications in one transaction. Permits and content approval will reuse it.

## Notifications

Notification rows are written in the same transaction as the change. In-app notifications go to
staff. Resident emails are queued and delivered after commit through an `EmailTransport`; only a
console transport exists today (no real email leaves the system). Delivery is in-process — a
durable job queue is required before production (backlog P1).

## AI architecture (planned, not built)

Nothing in the current system calls a language model. The category suggestion and emergency
wording check are deterministic keyword rules and are labelled as such. The planned design is in
AI_GOVERNANCE.md: a provider-independent `packages/ai` orchestration layer, per-tenant retrieval
with citations, logged interactions, cost limits and human approval for anything consequential.

## Deployment shape (target)

Three stateless containers (api, city-web, staff) behind a load balancer/CDN, managed PostgreSQL
with PITR, S3-compatible storage for uploads, secrets from the platform's secret manager. Details
and what is missing are in DEPLOYMENT.md.

## Principal risks

| Risk                                         | Mitigation / status                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Cross-tenant data exposure                   | Three-layer isolation + automated tests at API and SQL level. Needs independent penetration test. |
| Home-grown authentication                    | Standard primitives only; replace with managed IdP + MFA before pilot.                            |
| In-memory rate limiting and in-process email | Fine for one instance; Redis + job queue before scale-out.                                        |
| `X-Forwarded-For` trust                      | API must only be reachable from the web tier / load balancer.                                     |
| Tracking number as bearer capability         | 40-bit random, rate limited, exposes no contact data; revisit with resident accounts.             |
| Accessibility regressions                    | Automated axe scans in CI + documented manual checks; no compliance claim made.                   |
| AI hallucinating policy (future)             | No AI ships until retrieval, citations, evaluation and refusal behaviour exist.                   |
