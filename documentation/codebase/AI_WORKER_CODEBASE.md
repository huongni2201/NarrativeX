# NarrativeX AI Worker Codebase

## Authority and role

This document describes the current Python worker implementation for the V1.10 baseline. Product and architecture authority remains `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_10.md`.

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
| Image generation | PENDING |
| TTS/subtitle generation | PENDING |
| FFmpeg render/export | PENDING |

## Chapter analysis contract

The worker executes against persisted Chapter identity/state rather than arbitrary browser text. The request includes the project/story/chapter identity plus the Chapter snapshot fields required to reject stale results.

Before materialization the worker verifies that the persisted Chapter still matches the execution snapshot. If the Chapter changed while AI was executing, the old result must not be applied to the newer source.

The provider result is validated with Pydantic before persistence. Current analysis output supports Characters, Locations, Scenes and VisualBeats, and the worker materializes the project-scoped location identities plus scene character/location references under the same transaction.

## Provider modes

### Disabled

`AI_PROVIDER_MODE=disabled` is the safe default. It fails explicitly instead of synthesizing successful AI output.

### Vertex Gemini

`AI_PROVIDER_MODE=vertex` enables the Vertex Gemini adapter. Authentication uses Google Application Default Credentials/workload identity. Provider credentials must never come from the browser or be baked into the image.

External provider execution follows an at-most-once submission fence:

```text
RESERVED
  -> persist UNKNOWN before the external call can begin
  -> provider returns a durable operation id: SUBMITTED/RUNNING and reconcile
  -> provider returns terminal response: COMPLETED/FAILED
```

`RESERVED` is the only state that proves the external-call fence was not crossed and is therefore the only state that can be safely submitted after restart. `UNKNOWN`, `SUBMITTED` and `RUNNING` are never blindly resubmitted.

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

Workers claim eligible durable attempts with PostgreSQL row locking and `SKIP LOCKED`. A running attempt records worker ownership and heartbeat state. Stale attempts can be recovered according to lease policy.

`WORKER_CONCURRENCY` defaults to 4 and is bounded by configuration. Both Chapter analysis and full-chapter narration use it as the maximum number of active jobs in one worker process. Narration keeps segments within one chapter sequential, so concurrency is applied between independent chapter jobs rather than multiplying TTS requests without a bound.

Database pool sizing follows configured concurrency. The narration repository receives `max(5, WORKER_CONCURRENCY + 2)` as its pool limit so task concurrency is not silently throttled by the former fixed `max_size=5` pool. Graceful shutdown stops new claims, lets in-flight narration retain its heartbeat and finish, then closes the repository pool. A lease-loss path cancels processing without claiming authority to mark the job failed; durable provider-operation UNKNOWN semantics remain the recovery boundary.

## Application boundaries

### Worker owns

- durable AI/media stage execution;
- claim/lease/heartbeat execution mechanics;
- provider invocation through provider-neutral ports;
- prompt/schema boundary and structured validation;
- stale Chapter protection;
- current Chapter-analysis result materialization;
- future media execution once those stages are implemented.

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
- Image generation and asset production.
- TTS/subtitle generation.
- Render/export/final artifact validation.
- Broader production observability, recovery and provider integration evidence.

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
