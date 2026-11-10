# Product requirements

Source: the MunicipalOS master development directive. This file records the requirements the
team is building against and how the first milestone interprets them.

## Vision

A unified, modular, AI-native operating system for local government, sold as multi-tenant SaaS to
US municipalities (initially ~5,000–30,000 residents). Powerful behind the scenes, simple on the
surface.

## Users

| User                       | Needs                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| Resident                   | Find information, report a problem in about a minute, see what happened — without creating an account |
| Department employee        | See only their work, update it quickly, keep the resident informed                                    |
| Department administrator   | Triage, assign and close their department's work                                                      |
| City clerk                 | Triage across departments                                                                             |
| Municipal administrator    | Everything within their city                                                                          |
| Auditor                    | Read-only access plus the audit trail                                                                 |
| MunicipalOS platform staff | Operate tenants without default access to municipal records                                           |

## MVP components

1. Municipal website with CMS
2. Universal resident application
3. Municipal AI knowledge engine
4. Service request management
5. Municipal employee dashboard
6. Digital permitting

plus platform administration. Status of each is in DEVELOPMENT_ROADMAP.md.

## Milestone 1 scope (implemented)

The first resident-to-employee workflow:

1. Resident selects a municipality.
2. Resident views available services (categories configured per city).
3. Resident submits a non-emergency issue (category, description, location, optional contact).
4. The system validates and stores it.
5. It is routed to the department that owns the category.
6. An authorized employee sees it in their queue.
7. The employee updates its status (New → Reviewed → Assigned → In Progress → Resolved → Closed,
   with close-without-action and reopen exceptions).
8. The resident sees the update on the tracking page and, if they left an email, is sent one.
9. Every step is recorded in the request history and the audit log.
10. Automated tests verify the workflow and tenant isolation.

### Product decisions taken in this milestone

- **No account needed to report or track.** Each city can require name + email
  (`allow_anonymous_requests`).
- **Emergencies:** every reporting surface says to call 911; emergency wording triggers a stronger
  prompt. The system never dispatches anything.
- **Status notes are public.** A note attached to a status change is shown to the resident.
  Internal notes are a separate, clearly labelled action.
- **Staff identities are not shown to residents.** Public timeline says "city staff".
- **Suggestions are advisory.** Category suggestions and duplicate hints never act on their own.

### Not in milestone 1

Photo uploads, map picker, resident accounts and notification preferences, SMS, configurable
category management UI, SLA/escalation rules, per-city workflow variants.

## Non-functional requirements

- WCAG 2.2 AA as the internal target; legal obligations verified per municipality.
- Tenant isolation proven by automated tests.
- No real municipal or resident data before authorization and safeguards.
- AI never exercises governmental authority; permit decisions and publishing require authorized
  people.
