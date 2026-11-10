# Testing

## Running

```bash
pnpm test          # unit + API integration/security tests (rebuilds the *_test database)
pnpm db:reset      # clean development data for e2e
pnpm test:e2e      # Playwright: real API + both web apps (starts them if not running)
pnpm lint && pnpm typecheck
```

`pnpm test` needs PostgreSQL with the roles from `pnpm db:setup`. End-to-end tests reuse servers
already on ports 4000/3000/3001; start the API with `RATE_LIMIT_SCALE=100` if you run it yourself,
because all test traffic shares one client address.

## What is covered

| Layer                     | Where                            | What it proves                                                                                                                                                                                                                                                                                 |
| ------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                      | `packages/*/src/*.test.ts`       | Workflow transitions and permission checks; role definitions; validation rules; password/token primitives; tenant colour contrast                                                                                                                                                              |
| Integration               | `apps/api/test/workflow.test.ts` | The whole request lifecycle through the real API and database: routing, idempotency, notifications, emails, history, audit, optimistic concurrency, duplicate hints, dashboard                                                                                                                 |
| Security                  | `apps/api/test/security.test.ts` | Cross-tenant access via API (reads, writes, ids, filters, assignment, categories, tracking numbers); RLS at SQL level; append-only tables; role escalation; department scoping; platform admin has no access; data exposure on public endpoints; login throttling; rate limits; error envelope |
| End-to-end                | `tests/e2e/*.spec.ts`            | Resident and staff journeys in a real browser; per-city branding/configuration; cross-city denial in the UI; form error handling; keyboard operation; no horizontal scroll at 360 px                                                                                                           |
| Accessibility (automated) | `tests/e2e` via axe-core         | WCAG 2.0/2.1/2.2 A and AA rules on every resident page, the report form in its error state, and the staff login, dashboard, list, detail, notifications and audit pages                                                                                                                        |

Integration tests run against a real PostgreSQL database connected as the same restricted role
used in production, so row-level security is exercised, not mocked.

## Last recorded run (milestone 1)

| Suite                                               | Result    |
| --------------------------------------------------- | --------- |
| Unit (permissions, workflows, validation, auth, ui) | 26 passed |
| API integration + security                          | 49 passed |
| End-to-end + accessibility                          | 18 passed |
| Lint, typecheck, production builds                  | clean     |

## Seeded accounts

All synthetic. Password for every account: printed by `pnpm db:seed` (development only).

| Email                              | City           | Role                                            |
| ---------------------------------- | -------------- | ----------------------------------------------- |
| dana.whitaker@cedarridge.example   | Cedar Ridge    | Municipal Administrator                         |
| luis.ortega@cedarridge.example     | Cedar Ridge    | Department Administrator (Public Works)         |
| priya.nair@cedarridge.example      | Cedar Ridge    | Department Employee (Public Works)              |
| tom.becker@cedarridge.example      | Cedar Ridge    | Department Employee (Parks & Recreation)        |
| helen.cho@cedarridge.example       | Cedar Ridge    | City Clerk                                      |
| avery.stone@cedarridge.example     | Cedar Ridge    | Read-Only Auditor                               |
| grace.okafor@marlowsprings.example | Marlow Springs | Municipal Administrator                         |
| ben.hale@marlowsprings.example     | Marlow Springs | Department Employee (Public Works)              |
| ops@municipalos.example            | —              | Platform administrator, no municipal membership |

Sample tracking numbers: `CR-SAMP0001` … `CR-SAMP0008`, `MS-SAMP0001` … `MS-SAMP0003`.

## Manual accessibility testing

Automated scanning finds only a portion of accessibility problems. **Passing it is not a claim of
WCAG conformance.** Before each release that changes UI, run and record:

1. **Keyboard only** — complete "report a problem" and "update a request" without a mouse; focus
   order is logical; focus is always visible; no traps.
2. **Screen readers** — NVDA + Firefox, VoiceOver + Safari (macOS and iOS), TalkBack + Chrome:
   headings, landmarks, form labels, error summary announcement, status changes announced.
3. **Zoom and reflow** — 200% and 400% zoom, 320 px width: no loss of content or two-dimensional
   scrolling.
4. **Contrast and colour** — check each new city brand colour in situ; status never by colour
   alone; Windows High Contrast mode.
5. **Motion and timing** — reduced-motion respected; no time limits on forms.
6. **Touch** — targets ≥ 24 px (WCAG 2.2) and ≥ 44 px for primary actions; works in both
   orientations.
7. **Plain language** — resident-facing copy reviewed for reading level.

Status: steps 1 (partially, automated keyboard test), 3 (360 px automated) and contrast for the
two seeded brand colours have been checked. **Screen-reader testing has not been performed.**

## Performance

Targets (to be validated with load tests in Phase 3; none have been run):

| Metric                                           | Target                            |
| ------------------------------------------------ | --------------------------------- |
| API p95, read endpoints                          | < 200 ms at 50 req/s per instance |
| API p95, submit request                          | < 400 ms                          |
| Resident pages LCP (4G, mid-range phone)         | < 2.5 s                           |
| Staff request list with 100k requests per tenant | < 300 ms query time               |

## Not yet tested

Load/performance, backup restore, email deliverability, browser matrix beyond Chromium, screen
readers, penetration testing, AI evaluations (no AI exists yet).
