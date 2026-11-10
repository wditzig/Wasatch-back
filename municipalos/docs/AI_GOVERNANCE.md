# AI governance

## Current state

**No language model is used anywhere in MunicipalOS today.** There is no `packages/ai`, no model
provider credential, and no AI-generated text reaches a resident or employee.

Two features give "smart" suggestions using deterministic rules, and are labelled as rules in
code and API documentation:

| Feature                 | How it works                                                                          | Human control                                                         |
| ----------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Category suggestion     | Matches the resident's description against keywords each city configures per category | Shown as a suggestion; the resident chooses                           |
| Emergency wording check | Fixed keyword list                                                                    | Only displays a "call 911" prompt; never blocks, routes or dispatches |
| Possible duplicates     | Same category within ~150 m or same typed location, open requests only                | Shown to staff as a hint; nothing is merged                           |

## Rules that bind every future AI feature

1. **Grounded or silent.** Answers about policies, fees, deadlines or legal requirements come only
   from retrieved, approved municipal sources, with citations. If retrieval finds nothing
   adequate, the assistant says so and offers a human contact.
2. **No governmental authority.** AI never approves, denies, issues, publishes, assigns penalties
   or dispatches. It drafts and suggests; an authorized employee decides, and the decision is
   attributed to that person in the audit log.
3. **Tenant boundaries.** Retrieval and tools run inside the same `withTenant()` boundary as every
   other query. One city's documents can never ground another city's answer.
4. **Least data.** Models receive the minimum context. Resident contact data and internal notes
   are excluded unless a feature for authorized staff specifically requires them.
5. **Untrusted input.** Resident text and ingested documents are data, never instructions.
   Tool calls are allow-listed, validated with Zod and permission-checked as the calling user.
6. **Everything logged.** Each interaction records tenant, actor, model, prompt template version,
   sources retrieved, output, token usage and cost.
7. **Measured before shipped.** A feature ships only with an evaluation suite covering accuracy
   against sources, citation correctness, refusal when ungrounded, prompt-injection resistance and
   cross-tenant leakage — run in CI.
8. **Budgets.** Per-tenant and platform spend limits with hard stops.
9. **Disclosure.** Residents are told when they are interacting with an automated assistant and
   how to reach a person.

## Planned architecture (Phase 2)

```
packages/ai
  providers/      one interface, multiple vendors; no vendor types leak out
  retrieval/      tenant-scoped chunk store (pgvector), freshness metadata, source status
  orchestration/  prompt templates (versioned), structured outputs (Zod), tool registry
  evaluation/     golden question sets per feature; CI runner
  usage/          token + cost accounting, budgets
```

Planned tables: `knowledge_sources`, `knowledge_chunks`, `ai_interactions`, `ai_usage`.

Answer states the assistant must distinguish: **verified** (cited), **uncertain** (partial
sources, says so), **needs staff confirmation**, **requires a human decision** (hands off).

## Open decisions for the owner

- Model provider(s) and data-processing terms (no training on customer data, retention, region).
- Whether resident chat transcripts are public records in each pilot jurisdiction, and the
  retention that implies.
