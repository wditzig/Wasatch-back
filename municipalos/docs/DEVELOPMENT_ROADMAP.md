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

| Component                                            | Status | Detail                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo, tooling, CI workflow                       | ✅     | CI workflow written; its first run happens when a pull request is opened                                                                                                                                                                                                         |
| Tenant architecture + RLS                            | ✅     |                                                                                                                                                                                                                                                                                  |
| Authentication                                       | 🟡     | Development provider with idle/absolute timeouts. No MFA, reset, SSO (ADR-004)                                                                                                                                                                                                   |
| Authorization (roles, permissions, department scope) | ✅     | Staff access screen and role reference. No custom-role editor or staff invitations                                                                                                                                                                                               |
| Audit logging                                        | ✅     | Viewer and CSV export                                                                                                                                                                                                                                                            |
| Design system                                        | 🟡     | Core components and content blocks; no dialogs/menus/document viewer yet                                                                                                                                                                                                         |
| Service requests — resident                          | 🟡     | Submit, track, reply, photos ✅. Missing: map picker, resident accounts, SMS                                                                                                                                                                                                     |
| Service requests — staff                             | 🟡     | Queue, filters, detail, status, assign, notes, messages, completion photos, category management ✅. Missing: SLA/escalation, bulk actions                                                                                                                                        |
| Notifications                                        | 🟡     | In-app for staff ✅. Resident email has a durable outbox with retry, but **no provider is connected, so nothing is sent**                                                                                                                                                        |
| Municipal website                                    | 🟡     | Branding, settings editor, pages CMS (blocks, preview, review, scheduling, archive, menu), announcements, accessibility and privacy statements, custom-domain routing ✅. Missing: documents, meetings, homepage/footer editing, typography, prefix-free links on custom domains |
| Employee dashboard                                   | 🟡     | Role-aware queue + metrics ✅. Content approvals arrive as notifications but have no dashboard queue; no global search                                                                                                                                                           |
| Records management                                   | 🟡     | Retention schedule, legal holds, approved disposition, record and audit export ✅ for service requests. Missing: photos in disposition, other record types, tenant offboarding export                                                                                            |
| Compliance structure                                 | 🟡     | Control matrix, data inventory, accessibility tracker, incident plan, subprocessor register (docs/COMPLIANCE.md). **No assessment, certification or manual accessibility testing**                                                                                               |
| AI knowledge engine                                  | ⬜     | Rules-based suggestions only                                                                                                                                                                                                                                                     |
| Digital permitting                                   | ⬜     |                                                                                                                                                                                                                                                                                  |
| Resident mobile app                                  | ⬜     | Resident web flows are mobile-responsive                                                                                                                                                                                                                                         |
| Platform administration                              | ⬜     | Tenants are created by seed script                                                                                                                                                                                                                                               |
| Production infrastructure                            | ⬜     | Nothing deployed                                                                                                                                                                                                                                                                 |

## Prioritized engineering backlog

### P0 — finish Phase 1

1. Owner decisions: identity provider, repository, cloud, email provider (DECISIONS.md).
2. Managed identity integration with MFA; remove password login from non-dev builds.
3. Real email provider behind the existing outbox; show delivery status to staff.
4. S3-compatible storage driver and malware scanning for uploads; photos in disposition.
5. Staff invitations and a custom-role editor.
6. Prefix-free links on custom domains; automated TLS onboarding.
7. Redis-backed rate limiting; RLS on `users`; purge of expired sessions.
8. Manual accessibility pass with screen readers; fix findings; independent audit and ACR.
9. Whole-tenant export and deletion (offboarding); audit-log retention decision.

### P1 — Phase 2 MVP components

9. Website CMS, remaining: documents, meeting information, homepage and footer sections, content approval queue on the dashboard.
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

- Not production-ready; no independent security or accessibility review; no certification.
- Resident emails are not delivered (console transport), though they are queued and retried.
- No MFA, password reset or SSO.
- One API instance assumed (in-memory rate limiter; outbox worker runs in the API process).
- Uploaded photos are stored on local disk and are not malware-scanned.
- Disposition redacts reporter contact details only; free text and photos stay with the record.
- On a city's own domain, addresses keep the `/city-name` prefix after in-site navigation.
- A page's address (slug) cannot be changed after creation; a long website menu wraps.
- A notification pointing to a record the user can no longer see leads to a not-found page.
- No pagination on the resident timeline or staff activity history (fine at current sizes).
- End-to-end tests run on Chromium only.
- CI workflow has not executed yet (it triggers on pull requests and `main`).

## Future modules (not started, by design)

Council meetings and agendas, records requests, inspections, code enforcement, assets, fleet,
budget, grants, procurement, engagement, multilingual services, intermunicipal collaboration.
The shared foundations they need — tenancy, roles, workflows, audit, notifications, module
entitlements — exist; each module adds its own tables, permissions and routes.
