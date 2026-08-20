# NarrativeX Current Implementation Traceability

This matrix maps the maintained V1.10 contract to current repository evidence. The source-of-truth defines intended invariants; code, migrations and tests define factual implementation state.

## Current implementation map

| Capability / invariant | Implementation evidence | Test/evidence boundary | Status |
|---|---|---|---|
| Project creation is metadata-only | backend Project command/API | project/backend tests | IMPLEMENTED |
| Persisted Chapter source + optimistic snapshot | Chapter API/domain/persistence, `sourceHash`, `rowVersion`, ETag/If-Match | backend Chapter tests | IMPLEMENTED |
| Explicit Chapter Analyze | generation API/use case | backend generation tests | IMPLEMENTED |
| Admission before expensive analysis | safety/entitlement/quota/cost admission services + atomic usage reservation | backend admission tests | IMPLEMENTED |
| Durable enqueue | `OperationPlan`, `GenerationJob`, `StageAttempt`, `OutboxEvent` persistence | backend persistence/integration tests | IMPLEMENTED |
| Redis is non-authoritative for jobs | PostgreSQL job/outbox state + best-effort delivery hints | architecture/integration behavior | IMPLEMENTED |
| Worker durable claim | `repository.py`, PostgreSQL `FOR UPDATE ... SKIP LOCKED` | worker tests | IMPLEMENTED |
| Worker lease/heartbeat/recovery | `worker.py`, repository lease operations | worker lease/restart tests | IMPLEMENTED |
| Bounded process concurrency | `WorkerSettings.worker_concurrency`, `NarrativeXWorker` | worker settings/concurrency tests | IMPLEMENTED |
| ProviderOperation reserved before external work | worker repository + durable provider-operation rows | `test_worker.py` provider durability tests | IMPLEMENTED |
| No blind resubmit after ambiguous provider outcome | `UNKNOWN` state + reconciliation path | timeout/restart reconciliation tests | IMPLEMENTED |
| Completed provider result replay after crash | normalized provider result persisted before final materialization | crash/restart worker regression test | IMPLEMENTED |
| Stale Chapter result rejection | worker snapshot check before materialization | worker regression tests | IMPLEMENTED |
| Character continuity materialization | `materialization/identity.py` Character/ProjectCharacter identity mapping | continuity/identity tests | IMPLEMENTED |
| Location continuity materialization | `materialization/identity.py::materialize_locations` | continuity materialization tests | IMPLEMENTED |
| Scene -> ProjectCharacter relation | `materialization/storyboard.py`, `scene_characters` writes | `test_continuity_materialization.py` | IMPLEMENTED |
| Scene -> Location relation | storyboard Scene location persistence | `test_continuity_materialization.py` | IMPLEMENTED |
| Storyboard/VisualBeat foundation | storyboard backend + worker materialization | backend/worker tests | IMPLEMENTED |
| Character read/API foundation | character feature APIs | backend/frontend integration contracts | IMPLEMENTED |
| Job history/quota/notification reads | account/generation/notification features | backend tests/contracts | IMPLEMENTED |
| Frontend Chapter Analyze/job polling | Chapter frontend API/query flow | frontend contract tests/build | IMPLEMENTED |
| Frontend Storyboard foundation | Storyboard API/query flow | frontend contract/build gates | IMPLEMENTED |
| Dual media planning contracts | `media.py` production/motion/asset strategy contracts | `test_media_planning.py`; not wired to persisted media plans yet | PROTOTYPE |
| Local Wan I2V adapter | `providers/wan.py`, `VideoGenerationProvider`, Wan settings | deterministic adapter tests; not wired to durable media jobs yet | PROTOTYPE |
| R2 durable-media configuration contract | `WorkerSettings` R2 settings + Compose/env configuration | `test_config.py`; upload/download adapter not wired yet | PARTIAL |
| Image/TTS/render/export | no complete production vertical slice | N/A | PENDING |
| Full Character version/reference/lock workflow | partial domain/API foundation | incomplete end-to-end review workflow | PARTIAL |
| Approved storyboard reset/versioning | protection exists; complete user workflow not established | re-analysis safety tests | PARTIAL |
| Complete actual-usage/billing reconciliation | reservation foundation exists | full ledger/refund/release evidence incomplete | PARTIAL |
| Production moderation/consent/abuse/DR/observability | foundations vary by concern | public-production evidence incomplete | PARTIAL |

## Durable Chapter Analyze contract

```text
persisted Chapter
  -> ownership + snapshot validation
  -> safety / entitlement / quota / cost admission
  -> atomic usage reservation
  -> OperationPlan
  -> GenerationJob
  -> StageAttempt
  -> OutboxEvent
  -> COMMIT
  -> optional Redis delivery hint
  -> worker claim + lease + heartbeat
  -> ProviderOperation RESERVED
  -> provider submission/result/reconciliation
  -> stale Chapter check
  -> Character + Location continuity materialization
  -> Scene + VisualBeat + Scene continuity relations
  -> terminal durable state
```

## Provider recovery evidence

The current Chapter-analysis worker tests establish important lifecycle behavior:

- persisted `RESERVED` work is reconciled after restart without another submit;
- persisted `SUBMITTED` work is reconciled after restart without another submit;
- a timeout moves the operation to `UNKNOWN` rather than blindly retrying;
- a provider result persisted before a process crash can be replayed into materialization without another provider call;
- losing the StageAttempt lease cancels in-flight execution and prevents successful finalization by the old owner.

The local Wan adapter follows the same boundary semantics at the adapter level: an ambiguous submit raises an unknown-outcome error and reconciliation can query by operation id or stable request id. Durable `GenerationJob`/`StageAttempt`/`ProviderOperation` wiring for media jobs is not yet implemented, so local I2V remains `PROTOTYPE`, not `IMPLEMENTED` end to end.

## Continuity evidence

The current worker uses stable AI keys and validates references before persistence. Materialization creates/reuses project-scoped Locations, maintains Character/Location identity mappings and writes Scene continuity relations. Therefore older documentation claiming that the worker drops Location or Scene character/location continuity is obsolete.

Downstream media generation must still resolve reviewed/versioned Character/reference state; analysis-time continuity persistence is not equivalent to a complete Character lock/reference workflow.

## Production non-claims

NarrativeX is not yet public-production complete. The new production-mode contracts, local Wan adapter and R2 configuration contract are foundations only. Remaining release work includes full-Chapter TTS/alignment, reuse-first image generation/editing, deterministic motion rendering, durable media-job wiring and R2 upload/download execution, backend media workload/cost authority, GPU benchmark/actual usage accounting, broader moderation/consent/abuse coverage, deletion/retention, backup/restore evidence, observability, real-runtime E2E coverage and final export validation.

## Documentation invariants

1. Project creation and Chapter save do not implicitly enqueue AI/media work.
2. The persisted Chapter snapshot is analysis authority.
3. PostgreSQL is authoritative for durable generation state.
4. Redis generation delivery/progress is non-authoritative.
5. External provider work has durable lifecycle state before submission.
6. `UNKNOWN` is a reconciliation state, not a blind-retry trigger.
7. Provider-operation mutations require the caller's expected status and `row_version`; `COMPLETED` and `FAILED` are terminal.
8. Worker materialization re-checks Chapter snapshot identity.
9. Approved/locked history is not destructively overwritten.
10. Current-state docs use `IMPLEMENTED`, `PARTIAL`, `PENDING`, `PROTOTYPE` or `TARGET`.
11. Historical V1.8/V1.9 labels must be explicitly historical, never the current repository baseline.
12. `IMAGE_MOTION` never authorizes I2V; `HYBRID_LOCAL_I2V` remains image-first and authorizes only planned selected-beat I2V.
13. Cloudflare R2 is the sole durable media object store; worker-local media files are scratch/cache only.
