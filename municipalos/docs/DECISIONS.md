# Architecture decision record

Short entries: context → decision → consequences. Newest last. Items marked **OWNER** need a
decision from the product owner before the stated milestone.

## ADR-001 — Modular monolith in a pnpm + Turborepo monorepo

One API process, one database, shared packages. No microservices, message bus or cache until a
measured need exists. Consequence: simple local setup and transactions; module boundaries are
enforced by package structure rather than network calls.

## ADR-002 — Shared-schema multi-tenancy with PostgreSQL row-level security

Alternatives: database-per-tenant (operationally heavy at hundreds of cities) or
application-only filtering (one missed `WHERE` is a breach). Decision: `municipality_id` on every
tenant row, RLS policies keyed on a transaction-local setting, a runtime role that cannot bypass
RLS, composite tenant foreign keys. Consequence: every tenant query must run inside
`withTenant()`; connection pooling must be transaction-mode compatible (it is: `SET LOCAL`
semantics). A dedicated database for a large or sensitive customer remains possible later.

## ADR-003 — API is the only security boundary; web apps are thin BFFs

Next.js apps call the API server-to-server; browsers never do. Consequence: no CORS surface, the
session token is never exposed to browser JavaScript, and mobile/third-party clients will get
identical enforcement. Cost: one extra hop.

## ADR-004 — Development identity provider now, managed identity before pilot — **OWNER**

The directive calls for managed authentication and staff MFA. No provider account or credentials
exist, and choosing one is a cost and vendor commitment. Decision: implement a minimal
password + opaque-session provider from standard primitives (scrypt, CSPRNG, SHA-256) behind a
single seam (`requireSession`), sufficient for development and automated tests; do **not** build
MFA, password reset or SSO ourselves. Consequence: staff login is not pilot-ready. Needed from
owner: vendor choice (e.g. WorkOS, Auth0, Clerk, Cognito, Entra ID B2C) weighing SSO with
municipal Microsoft/Google tenants, price per staff user, and government compliance posture.

## ADR-005 — Hono + Zod + generated OpenAPI

Small, standards-based (Fetch API) framework; route definitions carry Zod schemas that both
validate at runtime and generate the OpenAPI document. Tests call the app in-process without a
network port.

## ADR-006 — Drizzle ORM, SQL migrations checked in

Typed queries close to SQL; generated migration for tables, hand-written SQL for policies and
grants (ORMs do not model least-privilege grants well). Consequence: every new tenant table needs
a matching hand-written RLS/grant migration — called out in DEPLOYMENT.md.

## ADR-007 — Workflows as data

A workflow is a list of states and permissioned transitions interpreted by a ~100-line engine.
No visual designer, no external workflow service. Per-city workflow variants will be stored
definitions validated by the same engine.

## ADR-008 — Residents do not need accounts for service requests

A random tracking number is the capability to view non-sensitive status. Consequence: fastest
possible reporting; anything involving personal data (permits, saved history, preferences) will
require resident accounts, to be designed in Phase 2.

## ADR-009 — Rules before models

Category suggestion, emergency wording and duplicate hints are deterministic rules. They are
cheap, explainable and testable, and avoid shipping an AI dependency before retrieval,
evaluation and governance exist (AI_GOVERNANCE.md).

## ADR-010 — Design system as source-only package; shadcn-style, hand-written

`packages/ui` holds tokens (Tailwind v4 `@theme`) and a small set of accessible components in the
shadcn idiom (variants as classes, composition over configuration) without running the shadcn
generator or adding Radix yet — nothing built so far needs a complex widget. When dialogs,
comboboxes or menus are needed, add the corresponding shadcn/Radix components rather than
hand-rolling them. System font stack: no web-font download.

## ADR-011 — PostGIS deferred

Not installed in the build environment and not needed for bounding-box duplicate hints. Adopt
with the first feature needing spatial queries; coordinates migrate trivially to `geography`.

## ADR-012 — MunicipalOS lives in `municipalos/` inside the existing repository — **OWNER**

The only repository available to this work was an unrelated Godot game project. To avoid touching
it, all MunicipalOS code is isolated in `municipalos/` on a feature branch, with its own CI
workflow filtered to that path. Recommended: move it to a dedicated private repository (history
can be preserved with `git subtree split`) before more people or any deployment are involved.

## ADR-013 — Not scaffolding apps that have no functionality

`marketing`, `resident-mobile`, `platform-admin`, `packages/ai`, `packages/integrations` are
created when their milestone begins. Empty shells would look like progress and rot.

## Open questions for the owner

1. Identity provider (ADR-004).
2. Dedicated repository (ADR-012).
3. Cloud provider and region; commercial vs. government cloud (drives compliance path and cost).
4. AI model provider(s) and data-processing terms.
5. Pilot municipality: which permit types, which request categories, records-retention rules,
   and their accessibility/legal requirements.
6. Email/SMS providers and whether SMS is in the MVP.
