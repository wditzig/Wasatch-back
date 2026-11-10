# Security and privacy

**MunicipalOS has not had an independent security review or penetration test and must not hold
real municipal or resident data yet.** This document states what is implemented, how it is
verified, and what is missing.

## Implemented controls

| Area                    | Control                                                                                                                                                                                   | Verified by                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Tenant isolation        | Membership check per request; PostgreSQL RLS with a non-bypassing role; composite tenant foreign keys                                                                                     | `apps/api/test/security.test.ts` (API and SQL level) |
| Authentication          | scrypt password hashes; 256-bit opaque session tokens stored only as SHA-256; expiry; server-side revocation; uniform failure response and timing for unknown accounts                    | security tests                                       |
| Authorization           | Per-municipality roles → permissions; department-scoped visibility; workflow transitions carry their own permission; out-of-scope records are 404                                         | unit + security tests                                |
| Least privilege (DB)    | Runtime role cannot alter roles, memberships, users, or edit/delete history and audit rows; API refuses to start as superuser/owner/BYPASSRLS                                             | security tests                                       |
| Platform staff          | `is_platform_admin` grants no access to municipal records                                                                                                                                 | security tests                                       |
| Input validation        | Zod on every route; parameterized SQL only (Drizzle); `LIKE` wildcards escaped; 64 KB body limit                                                                                          | integration tests                                    |
| Rate limiting           | Login (per address and per account), public submissions, messages, reads                                                                                                                  | security tests                                       |
| Sensitive data exposure | Public endpoints return an explicit allow-list of fields; contact data, staff identities and internal notes excluded                                                                      | security tests                                       |
| Audit logging           | Logins, failed logins, cross-tenant attempts, every request mutation; append-only; includes request id and client address                                                                 | workflow + security tests                            |
| Web hardening           | `nosniff`, frame denial, referrer policy, permissions policy; `no-store` on API; httpOnly, SameSite=Lax session cookie (Secure in production); Next.js server actions enforce same-origin | header test; manual                                  |
| Secrets                 | None in source. `.env` is git-ignored; `.env.example` holds local-only development values                                                                                                 | review                                               |
| Errors                  | Unexpected errors are logged with a request id; clients get a generic message                                                                                                             | integration tests                                    |
| CI                      | Lint, typecheck, tests, `pnpm audit` (high/critical) on every pull request                                                                                                                | workflow file                                        |

## Known gaps (must be closed before a pilot)

| Gap                                                                      | Plan                                                                                                                  |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| No MFA; password auth is a development provider                          | Adopt a managed identity provider (OIDC, MFA, SSO); see ADR-004. **Owner decision required.**                         |
| No password reset, lockout notification or session management UI         | Comes with the identity provider                                                                                      |
| Rate limiter is in-memory                                                | Redis-backed limiter before running more than one API instance                                                        |
| API trusts `X-Forwarded-For`                                             | Deploy so the API is reachable only from the web tier / load balancer; pin trusted proxy hops                         |
| No Content-Security-Policy on the web apps                               | Add nonce-based CSP                                                                                                   |
| `users` table has no RLS                                                 | Move login lookup behind a narrow `SECURITY DEFINER` function and add policies                                        |
| Email delivery is in-process and console-only                            | Durable job queue + provider with SPF/DKIM                                                                            |
| No file uploads                                                          | When added: type sniffing, size limits, malware scanning, private bucket, signed short-lived URLs, tenant-scoped keys |
| No encryption-at-rest configuration, backups, PITR, monitoring, alerting | Part of deployment work (DEPLOYMENT.md)                                                                               |
| No secrets manager integration                                           | Platform secret store at deployment                                                                                   |
| No data retention, export or deletion tooling                            | Design in DATABASE_SCHEMA.md; build with resident accounts                                                            |
| No independent penetration test, no SOC 2 / StateRAMP / CJIS assessment  | Required before production; no compliance is claimed                                                                  |
| Tracking number is the only protection on public request status          | Acceptable for non-sensitive fields; add resident accounts for anything more                                          |
| Free-text fields may contain personal data residents typed               | Staff guidance + UI hint present; consider redaction tooling                                                          |

## Privacy principles (as implemented so far)

- **Data minimization:** reporting requires no identity unless the city's policy does. Phone is
  never required.
- **Purpose limitation:** reporter contact details are returned only by staff endpoints for
  requests the staff member may see.
- **No monetization or third-party sharing** of resident data. No analytics or third-party
  scripts are loaded by either web app.
- **AI access:** no AI system reads any data today.
- **Logs:** email addresses are redacted in the console email transport; audit metadata never
  contains message bodies or credentials.

## Threat model summary

| Threat                                   | Primary defence                                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Staff of city A reading city B's records | Membership gate → RLS → composite FKs                                                          |
| Employee escalating their role           | Roles/memberships not writable by the runtime role; permissions loaded server-side per request |
| Guessing tracking numbers                | 40-bit random references, read rate limit, minimal fields                                      |
| Credential stuffing                      | Per-account and per-address throttling; MFA pending                                            |
| Stolen database dump                     | Password hashes (scrypt) and token digests only; encryption at rest pending                    |
| Abuse of anonymous reporting             | Rate limiting; idempotency; city may require contact details                                   |
| Tampering with history                   | Append-only grants on events and audit tables                                                  |
| Prompt injection (future AI)             | See AI_GOVERNANCE.md                                                                           |

## Reporting a vulnerability

No public disclosure process exists yet. Before pilot: publish a `security.txt`, a contact
address and a response policy.
