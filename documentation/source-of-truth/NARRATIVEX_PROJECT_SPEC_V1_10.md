# NarrativeX — Project Source of Truth V1.10

**Status:** Canonical code-aligned engineering baseline
**Effective date:** 19/08/2026

## Authority

This document is the maintained source of truth for NarrativeX product and architecture decisions.

Authority order:

1. This specification and accepted ADRs define intended contracts.
2. Current code, migrations and tests define factual implementation state.
3. Derived documentation must be synchronized when drift appears.

## Product definition

NarrativeX is an AI-assisted long-form story video studio. It transforms persisted Chapter sources into structured analysis, continuity-aware storyboard planning and eventually image-first video production.

The product is chapter-first, review-first and durable by design.

Create Project only creates metadata. Saving Chapter only persists source. AI analysis is an explicit action.

## Implemented V1.10 baseline

| Capability | State |
|---|---|
| Project Overview | IMPLEMENTED |
| Chapter CRUD/import | IMPLEMENTED |
| Chapter Analyze durable pipeline | IMPLEMENTED |
| Worker bounded concurrency | IMPLEMENTED |
| Storyboard/VisualBeat foundation | IMPLEMENTED |
| Character library read API | IMPLEMENTED |
| Job history/quota/notification reads | IMPLEMENTED |
| ProviderOperation lifecycle foundation | IMPLEMENTED |
| Admission safety/quota/cost reservation foundation | IMPLEMENTED |

## Current generation model

```text
OperationPlan
    -> GenerationJob
        -> StageAttempt
            -> ProviderOperation
```

PostgreSQL is authoritative. Redis is delivery/progress infrastructure and never replaces durable state.

## Remaining gaps

- Location materialization.
- Scene character/location continuity relations.
- Full character editing/version locking workflow.
- Approved storyboard reset/versioning.
- Image generation.
- TTS/subtitle generation.
- Render/export/final artifact pipeline.
- Complete billing ledger reconciliation.

## AI coding rules

- Do not use mock data as production state.
- Do not submit provider requests without durable lifecycle state.
- Do not overwrite approved/locked history.
- Prefer affected-scope regeneration.
- Update docs and ADRs when invariants change.
