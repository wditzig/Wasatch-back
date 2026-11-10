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
| Body limit          | 64 KB                                                                                                              |

Status codes: 200/201 success · 400 unreadable · 401 not signed in · 403 not permitted ·
404 not found _or not visible to you_ · 409 state conflict · 422 invalid input · 429 rate limited.

## Endpoints

### Public (`/v1/public`)

| Method & path                                                       | Purpose                                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `GET /municipalities`                                               | Cities using MunicipalOS                                                        |
| `GET /domains/{hostname}`                                           | Resolve a website hostname to a city                                            |
| `GET /municipalities/{slug}`                                        | Website data: branding, contact, departments, announcements, enabled modules    |
| `GET /municipalities/{slug}/service-categories`                     | Categories residents can choose                                                 |
| `POST /municipalities/{slug}/service-categories/suggest`            | Advisory category suggestion + emergency-wording flag (keyword rules)           |
| `POST /municipalities/{slug}/service-requests`                      | Submit a request → tracking number                                              |
| `GET /municipalities/{slug}/service-requests/{reference}`           | Public status and timeline (no contact data, no staff names, no internal notes) |
| `POST /municipalities/{slug}/service-requests/{reference}/messages` | Resident adds information to an open request                                    |

### Auth (`/v1/auth`)

| Method & path  | Purpose                                                         |
| -------------- | --------------------------------------------------------------- |
| `POST /login`  | Email + password → bearer token (development identity provider) |
| `POST /logout` | Revoke the session                                              |
| `GET /me`      | User and the municipalities they work for                       |

### Staff (`/v1/staff/{slug}`)

| Method & path                                     | Permission                      | Purpose                                                                 |
| ------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------- |
| `GET /me`                                         | member                          | Role, department, permissions, unread count                             |
| `GET /dashboard`                                  | member                          | Queue, triage list, counts, metrics (scoped to what the caller can see) |
| `GET /departments`                                | member                          | Departments (for filters)                                               |
| `GET /service-requests`                           | `read_all` or `read_department` | List with filters and pagination                                        |
| `GET /service-requests/{id}`                      | same                            | Detail, full history, allowed transitions, possible duplicates          |
| `POST /service-requests/{id}/status`              | per transition                  | Move through the workflow                                               |
| `GET /service-requests/{id}/assignable-staff`     | `assign`                        | Who may be assigned                                                     |
| `POST /service-requests/{id}/assign`              | `assign`                        | Assign / reassign                                                       |
| `POST /service-requests/{id}/comments`            | `comment`                       | Internal note or resident-visible message                               |
| `GET /notifications` · `POST /notifications/read` | member                          | Caller's own notifications                                              |
| `GET /audit-events`                               | `audit.read`                    | Audit log                                                               |

### Operational

`GET /healthz` (checks the database) · `GET /openapi.json`.

## Not yet available

API keys / OAuth clients for third-party integrations, webhooks, file upload endpoints, resident
account endpoints, administration endpoints (categories, roles, staff, settings).
