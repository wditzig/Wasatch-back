# Incident response plan (draft)

**Status: draft. No responders are named, no contact channels exist and the plan has not been
exercised.** It becomes effective when the items under "To complete before pilot" are done.

## What counts as an incident

Any event that does, or reasonably could, compromise the confidentiality, integrity or
availability of municipal or resident data or of the service. Examples: one city's data visible
to another; unauthorized access to an account or to infrastructure; lost or stolen credentials;
malware; data loss; extended outage; a vulnerability being exploited.

## Severity

| Level | Meaning                                                                                    | Examples                                                      | First response        |
| ----- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | --------------------- |
| SEV 1 | Confirmed or likely exposure of personal data or cross-tenant access; service down for all | Tenant isolation failure; database credentials leaked         | Immediately, any hour |
| SEV 2 | Security control failure without confirmed exposure; one city down                         | Audit logging stopped; authentication bypass found in testing | Within 1 hour         |
| SEV 3 | Limited impact, workaround exists                                                          | Email delivery failing; elevated error rate                   | Next business day     |

## Steps

1. **Detect and report.** Anyone who suspects an incident reports it at once to the incident
   lead. Do not investigate alone or delete anything.
2. **Triage** (incident lead): assign severity, open an incident record with a timeline, pull in
   responders.
3. **Contain.** Options built into the product: suspend a staff member's access (immediate);
   revoke sessions; disable a module for a city (`module_entitlements`); set a city to
   `suspended`. Infrastructure options (rotate credentials, isolate hosts) come with hosting.
4. **Preserve evidence.** Export the audit log for the affected city and period; snapshot
   relevant data; record every action taken with time and person. Audit and history tables
   cannot be altered by the application.
5. **Assess scope.** Which cities, which records, which people, what period. The audit log's
   request ids, actor and client address fields support this.
6. **Notify.** Affected municipalities without undue delay and within the period their
   contract and state law require. The municipality, with counsel, decides on notice to
   residents and regulators; MunicipalOS provides the facts: what happened, when, what data,
   what has been done, what they should do.
7. **Eradicate and recover.** Fix the cause, restore from backup if needed, verify with tests,
   monitor.
8. **Review.** Blameless written review within 10 business days: timeline, cause, what worked,
   corrective actions with owners and dates. Add a regression test for the failure.

## Roles (to be named)

Incident lead · technical lead · communications lead (customer contact) · executive sponsor ·
legal counsel.

## To complete before pilot

- Name people for each role and an on-call rotation.
- A monitored security contact address and a published `security.txt`.
- Customer contact list per municipality (administrative and security contacts).
- Notification periods per state and per contract, reviewed by counsel.
- Monitoring and alerting that can actually detect the examples above.
- One tabletop exercise (suggested scenario: suspected cross-tenant exposure).
