# NarrativeX Source of Truth V1.10

## Canonical baseline

Current canonical repository baseline:

- Version: `V1.10`
- Repository: `huongni2201/NarrativeX`
- Baseline: current code-aligned engineering baseline; factual implementation claims are verified against code/tests/migrations.

Canonical specification:

```text
documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_10.md
```

## Current implemented foundations

- Project Overview read model.
- Chapter CRUD and batch import.
- Explicit durable Chapter Analyze flow.
- Durable GenerationJob / StageAttempt execution.
- Worker bounded concurrency and claim/lease/heartbeat recovery.
- Storyboard and VisualBeat review foundation.
- Character library read API.
- AI Character/Location continuity materialization and Scene relation persistence foundation.
- Job history, quota and notification read surfaces.
- Durable ProviderOperation reservation/submission/UNKNOWN-reconciliation foundation.
- Chapter analysis admission checks for safety, entitlement, quota and estimated cost reservation.

## Remaining product gaps

- Full character version/reference/lock workflow.
- Approved storyboard reset/versioning workflow.
- Production hardening of provider reconciliation and actual-usage accounting.
- Image/TTS/video/render/export pipeline.
- Full billing ledger/reconciliation and unused reservation release.
- Broader moderation/consent/abuse coverage, observability, backup/restore and deletion lifecycle evidence.

## Documentation rules

Derived documents are implementation views. They must not redefine domain invariants independently.

When code, migration, ADR and documentation disagree:

1. Product/domain invariants decide intended behavior.
2. Current code/tests/migrations decide AS-IS implementation claims.
3. Historical audit documents remain evidence only.

Every current-state capability must clearly use the canonical documentation status vocabulary: `IMPLEMENTED`, `PARTIAL`, `PENDING`, `PROTOTYPE` or `TARGET`.
