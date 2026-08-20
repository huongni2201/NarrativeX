# NarrativeX — Project Source of Truth V1.10

**Status:** Canonical code-aligned engineering baseline  
**Effective date:** 19/08/2026  
**Last code verification:** 20/08/2026

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
| AI Character/Location continuity materialization foundation | IMPLEMENTED |
| Scene -> ProjectCharacter / Location continuity persistence foundation | IMPLEMENTED |
| Job history/quota/notification reads | IMPLEMENTED |
| ProviderOperation lifecycle + reconciliation foundation | IMPLEMENTED |
| Admission safety/quota/cost reservation foundation | IMPLEMENTED |

## Current generation model

```text
OperationPlan
    -> GenerationJob
        -> StageAttempt
            -> ProviderOperation
```

PostgreSQL is authoritative. Redis is delivery/progress infrastructure and never replaces durable execution state.

Chapter Analyze currently persists stable AI continuity keys for Character and Location identities, materializes project-scoped Character/Location records, and persists Scene character/location relations. These are implementation foundations; downstream image generation still needs reviewed/locked continuity snapshots before production media generation.

## Remaining gaps

- Full character editing/version locking/reference workflow.
- Approved storyboard reset/versioning workflow.
- Production hardening for provider recovery/reconciliation and complete actual-usage accounting.
- Image generation and immutable generated-asset lifecycle.
- TTS/subtitle generation.
- Render/export/final artifact pipeline.
- Complete billing ledger reconciliation and unused-reservation release.
- Broader moderation/consent/abuse coverage, observability, backup/restore and deletion lifecycle evidence.

## AI coding rules

- Do not use mock data as production state.
- Do not submit provider requests without durable lifecycle state.
- `UNKNOWN` external outcomes must reconcile before blind resubmission.
- Do not overwrite approved/locked history.
- Prefer affected-scope regeneration.
- Update docs and ADRs when invariants change.
