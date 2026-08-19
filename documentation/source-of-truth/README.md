# NarrativeX Source of Truth V1.10

## Canonical baseline

Current canonical repository baseline:

- Version: `V1.10`
- Repository: `huongni2201/NarrativeX`
- Baseline: latest merged main after durable provider/admission implementation

Canonical specification:

```text
documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_10.md
```

## Current implemented foundations

- Project Overview read model.
- Chapter CRUD and batch import.
- Explicit Chapter Analyze flow.
- Durable GenerationJob / StageAttempt execution.
- Worker bounded concurrency.
- Storyboard and VisualBeat review foundation.
- Character library read API.
- Job history, quota and notification read surfaces.
- Durable ProviderOperation reservation/submission/reconciliation foundation.
- Chapter analysis admission checks for safety, entitlement, quota and estimated cost reservation.

## Remaining product gaps

- Complete Location materialization from analysis output.
- Scene -> Character and Scene -> Location continuity persistence.
- Full character version/reference management workflow.
- Approved storyboard reset/versioning workflow.
- Image/TTS/video/render/export pipeline.
- Full billing ledger, reconciliation and production observability.

## Documentation rules

Derived documents are implementation views. They must not redefine domain invariants independently.

When code, migration, ADR and documentation disagree:

1. Product/domain invariants decide intended behavior.
2. Current code/tests/migrations decide AS-IS implementation claims.
3. Historical audit documents remain evidence only.

Every capability must clearly state IMPLEMENTED, PARTIAL, PENDING, TARGET or PROTOTYPE.