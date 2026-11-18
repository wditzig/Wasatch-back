# Database schema

PostgreSQL 16. Schema source: `packages/database/src/schema.ts` (Drizzle). Migrations:
`packages/database/drizzle/` — `0000` is generated from the schema, `0001` adds row-level security
and grants by hand, `0002` adds a monotonic `seq` to request events (events written in one
transaction share a timestamp, so history is ordered by `seq`), `0003`/`0004` add request photos,
the email outbox columns and administration grants, `0005`/`0006` add website content, and
`0007`/`0008` add retention schedules, legal holds and the disposition guard.

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

| Table                         | Scope              | RLS            | App grants                                            | Classification        | Notes                                                                                                                               |
| ----------------------------- | ------------------ | -------------- | ----------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `municipalities`              | platform           | –              | SELECT                                                | Public                | slug, name, state, timezone, tracking prefix, status                                                                                |
| `municipality_domains`        | platform           | –              | SELECT                                                | Public                | hostname → municipality                                                                                                             |
| `users`                       | platform           | –              | SELECT                                                | Sensitive             | email, name, password hash, platform-admin flag                                                                                     |
| `sessions`                    | platform           | –              | SELECT, INSERT, UPDATE                                | Sensitive             | token **hash**, expiry, revocation                                                                                                  |
| `municipality_settings`       | tenant             | ✓              | SELECT, UPDATE                                        | Public                | branding, contact, anonymous-reporting policy                                                                                       |
| `module_entitlements`         | tenant             | ✓              | SELECT                                                | Internal              | which modules a city has                                                                                                            |
| `departments`                 | tenant             | ✓              | SELECT                                                | Public                |                                                                                                                                     |
| `roles`, `role_permissions`   | tenant             | ✓              | SELECT                                                | Internal              | per-city roles; system defaults seeded                                                                                              |
| `staff_memberships`           | tenant             | ✓ (+ own rows) | SELECT, UPDATE (role, department, title, status only) | Internal              | user ↔ city, role, department                                                                                                       |
| `announcements`               | tenant             | ✓              | SELECT                                                | Public once published |                                                                                                                                     |
| `service_request_categories`  | tenant             | ✓              | SELECT, INSERT, UPDATE                                | Public                | routes to a department; suggestion keywords                                                                                         |
| `service_requests`            | tenant             | ✓              | SELECT, INSERT, UPDATE                                | Mixed                 | description/location/status are resident-visible via tracking number; `reporter_*` is **Sensitive**                                 |
| `service_request_events`      | tenant             | ✓              | SELECT, INSERT                                        | Restricted            | append-only history; `visibility` = public / internal                                                                               |
| `service_request_attachments` | tenant             | ✓              | SELECT, INSERT                                        | Sensitive             | photo metadata; bytes live in object storage under a tenant-scoped key                                                              |
| `notifications`               | tenant             | ✓              | SELECT, INSERT, UPDATE                                | Sensitive             | in-app (staff) and email (resident address); email rows double as the delivery outbox (`attempts`, `next_attempt_at`, `last_error`) |
| `retention_policies`          | tenant             | ✓              | SELECT, INSERT, UPDATE (period and authority only)    | Internal              | how long each record type is kept and under what authority                                                                          |
| `legal_holds`                 | tenant             | ✓              | SELECT, INSERT, UPDATE (release fields only)          | Sensitive             | never edited or deleted; a hold with no `released_at` blocks disposition                                                            |
| `audit_events`                | tenant or platform | ✓              | SELECT, INSERT                                        | Restricted            | append-only; platform events (NULL tenant) are write-only to the app                                                                |

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

- **Disposition guard (trigger).** `service_requests.dispositioned_at` can only be set once, only
  on a closed request, and never while a legal hold is active. This holds even if application
  checks are bypassed.
- **Legal hold target (trigger).** A hold must reference a record in the same municipality.

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

- Nothing is ever dispositioned automatically or by default. A record type with no retention
  period is kept permanently.
- When a city sets a period (with its legal authority), closed requests past it appear in a
  review list. An authorized person confirms specific records; the reporter's personal data is
  then redacted, and the record, its history and the audit trail are kept.
- Records under legal hold are excluded and protected by a database trigger.
- Audit and history tables are never edited.
- Not yet covered: photos, audit-log retention, expired sessions, whole-tenant export and
  deletion. See [data inventory](compliance/DATA_INVENTORY.md).

## PostGIS

Coordinates are stored as `latitude`/`longitude` doubles. Duplicate detection uses a bounding
box. PostGIS will be introduced when a feature needs real spatial queries (service areas, map
search); the local Docker image already includes it.

## Website CMS

Migrations `0005_website_content` (tables) and `0006_website_content_security` (row-level
security and grants).

| Table               | Scope  | RLS | App grants                       | Classification                                                                           | Notes                                                                                                                                                                                  |
| ------------------- | ------ | --- | -------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `website_pages`     | tenant | ✓   | SELECT, INSERT, UPDATE           | Internal (slug and menu settings are public once the page is live)                       | Identity and navigation only: `slug` unique per city, `show_in_nav`, `nav_order`. No content.                                                                                          |
| `content_revisions` | tenant | ✓   | SELECT, INSERT, UPDATE           | **Public** when live; **Internal** otherwise (drafts, review notes, author and reviewer) | One row per saved version: `title`, `blocks` (validated JSON, never HTML), `status`, `version`, author, reviewer, review note, `publish_at`, `published_at`. Composite FK to the page. |
| `announcements`     | tenant | ✓   | SELECT, **INSERT, UPDATE** (new) | Public once published                                                                    | Unchanged structure; now writable so staff can manage it. Draft = `published_at` is null.                                                                                              |

No `DELETE` is granted on any of the three: pages are archived, announcements are expired,
revisions are history.

**Which revision is public.** There is no "current revision" pointer to keep in sync. The live
revision of a page is the row with `status = 'published'` whose effective time
`coalesce(publish_at, published_at)` is the latest one not in the future. A scheduled revision
therefore takes over on the first read after its time, with no background job, and the previous
revision stays live until then.

**Integrity rules**

- `UNIQUE (page_id, revision_number)`; revision numbers only grow.
- A partial unique index allows at most one working revision (`draft` or `in_review`) per page.
- `version` increments on every save and is checked on write, so two editors cannot silently
  overwrite each other.
- `status` is CHECK-constrained to `draft`, `in_review`, `published`, `archived`.
- Approving a revision cancels (archives) any older revision still scheduled for a later time,
  so stale content cannot replace newer content afterwards.
