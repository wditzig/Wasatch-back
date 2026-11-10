# Database schema

PostgreSQL 16. Schema source: `packages/database/src/schema.ts` (Drizzle). Migrations:
`packages/database/drizzle/` — `0000` is generated from the schema, `0001` adds row-level security
and grants by hand, `0002` adds a monotonic `seq` to request events (events written in one
transaction share a timestamp, so history is ordered by `seq`).

Conventions: `uuid` primary keys (`gen_random_uuid()`), `timestamptz` timestamps,
`municipality_id` on tenant-owned tables, `UNIQUE (municipality_id, id)` on parents so children
use composite foreign keys.

## Roles

| Role                | Used by            | Privileges                                                          |
| ------------------- | ------------------ | ------------------------------------------------------------------- |
| `municipalos_owner` | migrations, seed   | Owns the schema. Still subject to RLS (`FORCE ROW LEVEL SECURITY`). |
| `municipalos_app`   | the API at runtime | No superuser, no `BYPASSRLS`, owns nothing. Table grants below.     |

## Tables

Classification: **Public** (shown on websites), **Internal** (staff only), **Sensitive**
(personal data or security material), **Restricted** (append-only evidence).

| Table                        | Scope              | RLS            | App grants             | Classification        | Notes                                                                                               |
| ---------------------------- | ------------------ | -------------- | ---------------------- | --------------------- | --------------------------------------------------------------------------------------------------- |
| `municipalities`             | platform           | –              | SELECT                 | Public                | slug, name, state, timezone, tracking prefix, status                                                |
| `municipality_domains`       | platform           | –              | SELECT                 | Public                | hostname → municipality                                                                             |
| `users`                      | platform           | –              | SELECT                 | Sensitive             | email, name, password hash, platform-admin flag                                                     |
| `sessions`                   | platform           | –              | SELECT, INSERT, UPDATE | Sensitive             | token **hash**, expiry, revocation                                                                  |
| `municipality_settings`      | tenant             | ✓              | SELECT                 | Public                | branding, contact, anonymous-reporting policy                                                       |
| `module_entitlements`        | tenant             | ✓              | SELECT                 | Internal              | which modules a city has                                                                            |
| `departments`                | tenant             | ✓              | SELECT                 | Public                |                                                                                                     |
| `roles`, `role_permissions`  | tenant             | ✓              | SELECT                 | Internal              | per-city roles; system defaults seeded                                                              |
| `staff_memberships`          | tenant             | ✓ (+ own rows) | SELECT                 | Internal              | user ↔ city, role, department                                                                       |
| `announcements`              | tenant             | ✓              | SELECT                 | Public once published |                                                                                                     |
| `service_request_categories` | tenant             | ✓              | SELECT                 | Public                | routes to a department; suggestion keywords                                                         |
| `service_requests`           | tenant             | ✓              | SELECT, INSERT, UPDATE | Mixed                 | description/location/status are resident-visible via tracking number; `reporter_*` is **Sensitive** |
| `service_request_events`     | tenant             | ✓              | SELECT, INSERT         | Restricted            | append-only history; `visibility` = public / internal                                               |
| `notifications`              | tenant             | ✓              | SELECT, INSERT, UPDATE | Sensitive             | in-app (staff) and email (resident address)                                                         |
| `audit_events`               | tenant or platform | ✓              | SELECT, INSERT         | Restricted            | append-only; platform events (NULL tenant) are write-only to the app                                |

Tables are read-only to the runtime role until the feature that manages them ships; widen grants
in that feature's migration.

## Row-level security

```sql
CREATE POLICY tenant_isolation ON <table>
  USING (municipality_id = app_current_tenant())
  WITH CHECK (municipality_id = app_current_tenant());
```

`app_current_tenant()` reads the transaction-local setting `app.tenant_id`, set by `withTenant()`.
With no tenant set, tenant tables return no rows and reject writes. `staff_memberships` has one
extra SELECT policy (`user_id = app_current_user()`) so a signed-in user can list the cities they
work for.

## Integrity rules worth knowing

- `service_requests.reference` is globally unique and random (`CR-7K3M9Q2X`).
- `(municipality_id, idempotency_key)` is unique when a key is present — safe retries.
- Status values and coordinate pairs are CHECK-constrained.
- Category → department, request → category/department, event → request, membership →
  role/department are all composite foreign keys including `municipality_id`.

## Entities planned but not yet created

Residents (accounts), website pages and content revisions, documents, knowledge sources, permit
types / applications / reviews, AI interactions, subscriptions. They are added with the milestone
that uses them (see roadmap) rather than as unused tables.

## Retention and deletion

No retention automation exists yet. Design constraints for when it does: retention periods are
configurable per municipality and record type; government records that must legally be kept are
not resident-deletable; audit and history tables are never edited.

## PostGIS

Coordinates are stored as `latitude`/`longitude` doubles. Duplicate detection uses a bounding
box. PostGIS will be introduced when a feature needs real spatial queries (service areas, map
search); the local Docker image already includes it.
