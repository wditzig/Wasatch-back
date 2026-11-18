# API specification

The authoritative, machine-readable description is generated from the route definitions:

- Live: `GET http://localhost:4000/openapi.json`
- Committed snapshot: [openapi.json](openapi.json) (`pnpm --filter @municipalos/api openapi`)

Request and response schemas are Zod schemas; the same objects validate input at runtime and
produce the OpenAPI document, so the two cannot drift.

## Conventions

| Topic               | Rule                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Base path           | `/v1`                                                                                                              |
| Authentication      | `Authorization: Bearer <session token>` for `/v1/staff/*` and `/v1/auth/{me,logout}`. Public routes need none.     |
| Tenancy             | Municipality slug in the path. Staff access requires an active membership there.                                   |
| Validation          | Zod; failures return 422 `validation_failed` with `details.issues[] = { path, message }`                           |
| Errors              | `{ "error": { "code", "message", "details?" }, "requestId" }` — stable `code`, human `message`, never stack traces |
| Pagination          | `?page=1&pageSize=25` (max 100) → `{ items, pagination: { page, pageSize, total } }`                               |
| Filtering / sorting | Explicit, whitelisted query parameters per route (`status`, `departmentId`, `assignee`, `q`, `sort`)               |
| Idempotency         | `Idempotency-Key` header on `POST …/service-requests`; replay returns 200 with the original result                 |
| Concurrency         | Status changes are guarded by the stored status; a lost race returns 409 `stale_status`                            |
| Rate limiting       | Per client address (and per account for login); 429 with `Retry-After`                                             |
| Caching             | `Cache-Control: no-store` on all `/v1` responses                                                                   |
| Request ids         | `X-Request-Id` accepted and echoed; included in every error and audit record                                       |
| Body limit          | 64 KB for JSON; 15 MB per photo upload                                                                             |

Status codes: 200/201 success · 400 unreadable · 401 not signed in · 403 not permitted ·
404 not found _or not visible to you_ · 409 state conflict · 422 invalid input · 429 rate limited.

## Endpoints

### Public (`/v1/public`)

| Method & path                                                              | Purpose                                                                         |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `GET /municipalities`                                                      | Cities using MunicipalOS                                                        |
| `GET /domains/{hostname}`                                                  | Resolve a website hostname to a city                                            |
| `GET /municipalities/{slug}`                                               | Website data: branding, contact, departments, announcements, enabled modules    |
| `GET /municipalities/{slug}/service-categories`                            | Categories residents can choose                                                 |
| `POST /municipalities/{slug}/service-categories/suggest`                   | Advisory category suggestion + emergency-wording flag (keyword rules)           |
| `POST /municipalities/{slug}/service-requests`                             | Submit a request → tracking number                                              |
| `GET /municipalities/{slug}/service-requests/{reference}`                  | Public status and timeline (no contact data, no staff names, no internal notes) |
| `POST /municipalities/{slug}/service-requests/{reference}/messages`        | Resident adds information to an open request                                    |
| `POST /municipalities/{slug}/service-requests/{reference}/attachments`     | Resident adds a photo (multipart; re-encoded, metadata removed; max 4)          |
| `GET /municipalities/{slug}/service-requests/{reference}/attachments/{id}` | Photo bytes for the tracking-number holder                                      |

### Auth (`/v1/auth`)

| Method & path  | Purpose                                                         |
| -------------- | --------------------------------------------------------------- |
| `POST /login`  | Email + password → bearer token (development identity provider) |
| `POST /logout` | Revoke the session                                              |
| `GET /me`      | User and the municipalities they work for                       |

### Staff (`/v1/staff/{slug}`)

| Method & path                                                       | Permission                      | Purpose                                                                 |
| ------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------- |
| `GET /me`                                                           | member                          | Role, department, permissions, unread count                             |
| `GET /dashboard`                                                    | member                          | Queue, triage list, counts, metrics (scoped to what the caller can see) |
| `GET /departments`                                                  | member                          | Departments (for filters)                                               |
| `GET /service-requests`                                             | `read_all` or `read_department` | List with filters and pagination                                        |
| `GET /service-requests/{id}`                                        | same                            | Detail, full history, allowed transitions, possible duplicates          |
| `POST /service-requests/{id}/status`                                | per transition                  | Move through the workflow                                               |
| `GET /service-requests/{id}/assignable-staff`                       | `assign`                        | Who may be assigned                                                     |
| `POST /service-requests/{id}/assign`                                | `assign`                        | Assign / reassign                                                       |
| `POST /service-requests/{id}/comments`                              | `comment`                       | Internal note or resident-visible message                               |
| `POST /service-requests/{id}/attachments`                           | `comment`                       | Add a photo, e.g. of the completed work                                 |
| `GET /service-requests/{id}/attachments/{attachmentId}`             | can see request                 | Photo bytes                                                             |
| `GET /service-requests/{id}/export`                                 | `records.export`                | Complete record as a JSON download (audited)                            |
| `GET /service-requests/{id}/holds` · `POST …/holds`                 | `records.manage`                | List / place legal holds                                                |
| `POST /records/holds/{id}/release`                                  | `records.manage`                | Release a hold (note required)                                          |
| `GET /records/retention` · `PUT /records/retention/service_request` | `records.manage`                | Retention schedule                                                      |
| `GET /records/disposition` · `POST /records/disposition`            | `records.manage`                | Review list / disposition confirmed records                             |
| `GET /admin/categories` · `POST` · `PATCH /admin/categories/{id}`   | `categories.manage`             | Request categories and routing                                          |
| `GET /admin/settings` · `PUT`                                       | `settings.manage`               | Branding, contact details, reporting policy                             |
| `GET /admin/staff` · `GET /admin/roles`                             | `staff.read`                    | Access review                                                           |
| `PATCH /admin/staff/{id}`                                           | `staff.manage`                  | Change role, department, title, status (never your own)                 |
| `GET /notifications` · `POST /notifications/read`                   | member                          | Caller's own notifications                                              |
| `GET /audit-events` · `GET /audit-events/export`                    | `audit.read`                    | Audit log; CSV export (audited)                                         |

### Operational

`GET /healthz` (checks the database) · `GET /openapi.json`.

### Website CMS

Public (`/v1/public`) — only live, published content; drafts, pages in review, future-scheduled
and archived pages return 404:

| Method & path                                 | Purpose                                                   |
| --------------------------------------------- | --------------------------------------------------------- |
| `GET /municipalities/{slug}/pages`            | Published pages shown in the website menu                 |
| `GET /municipalities/{slug}/pages/{pageSlug}` | A published page: title, content blocks, publication time |

Staff (`/v1/staff/{slug}/content`):

| Method & path                      | Permission                                        | Purpose                                                                                                           |
| ---------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `GET /pages`                       | `content.read`                                    | Pages with live / scheduled / draft / in-review state                                                             |
| `POST /pages`                      | `content.edit`                                    | Create a page (empty private draft). 409 `slug_taken`                                                             |
| `GET /pages/{id}`                  | `content.read`                                    | Live, scheduled and working revisions, history, and which actions the caller may take                             |
| `PUT /pages/{id}/draft`            | `content.edit`                                    | Save the draft; `expectedVersion` guards concurrent edits (409 `stale_draft`); 409 `in_review` while under review |
| `POST /pages/{id}/submit`          | `content.edit`                                    | Draft → In review; notifies staff who can publish                                                                 |
| `POST /pages/{id}/publish`         | `content.publish`                                 | In review → Published, now or at `publishAt` (must be in the future)                                              |
| `POST /pages/{id}/request-changes` | `content.publish`                                 | In review → Draft with a required note; notifies the author                                                       |
| `POST /pages/{id}/archive`         | `content.publish`                                 | Remove the page from the public site (history kept)                                                               |
| `POST /pages/{id}/restore`         | `content.edit`                                    | Copy the archived content into a new draft, which must be reviewed again                                          |
| `PUT /pages/{id}/navigation`       | `content.publish`                                 | Show/hide in the website menu and set its position                                                                |
| `GET /announcements`               | `content.read`                                    | All announcements with status draft / published / expired                                                         |
| `POST /announcements`              | `content.edit`                                    | Create a draft announcement                                                                                       |
| `PUT /announcements/{id}`          | `content.edit` (`content.publish` once published) | Edit an announcement                                                                                              |
| `POST /announcements/{id}/publish` | `content.publish`                                 | Publish, optionally until `expiresAt`                                                                             |
| `POST /announcements/{id}/expire`  | `content.publish`                                 | Stop showing a published announcement                                                                             |

Content is a list of typed blocks (`heading`, `text`, `callout`, `links`, `contact`,
`service_links`) validated by `contentBlocksSchema`. There is no HTML or Markdown block, and link
targets must be `https:`, `mailto:`, `tel:` or a site-relative path. There is no route that
publishes without `content.publish`, and no draft → published shortcut.

`GET /v1/staff/{slug}/me` now also returns the municipality's `timezone`.

## Not yet available

API keys / OAuth clients for third-party integrations, webhooks, resident account endpoints,
staff invitations and custom role editing, document (non-photo) uploads.
