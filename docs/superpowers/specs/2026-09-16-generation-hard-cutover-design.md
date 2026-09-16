# Generation Service Hard Cutover Design

**Date:** 2026-09-16
**Status:** Approved in chat
**Scope:** PR1 backend verification, PR2 VoiceStudio cancellation, PR3 generation-service hard cutover

## Goal

Bring the repository back to green provider-independent gates, make VoiceStudio cancellation obey the existing Compute Protocol contract, and complete the runtime migration from direct PostgreSQL-polling workers to `app/generation-service` without leaking NarrativeX business state into the compute plane.

The implementation runs directly on the existing `main` branch. Existing unrelated working-tree changes remain untouched.

## Current evidence

- The repository is `D:\workspace\NarrativeX` on `main`.
- The first backend reproduction stopped in Maven Resources Plugin because the sandbox could not write `target/classes`; a privileged reproduction completed resource processing and compilation.
- The completed backend `verify` ran 404 tests and reported 6 failures plus 8 errors. The first Spring context root cause was `HttpGenerationExecutionAdapter` not having a constructor selected by Spring. Other failures include architecture dependency direction, MyBatis/Flyway schema-reference drift, and stale test expectations.
- Generation-service Ruff, mypy and compute-contract checks pass. Its full pytest run is currently blocked on the host's `pytest` temporary-directory ACL (`C:\Users\PC\AppData\Local\Temp\pytest-of-PC`), not on an asserted provider failure.
- `app/generation-service` already contains the protocol, SQLite journal, Dockerfile and executor adapters, but its default bootstrap catalog is empty. Compose still runs `ai-worker` and `narration-worker`; CI still has an AI-worker job.
- `durationMs` is already rejected by the backend command and API validation. It will be removed from the internal command only if a failing test or call-site audit proves that the field is part of the current regression; it is not changed speculatively.

## Architecture

Spring Boot remains the control plane and the only owner of NarrativeX domain state, admission, durable jobs, leases, retries, reconciliation and artifact publication. `generation-service` remains a domain-agnostic execution plane with its own SQLite execution journal and no PostgreSQL, project workspace, business IDs or domain mutations.

The existing Compute Protocol v1 gains the already-implemented provider-neutral `text.generate` task schema as a documented task type. This resolves the current conflict between the hard-cutover requirement to migrate Qwen analysis and the older protocol text that listed only audio/image/media tasks. The task carries typed prompt inputs and opaque artifact capabilities; it does not carry chapter/project identifiers. This is a boundary change: `contracts/compute/v1/schemas/compute-task.json`, `contracts/compute/v1/openapi.yaml`, golden examples, `documentation/COMPUTE_PROTOCOL.md` and a new or explicitly amended ADR must be synchronized before the cutover can be considered valid. The old statement that chapter analysis remains backend-owned is replaced only for the new domain-neutral `text.generate` boundary; business interpretation and persistence remain backend-owned.

The runtime sequence is:

```text
Desktop -> Backend control plane -> Generation Service -> provider adapter/runtime
                                      |
                                      +-> SQLite execution journal
```

The backend submits immutable attempts, observes/reconciles status, requests cancellation and publishes verified artifacts. The generation service executes only the task presented by the backend and reports observations. Provider-side GPU abort is not claimed when the provider has no reliable cancellation endpoint.

## Migration sequence

1. Reproduce and repair the backend `verify` failures without disabling tests or plugins.
2. Add VoiceStudio in-flight request cancellation, race-safe upload checks and focused tests.
3. Re-run the generation-service cancellation/recovery matrix and provider-independent checks.
4. Audit workload parity, especially WhisperX alignment and media validation, before routing each slice.
5. Add canonical generation-service runtime configuration, register concrete adapters, and make the Docker image include the runtime dependencies required by configured executors.
6. Complete the backend outbound compute boundary and use it for `text.generate`, `image.generate`, `audio.synthesize`, `audio.align` and `media.validate` slices. Each dispatcher must reconcile observations until `SUCCEEDED`, `FAILED` or `CANCELED`; `ACCEPTED` and `RUNNING` are never sufficient to mark a business job ready.
7. Cut over workloads in this order: Qwen/text generation, ComfyUI/image generation, VoiceStudio/TTS, WhisperX/alignment, media validation.
8. Verify cancellation, ambiguous outcomes and restart recovery. ComfyUI resumes by persisted handle where supported; Qwen and VoiceStudio remain ambiguous after an unconfirmed dispatch and are never blindly resubmitted.
9. Switch Compose ownership to `postgres`, `backend`, `generation-service` and provider runtimes; remove `ai-worker` and `narration-worker` only after no active runtime path depends on them.
10. Remove the legacy CI job, stale env/config, obsolete tests and current-state documentation residue. Preserve accepted historical ADRs and explicitly label historical references.

## Cancellation semantics

`VoiceStudioClient.synthesize` and `synthesize_reference` accept `cancel: asyncio.Event | None`. Both call paths use one private `_await_response` helper that races the provider request task against `cancel.wait()` using `asyncio.FIRST_COMPLETED`.

- If the provider responds first, the cancellation waiter is cancelled and cleaned up and the response is returned.
- If the user cancellation event wins, the request task is cancelled and awaited, then `ExecutionCanceledError` is raised.
- If an outer `asyncio.Task.cancel()` interrupts the race, both the request task and cancellation waiter are cleaned up and the original `asyncio.CancelledError` is re-raised.
- The VoiceStudio executor passes the event to both client methods and checks it immediately after synthesis and before artifact upload. A canceled execution never uploads an output.
- No fake provider-side cancel endpoint is added.

## Error and recovery handling

Provider-specific failures are translated at adapter boundaries. User cancellation is represented by `ExecutionCanceledError` and durable `CANCELED`; infrastructure task interruption is not converted. Submission intent is journaled before external I/O. `SUBMITTING` and `UNKNOWN` remain conservative and do not trigger blind resubmission. Existing execution handles are passed only to adapters with a verified resume/lookup contract.

Backend HTTP transport treats a timeout or lost acknowledgement as ambiguous and reconciles through `GET /v1/tasks/{taskId}/attempts/{attemptId}`. A terminal provider observation is applied only after task/attempt identity, sequence and artifact integrity are verified.

WhisperX alignment is not allowed to synthesize a successful fallback timeline after compute failure. `AlignmentStatus.READY` requires a verified WhisperX word-timing result whose source ranges, UTF-16 offsets, duration bounds and artifact checksum pass the existing contract. Provider failure becomes a failed/unknown alignment operation according to the backend lifecycle; a provisional timeline, if retained for an editor draft, must remain explicitly non-ready and must never make a render eligible.

The backend dispatcher must not treat a one-shot `GET` immediately after `POST` as terminal reconciliation. It may return an accepted/running state to an asynchronous caller, or poll with a bounded interval until terminal, but it must persist and reconcile the attempt before marking `STORYBOARD_READY`, `MEDIA_READY`, `NARRATION_READY` or an equivalent business completion state. Transport timeout after submit maps to `UNKNOWN` and is reconciled before another attempt is created.

## Explicit acceptance criteria

### Protocol and ADR consistency

- `text.generate` is present in the shared JSON Schema, OpenAPI contract, a checked-in example and both backend and generation-service validation tests.
- The protocol documentation and an accepted ADR amendment/new ADR state that Qwen text generation is domain-neutral compute, while backend remains responsible for chapter interpretation, validation, persistence and lifecycle.
- Contract checks fail if the shared schema, OpenAPI, examples and implementation task registry disagree.

### Generation-service runtime

- `bootstrap.py` builds a production catalog from concrete Qwen, ComfyUI, VoiceStudio, WhisperX and media-validation adapters. An unavailable optional dependency or provider endpoint reports `ready=false` for that adapter rather than making the process fail during import; CI fakes remain isolated tests.
- Canonical settings use `GENERATION_SERVICE_HOST`, `GENERATION_SERVICE_PORT`, `GENERATION_SERVICE_MACHINE_TOKEN`, `GENERATION_SERVICE_JOURNAL_FILE`, `GENERATION_MAX_CONCURRENCY`, request/artifact limits and provider-specific compute settings. Compatibility aliases are allowed only during the migration and are not used by Compose after cutover.
- The Docker image installs the dependencies required by the configured runtime, including the declared narration/image extras or an equivalent explicit build target. The image contains no backend source, NarrativeX PostgreSQL credentials, project-media bind or business-state client.
- The service receives only Compute Protocol task data and opaque artifact capabilities. It never receives `DATABASE_URL`, R2 credentials, project-relative storage keys, absolute paths or domain identifiers.

### Backend dispatch and alignment

- The backend outbound adapter exposes submit, query/reconcile and cancel through the existing compute port without exposing provider-specific request models to domain/application code.
- Dispatchers persist attempt intent before external submission, preserve `UNKNOWN` on ambiguous transport outcomes, ignore duplicate/older observations and publish artifacts only after identity/checksum validation.
- No dispatcher marks a business job complete from `ACCEPTED`, `RUNNING`, a null observation or a synthetic fallback.
- WhisperX output is the canonical alignment source for production narration timing; failure, timeout, cancellation, missing output, malformed words, source-offset divergence or checksum mismatch cannot produce `READY`.

### Workload parity gate

| Workload | Current implementation to remove | Required replacement evidence |
| --- | --- | --- |
| Qwen/text analysis | `app/ai-worker` direct provider/orchestration | Backend creates closed `text.generate` task; generation-service Qwen executor returns validated artifact; recovery never blindly resubmits |
| Image generation | `app/ai-worker` image worker/provider path | Backend creates `image.generate`; ComfyUI handle is journaled and resumed/reconciled |
| Narration/TTS | `narration-worker` and worker TTS orchestration | Backend creates `audio.synthesize`; VoiceStudio cancellation and no-upload race tests pass |
| Subtitle alignment | legacy worker alignment path | Backend creates `audio.align`; WhisperX output passes source/word timing/artifact contract |
| Media validation | `app/ai-worker` media validation worker | Backend creates `media.validate`; generation-service returns verified validation output |

The legacy worker is deleted only after every row has a replacement call path and focused success/cancel/recovery evidence. A search result in historical ADRs or migration plans is allowed; a current Compose, CI, runtime script or production source reference is not.

### Reproducible verification environment

- Backend verification uses the repository's Maven wrapper and a writable repository-scoped Maven user/cache when the host ACL prevents writes to the default user cache.
- Generation-service pytest uses a repository-scoped `--basetemp` directory and does not depend on the host's locked global pytest temp root.
- Provider-independent gates are mandatory and deterministic. Live provider E2E is a separate gate whose result is reported as unavailable when the required runtime/credential is absent; it is never replaced by a fake-provider success claim.

## Testing strategy

- Use existing failing tests as the red signal for backend gate repairs; add a regression test before each production behavior change.
- Add VoiceStudio tests for cancel during normal synthesis, cancel during reference synthesis, cancel-before-upload race, normal successful upload and raw `asyncio.Task.cancel()` propagation.
- Keep Qwen, ComfyUI and WhisperX cancellation/recovery tests green after the shared helper changes.
- Add generation-service runtime tests proving catalog registration, protocol task validation, journal-before-I/O, no-blind-resubmit recovery, cancellation persistence and terminal-state immutability.
- Add backend adapter/dispatcher tests for submit, query, cancel, sequence/reconciliation and provider-neutral task payloads.
- Use deterministic fakes in CI. Do not report a fake provider as production health; live provider E2E is run only when the configured Qwen, ComfyUI, VoiceStudio and WhisperX runtimes are available.
- Run backend Maven verify, generation-service pytest/Ruff/mypy, desktop `npm run check`, repository scripts, Compose config validation and the available E2E matrix before completion.

## Documentation and residue policy

Current-state documents are updated to say `generation-service` is the active sole compute execution plane only after the runtime and tests prove it. Historical ADRs and migration records remain, but current docs and CI residue checks must not claim that `ai-worker` or `narration-worker` are active. Residue checks use an explicit allowlist for historical documents rather than scanning ADR history blindly.

## Non-goals

- No new broker, cache, business microservice or per-user billing/quota model.
- No provider SDKs in backend domain modules.
- No provider-side GPU cancellation claim without a reliable provider contract.
- No manual `durationMs` timing override retained in a new internal command if its only invariant is nullability; that cleanup is evidence-driven and separate from the cancellation/cutover work.
