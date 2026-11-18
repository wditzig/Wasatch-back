# Subprocessors and third-party services

A subprocessor is any outside company that stores or processes municipal or resident data on
MunicipalOS's behalf. Municipal contracts usually require this list, advance notice of changes,
and that each subprocessor meets the same obligations.

## Current

**None.** MunicipalOS is not deployed. No municipal or resident data is sent to any third party:
no hosting provider, email provider, analytics, error tracking, AI model provider, fonts or CDN
is in use. Both web apps are checked by test to run under a Content-Security-Policy that only
allows same-origin resources.

## Decisions pending (each becomes an entry when chosen)

| Purpose                    | Data it would see                           | Requirements before adoption                                                                                                         |
| -------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Cloud hosting and database | Everything                                  | US regions; government-authorized offering appropriate to the customers' requirements; encryption at rest; data processing agreement |
| Identity provider          | Staff names, emails, authentication events  | MFA, SSO; breach notification terms; US data residency                                                                               |
| Transactional email        | Resident email addresses, message content   | No use of content for other purposes; DKIM/SPF on city sender domains; retention limits                                              |
| Object storage             | Photos and documents                        | Private buckets, per-tenant prefixes, encryption, access logging                                                                     |
| Error tracking / logging   | Possibly personal data in logs              | Scrubbing rules; retention limits; prefer self-hosted or same cloud                                                                  |
| AI model provider          | Whatever is placed in prompts               | No training on customer data; retention controls; see AI_GOVERNANCE.md                                                               |
| Payments (future)          | Cardholder data (never through MunicipalOS) | PCI DSS Level 1 processor with hosted fields/page                                                                                    |
| SMS (future)               | Resident phone numbers                      | Consent records; opt-out handling                                                                                                    |

## Rule

Adding a subprocessor is a recorded decision (DECISIONS.md) with: purpose, data categories,
location, certifications reviewed, contract terms, and customer notice given — before any data
flows.
