# Data inventory

Every kind of data MunicipalOS stores, why, who can see it, and how long it is kept. Update this
file in the same change as any new table or field. All data in the repository is synthetic.

Classification: **Public** (shown on websites) · **Internal** (staff only) · **Sensitive**
(personal data or security material) · **Restricted** (evidence that must not be altered).

## Personal data

| Data                                             | Where                                          | Whose                                             | Why it is collected                                                               | Who can see it                                                                                       | Retention                                                                      |
| ------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Reporter name, email, phone                      | `service_requests.reporter_*`                  | Resident                                          | To send updates and ask follow-up questions. Optional unless the city requires it | Staff who can see the request; never public endpoints                                                | City's retention schedule; redacted at disposition; preserved under legal hold |
| Request description and location text            | `service_requests`                             | Resident (free text may contain personal details) | To fix the problem                                                                | Staff; anyone holding the tracking number                                                            | Kept with the record (not redacted — a records officer decision)               |
| Coordinates                                      | `service_requests.latitude/longitude`          | Resident (only if they choose to share)           | To locate the problem                                                             | Staff only                                                                                           | With the record                                                                |
| Photos                                           | `service_request_attachments` + object storage | Resident or staff                                 | Evidence of the problem / the repair                                              | Staff; anyone holding the tracking number. Embedded metadata (GPS, device) is removed before storage | With the record. **Not yet covered by disposition** (backlog)                  |
| Messages between resident and staff              | `service_request_events.body`                  | Resident, staff                                   | Communication about the request                                                   | Public events: tracking-number holder and staff. Internal notes: staff only                          | Append-only, with the record                                                   |
| Email address and message copy                   | `notifications` (email channel)                | Resident                                          | Delivery and proof of notice                                                      | Not exposed by any list endpoint; included in record export                                          | Redacted at disposition                                                        |
| Staff name, work email, job title                | `users`, `staff_memberships`                   | Employee                                          | Identity, assignment, accountability                                              | Staff of the same city (directory); staff names are not shown to residents                           | While employed + audit needs                                                   |
| Staff password hash                              | `users.password_hash`                          | Employee                                          | Development sign-in only                                                          | Nobody (never returned by the API)                                                                   | Removed when the identity provider is adopted                                  |
| Session token digest, client address, user agent | `sessions`                                     | Employee                                          | Session security                                                                  | Nobody via the API                                                                                   | Until expiry; purge job not built                                              |
| Client address and request id                    | `audit_events.ip`, `request_id`                | Resident or employee                              | Security, abuse prevention, incident investigation                                | Roles with `audit.read`                                                                              | Audit retention period — **undecided**                                         |

## Non-personal municipal data

| Data                                              | Where                                                    | Classification                                                         |
| ------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| City name, branding, contact details, departments | `municipalities`, `municipality_settings`, `departments` | Public                                                                 |
| Announcements, website pages (published)          | `announcements`, `website_pages`, `content_revisions`    | Public once published; drafts Internal                                 |
| Service categories and routing                    | `service_request_categories`                             | Public (keywords Internal)                                             |
| Roles and permissions                             | `roles`, `role_permissions`                              | Internal                                                               |
| Retention schedule, legal holds                   | `retention_policies`, `legal_holds`                      | Internal (hold reasons may be legally privileged — treat as Sensitive) |
| Request history                                   | `service_request_events`                                 | Restricted (append-only)                                               |
| Audit log                                         | `audit_events`                                           | Restricted (append-only)                                               |
| Module entitlements                               | `module_entitlements`                                    | Internal                                                               |

## Data that is deliberately not collected

Social Security numbers, dates of birth, payment card data, health information, criminal
justice information, precise device identifiers, advertising or analytics identifiers, and
resident accounts or passwords. Free-text fields carry a hint not to include sensitive personal
information. Adding any of these requires a recorded compliance decision first.

## Flows

- Resident browser → city website (server) → API → database. The browser never calls the API.
- Photos: browser → website → API (validated, re-encoded) → object storage (local disk in
  development).
- Email: API → transport. Only a console transport exists; **no personal data leaves the
  system today**.
- No data is sent to analytics, advertising, AI or any other third party
  ([subprocessors](SUBPROCESSORS.md)).

## Rights and requests

| Request                                      | How it is handled today                                                                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public records request                       | Staff with `records.export` download the complete record; the city's records officer reviews exemptions before release. Exports are audited                               |
| Resident asks what the city holds about them | Same export, located by tracking number or contact details (no self-service)                                                                                              |
| Resident asks for deletion                   | Government records generally cannot be deleted on request. Personal data is redacted when the record passes the city's retention period and an authorized person confirms |
| Litigation / audit hold                      | Legal hold on the record; disposition is blocked at the database                                                                                                          |
| City leaves MunicipalOS                      | Bulk export and verified deletion — **not built** (required before any contract)                                                                                          |

## Open items

Audit log and session retention periods · photo and attachment disposition · purge of expired
sessions · bulk tenant export and deletion · read-access logging for sensitive fields ·
encryption at rest (hosting).
