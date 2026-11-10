# Development roadmap

Dates are planning targets, not permission to skip security, accessibility or operational
requirements.

| Phase                                   | Target       | Goal                                                         |
| --------------------------------------- | ------------ | ------------------------------------------------------------ |
| 1 — Foundation and functional prototype | Months 1–2   | Architecture + first working vertical slice                  |
| 2 — Six-component MVP                   | Months 3–6   | All MVP components integrated                                |
| 3 — Production readiness                | Months 7–9   | Hardening, accessibility validation, reliability, operations |
| 4 — Municipal pilot                     | Months 10–12 | Controlled pilot, gated on independent reviews               |

## Feature completion status

Legend: ✅ meets the definition of done (UI, backend, persistence, authz, tenancy, errors, audit,
tests, accessibility evaluated by automated scan, documented) · 🟡 partly built · ⬜ not started.

| Component                                            | Status | Detail                                                                                                                                       |
| ---------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo, tooling, CI workflow                       | ✅     | CI workflow written; first run happens when a pull request is opened                                                                         |
| Tenant architecture + RLS                            | ✅     |                                                                                                                                              |
| Authentication                                       | 🟡     | Development provider only. No MFA, reset, SSO (ADR-004)                                                                                      |
| Authorization (roles, permissions, department scope) | ✅     | Roles are data, but there is no UI to edit them                                                                                              |
| Audit logging                                        | ✅     | Viewer for `audit.read` roles                                                                                                                |
| Design system                                        | 🟡     | Core components; no dialogs/menus/document viewer yet                                                                                        |
| Service requests — resident                          | 🟡     | Submit, track, reply ✅. Missing: photo upload, map picker, resident accounts, SMS                                                           |
| Service requests — staff                             | 🟡     | Queue, filters, detail, status, assign, notes, messages ✅. Missing: completion photos, category management UI, SLA/escalation, bulk actions |
| Notifications                                        | 🟡     | In-app for staff ✅. Resident email is queued and logged, **not actually sent**                                                              |
| Municipal website                                    | 🟡     | Branded shell rendering database content ✅. No CMS, pages, documents, meetings, custom-domain routing                                       |
| Employee dashboard                                   | 🟡     | Role-aware queue + metrics ✅. Missing: permits, content approvals, global search                                                            |
| AI knowledge engine                                  | ⬜     | Rules-based suggestions only                                                                                                                 |
| Digital permitting                                   | ⬜     |                                                                                                                                              |
| Resident mobile app                                  | ⬜     | Resident web flows are mobile-responsive                                                                                                     |
| Platform administration                              | ⬜     | Tenants are created by seed script                                                                                                           |
| Production infrastructure                            | ⬜     | Nothing deployed                                                                                                                             |

## Prioritized engineering backlog

### P0 — finish Phase 1

1. Owner decisions: identity provider, repository, cloud (DECISIONS.md).
2. Managed identity integration with MFA; remove password login from non-dev builds.
3. Photo uploads for requests (object storage abstraction, validation, signed URLs, tenant-scoped keys).
4. Real email delivery through a durable job queue; delivery status and retry.
5. Host-based routing for custom municipal domains.
6. Staff administration UI: categories, departments, staff invitations, role assignment (widen DB grants per feature).
7. Content-Security-Policy; RLS on `users`; Redis-backed rate limiting.
8. Manual accessibility pass with screen readers; fix findings.

### P1 — Phase 2 MVP components

9. Website CMS: pages, reusable blocks, draft → review → publish (workflow engine), scheduling, navigation, documents, meetings.
10. Resident accounts (passwordless) + notification preferences; "my requests".
11. Permitting: configurable permit types and forms, drafts, document upload, review stages, corrections loop, decisions by authorized staff only.
12. AI knowledge engine per AI_GOVERNANCE.md: ingestion, tenant-scoped retrieval, citations, escalation, logging, evaluation suite, budgets.
13. Platform administration app: tenant provisioning, entitlements, feature flags, support access with approval + audit (break-glass).
14. Resident mobile app (Expo) on the same API.
15. Global search; SLA and escalation rules; per-city workflow variants.
16. Dashboard: permits and content approval queues.

### P2 — Phase 3 production readiness

17. Infrastructure as code, environments, backups + restore drill, monitoring and alerting, runbooks.
18. Load testing against the targets in TESTING.md.
19. Independent penetration test and accessibility audit; remediate.
20. Data retention, export and records tooling; privacy documentation.
21. Dependency and container scanning in CI; SBOM.
22. Browser/device matrix; multilingual foundation (i18n).

### P3 — Phase 4 pilot

23. Pilot onboarding: configuration, data migration plan, staff training, support process.
24. Operational documentation and incident response.

## Known limitations (current build)

- Not production-ready; no independent security or accessibility review.
- Resident emails are not delivered (console transport).
- No MFA, password reset or SSO.
- One API instance assumed (in-memory rate limiter, in-process email).
- Website content can only be changed through the database/seed.
- Times are shown in the municipality's time zone on the resident site; the staff app assumes
  Mountain Time until the staff API exposes the time zone.
- A notification pointing to a request the user can no longer see leads to a not-found page.
- No pagination on the resident timeline or staff activity history (fine at current sizes).
- End-to-end tests run on Chromium only.
- CI workflow has not executed yet (it triggers on pull requests and `main`).

## Future modules (not started, by design)

Council meetings and agendas, records requests, inspections, code enforcement, assets, fleet,
budget, grants, procurement, engagement, multilingual services, intermunicipal collaboration.
The shared foundations they need — tenancy, roles, workflows, audit, notifications, module
entitlements — exist; each module adds its own tables, permissions and routes.
