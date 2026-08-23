# NarrativeX AI Worker Codebase

## Authority and role

This document describes the current Python worker implementation for the V1.11 baseline. Product and architecture authority remains `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`.

The worker is the asynchronous execution runtime for AI/media workloads. It is not a browser-facing API and it is not canonical product/domain authority. Spring Boot owns client APIs, authorization and durable orchestration policy; PostgreSQL owns durable execution state.

## Runtime and dependencies

- Python `>=3.12`.
- Package: `narrativex-worker 0.1.0`, built with Hatchling.
- Configuration/validation: Pydantic v2 + Pydantic Settings.
- PostgreSQL client: asyncpg.
- HTTP client: HTTPX.
- Google authentication: `google-auth` / ADC or workload identity.
- Quality: Ruff, strict mypy, pytest and pytest-asyncio.
- Entry points: `python -m narrativex_worker` and `narrativex-worker`.

The current dependency manifest does **not** include FastAPI, Starlette or Uvicorn. The worker is not an HTTP API service.

## Current Chapter Analyze flow

```text
Backend admission + durable enqueue
  -> OperationPlan + GenerationJob + StageAttempt
  -> optional Redis delivery hint
  -> worker polls PostgreSQL
  -> FOR UPDATE ... SKIP LOCKED claim
  -> lease owner + heartbeat
  -> persisted Chapter snapshot request
  -> provider port
  -> Vertex Gemini when configured
  -> Pydantic structured-result validation
  -> Chapter rowVersion/sourceHash validation
  -> Character / ProjectCharacter / CharacterVersion materialization
  -> Scene / VisualBeat materialization
  -> terminal StageAttempt + GenerationJob state
```

A dropped Redis delivery hint must not lose queued work. PostgreSQL remains authoritative.

## Capability classification

| Capability | Current state |
|---|---|
| Provider-neutral schemas/ports | IMPLEMENTED |
| Disabled safe provider | IMPLEMENTED; fails explicitly and never fakes successful production output |
| PostgreSQL durable job polling | IMPLEMENTED |
| Claim with `FOR UPDATE ... SKIP LOCKED` | IMPLEMENTED |
| StageAttempt lease/heartbeat/stale recovery foundation | IMPLEMENTED |
| Bounded worker concurrency | IMPLEMENTED; configured by `WORKER_CONCURRENCY` |
| Chapter snapshot protection | IMPLEMENTED using `rowVersion` + `sourceHash` checks |
| Vertex Gemini structured Chapter analysis | IMPLEMENTED foundation |
| Character/Scene/VisualBeat result materialization | IMPLEMENTED foundation |
| ProviderOperation durable lifecycle | IMPLEMENTED foundation with fail-closed ambiguous-submission recovery and paced reconciliation metadata |
| Location materialization | IMPLEMENTED foundation |
| Scene character/location continuity materialization | IMPLEMENTED foundation |
| Image generation | IMPLEMENTED foundation; durable role wiring and Vertex Batch inference |
| TTS/subtitle generation | IMPLEMENTED foundation; Google/VieNeu narration, alignment and ASS subtitles |
| FFmpeg render/export | IMPLEMENTED foundation; deterministic IMAGE_MOTION, ffprobe and final storage |

## Chapter analysis contract

The worker executes against persisted Chapter identity/state rather than arbitrary browser text. The request includes the project/story/chapter identity plus the Chapter snapshot fields required to reject stale results.

Before materialization the worker verifies that the persisted Chapter still matches the execution snapshot. If the Chapter changed while AI was executing, the old result must not be applied to the newer source.

The provider result is validated with Pydantic before persistence. Current analysis output supports Characters, Locations, Scenes and VisualBeats, and the worker materializes the project-scoped location identities plus scene character/location references under the same transaction.

## Provider modes

### Disabled

`AI_PROVIDER_MODE=disabled` is the safe default. It fails explicitly instead of synthesizing successful AI output.

### Vertex Gemini

`AI_PROVIDER_MODE=vertex` enables the Vertex Gemini adapter. Authentication uses Google Application Default Credentials/workload identity. Provider credentials must never come from the browser or be baked into the image. A worker with `WORKER_ENV=production` and the `image-generation` role must use `IMAGE_PROVIDER_MODE=vertex` and `MEDIA_STORAGE_MODE=r2`; fake, disabled and local adapters are rejected at startup.

External provider execution follows an at-most-once submission fence:

```text
RESERVED
  -> persist UNKNOWN before the external call can begin
  -> provider returns a durable operation id: SUBMITTED/RUNNING and reconcile
  -> provider returns terminal response: COMPLETED/FAILED
```

`RESERVED` is the only state that proves the external-call fence was not crossed and is therefore the only state that can be safely submitted after restart. `UNKNOWN`, `SUBMITTED` and `RUNNING` are never blindly resubmitted.

The `SHOT_IMAGE_GENERATE` batch path is fenced atomically by
`prepare_provider_submission`: it verifies the stage lease, creates or locks the deterministic
provider operation, binds every queued `media_generation_items` row, and sets
`next_reconcile_at` while the operation is already `UNKNOWN`, all in one PostgreSQL transaction.
The provider call starts only after that transaction commits. This prevents a crash from leaving
running items attached to an operation that is absent from the reconciliation queue.

For `SHOT_IMAGE_GENERATE`, the heartbeat and processing task are joined. If the heartbeat loses
the stage lease, the processing task is cancelled and cannot start another provider submission.
Immediately before a new paid submission, the worker performs a final
`(stage_attempt_id, worker_id, lease_token, status=RUNNING)` fence. Mutations made by the claimed
worker carry that same lease identity; reconciliation without a stage claim remains protected by
provider-operation compare-and-set state.

Every provider-operation mutation carries the loaded snapshot and uses optimistic CAS on both status and `row_version`. `COMPLETED` and `FAILED` are terminal; a stale reconciliation response is discarded after reloading the latest durable state.

Provider capabilities explicitly declare whether durable operation reconciliation is supported. The current synchronous Vertex `generateContent` adapter does not expose a pollable durable operation id. If submission times out, the process dies after the UNKNOWN fence, or a non-terminal state lacks a durable operation id, the worker preserves the ambiguous operation and schedules reconciliation (or explicit manual attention when reconciliation is unsafe) rather than risking a duplicate provider request or charge.

Reconciliation candidates are limited to `UNKNOWN`, `SUBMITTED` and `RUNNING` rows whose `next_reconcile_at` is due and whose StageAttempt is still non-terminal. Narration claims due reconciliation before ordinary queued work. The database records `reconcile_attempts` and `last_reconcile_error`; unsupported or unsafe reconciliation is suspended by clearing `next_reconcile_at` while preserving the ambiguous provider status and exposing `NARRATION_REQUIRES_ATTENTION` at job level.

Narration follows the same fence with additional recovery rules: storage/DB failures after TTS
submission keep the provider operation `UNKNOWN`, immutable R2 objects are reused after checksum
validation, and finalization-only infrastructure failures move the stage/job to `STALLED`. Retry
stages reuse the logical narration operation by `(provider_key, request_fingerprint)`; the original
stage id is audit provenance only. Lease-safe stage transitions update the parent job only when the
worker still owns the running stage.

## Claim, lease and concurrency

Workers claim eligible durable attempts with PostgreSQL row locking and `SKIP LOCKED`. The claim query carries the observed `status` and `row_version` for both `GenerationJob` and `StageAttempt`. It compare-and-sets the parent first, then the stage, requiring exactly one affected row at each step; a conflict returns no claim or rolls the transaction back. This prevents a concurrent cancellation/failure or metadata update from resurrecting a parent job, and prevents returning a claim when parent and stage did not transition together. Broad predicates such as `status <> 'COMPLETED'` are not valid claim transitions. A running attempt records worker ownership and heartbeat state. Stale attempts can be recovered according to lease policy.

`WORKER_CONCURRENCY` defaults to 4 and is bounded by configuration. Both Chapter analysis and full-chapter narration use it as the maximum number of active jobs in one worker process. Narration keeps segments within one chapter sequential, so concurrency is applied between independent chapter jobs rather than multiplying TTS requests without a bound.

Database pool sizing follows configured concurrency. The narration repository receives `max(5, WORKER_CONCURRENCY + 2)` as its pool limit so task concurrency is not silently throttled by the former fixed `max_size=5` pool. Graceful shutdown stops new claims, lets in-flight narration retain its heartbeat and finish, then closes the repository pool. A lease-loss path cancels processing without claiming authority to mark the job failed; durable provider-operation UNKNOWN semantics remain the recovery boundary.

Media-validation jobs use a fresh UUID lease token and increment `row_version` on every claim. Heartbeats and terminal transitions require the job id, worker id, lease token, `RUNNING` status, and an unexpired lease. Completion fences the validation job before changing the asset, upload sessions, or cleanup queue, so a reclaimed stale worker can produce no durable side effects.

### Chapter translation execution

Chapter translation is chunked by semantic boundaries. Every provider chunk derives its own
request fingerprint from the current source lineage, target language, chunk index and chunk hash,
then owns a separate `provider_operations` fence. Completed chunks are replayed from durable
normalized results; `UNKNOWN` chunks are never blindly resubmitted. The final immutable translation
variant is materialized only after every chunk is durably completed.

Vertex translation returns actual usage metadata together with the raw text. The worker persists
the provider operation as `COMPLETED` with actual billing before running structural translation
validation, so invalid output still leaves auditable billed cost. A translation stage heartbeat
runs at most one-third of the lease interval while provider calls are in flight; lease loss
cancels the work and cannot mark the job completed or failed from the old owner.

## Application boundaries

### Worker owns

- durable AI/media stage execution;
- claim/lease/heartbeat execution mechanics;
- provider invocation through provider-neutral ports;
- prompt/schema boundary and structured validation;
- stale Chapter protection;
- current Chapter-analysis result materialization;
- image-generation, media-validation, narration and render role execution against durable snapshots.

### Worker does not own

- browser authentication/authorization;
- user/project ownership decisions;
- HTTP session management;
- public product APIs;
- entitlement/billing policy authority;
- Flyway schema ownership;
- arbitrary direct mutation of domain state outside defined durable execution/materialization contracts.

## Current gaps

- Complete provider actual-usage reconciliation across all operation types.
- Complete user-provided-audio render slicing/stitching and production hardening.
- Full review/reuse lineage around generated images and final artifacts.
- Broader production observability, recovery and provider integration evidence.

## MVP image/render execution contract

The worker has provider-neutral image request/result contracts, a fail-closed Vertex Batch adapter,
bounded PNG/JPEG/WEBP validation, character-reference-aware requests, immutable private R2 result keys,
and durable PostgreSQL materialization. Provider submission timeouts and transport/5xx failures become
`UNKNOWN`; the runner never blind-resubmits an ambiguous operation. The render role consumes pinned
render-input snapshots, builds deterministic IMAGE_MOTION FFmpeg output with ASS subtitles, validates
the result with ffprobe/checksum, and promotes the final MP4 through the configured final-video storage
boundary.

## Verification expectations

Worker CI must continue to run Ruff, mypy and pytest. Integration/E2E verification should prove the durable path:

```text
saved Chapter
  -> durable queued work
  -> worker claim + heartbeat
  -> provider execution
  -> validated materialization
  -> durable terminal state
```

It should additionally cover stale Chapter rejection, stale lease recovery, disabled-provider fail-closed behavior, crash recovery around the provider submission fence and real-provider structured-output compatibility.
