# Cross-runtime contracts

This directory contains versioned payloads shared by the Spring Boot API and Python worker. Contracts include an explicit schema/version field and describe data/state transitions; they do not grant a worker authority to bypass ownership, entitlement, non-monetary quota/capacity, safety or provider-reconciliation rules.

NarrativeX is still pre-production, so an unused contract may be hard-cut when the runtime vocabulary is intentionally retired. After the first production deployment, externally shared/applied contract versions must follow an explicit compatibility/versioning policy.

## Required properties

- Stable identifiers for project, operation, job, stage and provider operation where applicable.
- `schemaVersion` and an idempotency key.
- Resource class and authoritative requesting/ownership context where required by the concrete contract.
- Snapshot references for prompt, character/outfit, image settings, render profile and policy versions where applicable.
- Explicit terminal/error states; ambiguous provider submission is `UNKNOWN`, not an automatic retry.
- No monetary billing owner, credit balance, pricing snapshot or cost-limit status unless a future explicit product/architecture decision introduces a new versioned contract.

[job-event.v1.schema.json](./job-event.v1.schema.json) uses the current durable generation vocabulary only:

```text
CHAPTER_ANALYZE
NARRATION_GENERATE
CHAPTER_GENERATE
RENDER_PROJECT
```

Current job statuses are `QUEUED`, `RUNNING`, `STALLED`, `UNKNOWN`, `COMPLETED`, `FAILED` and `CANCELED`. Retired story/chapter-render/short/continuation aliases are not compatibility values in the pre-production contract.
