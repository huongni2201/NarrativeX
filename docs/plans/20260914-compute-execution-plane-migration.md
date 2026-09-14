# Compute Execution Plane Migration

## Overview

Replace the domain-aware PostgreSQL-polling `app/ai-worker` with a Spring Boot control plane and a
new domain-agnostic `app/gpu-worker`. Preserve the backend's durable lifecycle guarantees while
making local RTX 4060 and remote GPU targets interchangeable through one Compute Protocol.

This is a staged replacement. It is not a directory rename, a big-bang rewrite, or a permanent
dual-write system.

## Context from discovery

- The current checkout is clean `main`; only `origin/refactor/compute-execution-plane` exists.
- Neither current `main` nor the remote migration branch contains committed `app/gpu-worker` files.
- The remote branch revives Vertex-related work that conflicts with this plan; reconcile it before
  using it as the implementation base.
- Backend already owns `GenerationJob`, `StageAttempt`, `NarrationOperation`, `ProviderOperation`,
  `OperationPlan`, quota reservation, outbox and MyBatis persistence.
- `ProviderOperation` already models `UNKNOWN` and reconciliation-safe transitions; preserve it.
- `GenerationOutboxDispatcher` currently only finalizes bookkeeping because Python workers poll
  PostgreSQL directly. It is the dispatch seam to replace, not a working external dispatcher.
- `app/ai-worker` mixes direct SQL, domain materialization, orchestration and executor code. Direct
  SQL touches lifecycle and project/storyboard/media tables.
- Compose and CI have `ai-worker`/`narration-worker` but no `gpu-worker` service/job.
- Spring MCP currently sees the monorepo root as a generic Java module. Open/import
  `app/backend-service` as a Maven module before relying on its endpoint/entity inventory.

## Chosen approach

Use backend-push HTTP submission with callback observations plus backend reconciliation polling.
The backend persists intent before submission, translates domain data into closed task schemas, and
maps results back into domain state. Worker responses are observations only. Artifact bytes use
opaque, time-limited capabilities and checksums.

Narration is the first vertical slice. It proves submit/replay, heartbeat, ambiguity,
artifact publication, VoiceStudio and WhisperX without first migrating the much larger image and
chapter-analysis surface.

Testing approach: regular implementation with unit, contract and integration tests in every task.
All tests for a task must pass before the next task begins.

## Target topology

```text
Desktop -> backend-service (domain + lifecycle + routing + persistence)
                         |
                  Compute Protocol v1
                         |
              +----------+----------+
              |                     |
       local gpu-worker      remote gpu-worker
              |                     |
       executor adapters      executor adapters
```

## Migration invariants

- Backend is the only component that reads/writes NarrativeX business tables.
- No domain ID, DB credential, absolute path, open metadata bag or provider secret crosses the
  compute boundary.
- Reservation/outbox state is durable before external submission.
- Ambiguous submission becomes backend `UNKNOWN`; reconciliation precedes resubmission.
- Every attempt is immutable, fingerprinted and idempotently replayable.
- Worker fake executors are test-only and cannot report production readiness.
- No legacy deletion occurs until dependency scan, parity, recovery and rollback gates pass.

## Implementation steps

### Task 1: Reconcile the migration branch and freeze the legacy inventory

**Files:**
- Create: `documentation/migrations/compute-execution-plane-inventory.md`
- Modify: `docs/plans/20260914-compute-execution-plane-migration.md`

- [x] Determine whether unpushed `app/gpu-worker` work is visible in the current checkout or remote;
  none is present, so separately held work must be supplied explicitly before review.
- [x] Compare `origin/refactor/compute-execution-plane` to `main`; classify each changed file as
  keep, rewrite, or discard, explicitly rejecting revived Vertex/browser legacy.
- [x] Create/checkout a local `refactor/compute-execution-plane` branch only after resolving the
  branch discrepancy; preserve unrelated user work.
- [x] Record every `ai-worker` responsibility cluster, SQL table/claim path, materializer, executor,
  deployment reference
  and test owner in the inventory.
- [x] Add a forbidden-dependency check design for `asyncpg`, NarrativeX domain vocabulary and
  absolute-path fields in `gpu-worker`.
- [x] Verify the inventory against CodeGraph call paths and `rg`; update this plan for discoveries.

### Task 2: Establish Compute Protocol v1 as a shared contract

**Files:**
- Modify: `documentation/COMPUTE_PROTOCOL.md`
- Create: `contracts/compute/v1/openapi.yaml`
- Create: `contracts/compute/v1/schemas/*.json`
- Create: `contracts/compute/v1/examples/*`
- Create: `scripts/check_compute_contracts.py`
- Create: `scripts/tests/test_check_compute_contracts.py`

- [x] Encode `ComputeTask`, `ModelRef`, `ArtifactRef`, capability, observation, result and error
  schemas without NarrativeX domain identifiers or arbitrary metadata.
- [x] Encode submit, reconcile, cancel, capabilities and callback endpoints in OpenAPI.
- [x] Define canonical JSON fingerprinting and stable exclusion of expiring access descriptors.
- [x] Define idempotent replay, `409` fingerprint conflict, sequence deduplication and protocol
  compatibility rules.
- [x] Add valid golden examples for narration synthesis/alignment, image generation and media
  validation.
- [x] Add rejection tests for domain IDs, DB/path values, unknown fields, invalid digest, replay
  conflict and incompatible versions.
- [x] Run contract checks; they must pass before Task 3 (`13 passed`).

### Task 3: Scaffold a domain-agnostic `gpu-worker`

**Files:**
- Create: `app/gpu-worker/pyproject.toml`
- Create: `app/gpu-worker/src/narrativex_gpu_worker/api/*`
- Create: `app/gpu-worker/src/narrativex_gpu_worker/domain/*`
- Create: `app/gpu-worker/src/narrativex_gpu_worker/executors/*`
- Create: `app/gpu-worker/src/narrativex_gpu_worker/runtime/*`
- Create: `app/gpu-worker/tests/*`
- Create: `app/gpu-worker/Dockerfile`
- Create: `app/gpu-worker/README.md`

- [x] Implement strict protocol models generated from or validated against the shared schemas.
- [x] Implement authenticated submit/status/cancel/capabilities endpoints.
- [x] Implement a bounded local execution journal keyed by task/attempt/fingerprint; do not use or
  connect to NarrativeX PostgreSQL.
- [x] Implement executor registry, capability reporting, concurrency limits and cooperative cancel.
- [x] Implement artifact download/upload with size/media/checksum validation and log redaction.
- [x] Add architecture tests forbidding `asyncpg`, domain table names/classes, `DATABASE_URL`, drive
  paths and project/workspace resolution.
- [x] Add unit/HTTP tests for replay, conflict, restart recovery, sequence, cancellation, timeout,
  executor crash and artifact failure.
- [x] Run pytest, Ruff, mypy and contract suite; all pass (`42 passed`).

### Task 4: Add backend compute control-plane module

**Files:**
- Create: `app/backend-service/src/main/java/com/narrativex/backend/feature/compute/domain/*`
- Create: `app/backend-service/src/main/java/com/narrativex/backend/feature/compute/application/*`
- Create: `app/backend-service/src/main/java/com/narrativex/backend/feature/compute/infrastructure/*`
- Create: `app/backend-service/src/test/java/com/narrativex/backend/feature/compute/*`
- Modify: `app/backend-service/src/main/resources/application.yml`
- Modify: `app/backend-service/src/main/resources/db/migration/V3__generation_quota_and_media.sql`
- Modify: `app/backend-service/src/main/resources/db/migration/V7__indexes.sql`

> **Persistence review required.** The repository uses MyBatis rather than Spring Data JPA/JDBC;
> keep aggregates persistence-agnostic and follow existing mapper/adapter transaction boundaries.
> NarrativeX is still on the mutable pre-production V1-V8 baseline. Fold compute tables and indexes
> into the migrations that own them. Do not create V9 until the first production baseline is frozen.

- [ ] Introduce backend-owned compute task/attempt mapping with optimistic versioning and durable
  reservation/outbox fields; keep domain IDs only on the backend side of the mapping.
- [ ] Add model and target registry with endpoint, credential reference, capabilities, health,
  scheduling weight and enablement; never store raw credentials in task payloads.
- [ ] Implement task materialization, canonical fingerprinting and submission after transaction
  commit.
- [ ] Implement callback ingestion and reconciliation scheduler with sequence deduplication.
- [ ] Map ambiguous submit/lookup outcomes to existing `ProviderOperation.UNKNOWN`; never blind
  resubmit.
- [ ] Implement artifact capability issuance, refresh, digest verification and atomic publication.
- [ ] Add tests for transactions, optimistic races, callback replay/out-of-order events, target
  failover policy, credential isolation, `UNKNOWN` recovery and artifact rejection.
- [ ] Run backend unit/integration tests; all must pass before Task 5.

### Task 5: Cut narration over as the first vertical slice

**Files:**
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/GenerateChapterNarrationUseCase.java`
- Modify: backend narration lifecycle/dispatch adapters and tests discovered in Task 1
- Create: `app/gpu-worker/src/narrativex_gpu_worker/executors/voicestudio.py`
- Create: `app/gpu-worker/src/narrativex_gpu_worker/executors/whisperx.py`
- Create: matching `app/gpu-worker/tests/` executor tests

- [ ] Convert saved narration operation/segments/voice references into typed
  `audio.synthesize`/`audio.align` tasks without domain identifiers.
- [ ] Migrate VoiceStudio HTTP and WhisperX alignment adapters plus only their domain-neutral audio
  validation primitives; rewrite imports rather than copying worker orchestration.
- [ ] Keep segmentation policy, narration materialization, lifecycle and review decisions in backend.
- [ ] Verify output WAV/alignment schemas, checksum, timing and artifact publication before domain
  completion.
- [ ] Add deterministic executor tests and backend end-to-end contract tests for success, transient
  failure, permanent failure, lost callback, ambiguous submit, worker restart and cancel.
- [ ] Run shadow comparison without dual-writing authoritative state, then enable target routing by
  configuration.
- [ ] Pass narration parity and recovery gates before disabling the old narration poller.

### Task 6: Migrate image generation and media validation executors

**Files:**
- Create: `app/gpu-worker/src/narrativex_gpu_worker/executors/comfyui.py`
- Create: `app/gpu-worker/src/narrativex_gpu_worker/executors/media_validation.py`
- Modify: backend image/media generation orchestration and tests identified in Task 1
- Modify: `app/gpu-worker/tests/*`

- [ ] Keep visual prompt/context creation, character participation, continuity, review and asset
  materialization in backend.
- [ ] Migrate ComfyUI/RealVisXL submission/status/output parsing as a domain-neutral executor;
  configure model/revision through registry.
- [ ] Migrate safe media validation primitives without database claims or project path resolution.
- [ ] Preserve provider reservation-before-submit and opaque execution handles.
- [ ] Add task schema, replay, reconciliation, malformed media, safety, timeout and artifact tests.
- [ ] Run parity/recovery/load gates and disable corresponding legacy pollers.

### Task 7: Resolve non-GPU analysis and remaining materialization ownership

**Files:**
- Modify: backend analysis/storyboard modules identified by Task 1
- Modify: `documentation/workflows/CHAPTER_CONTINUATION.md`
- Modify: `documentation/workflows/STORY_TO_VIDEO.md`

- [ ] Move domain orchestration and materialization out of Python into backend application use cases.
- [ ] Keep chapter analysis in backend or define a separate closed, domain-neutral inference task;
  do not send domain IDs or schemas to `gpu-worker`.
- [ ] Replace Python SQL claim/recovery tests with backend lifecycle and protocol integration tests.
- [ ] Verify source anchoring, immutable snapshots, participating-character-only context and review
  boundaries remain intact.
- [ ] Confirm no runtime dependency remains on legacy chapter analysis/API AI paths.

### Task 8: Deploy the same worker locally and remotely

**Files:**
- Modify: `docker-compose.yml`
- Modify/Create: deployment configuration for remote target environments
- Modify: `.github/workflows/*` or current CI equivalents
- Modify: `scripts/verify-local.ps1`

- [ ] Add one `gpu-worker` image/service definition without `DATABASE_URL` or project media mounts.
- [ ] Configure local RTX 4060 and remote GPU as target-registry entries using the same protocol.
- [ ] Add readiness/capability probes and target-specific credentials.
- [ ] Add CI jobs for contract, unit, type, lint, container and forbidden-dependency checks.
- [ ] Exercise local/remote failover, credential rotation, capacity response and artifact expiry.
- [ ] Run repository verification and deployment smoke tests before Task 9.

### Task 9: Hard-delete legacy runtime after cut-over

**Files:**
- Delete: `app/ai-worker/`
- Modify: `docker-compose.yml`
- Modify: CI and verification scripts
- Modify: all documentation named in Task 10

- [ ] Prove all old worker services/pollers are disabled and no production route selects them.
- [ ] Prove no dependency remains on chapter analysis/API AI, web image generation,
  Vertex/browser legacy or retired providers.
- [ ] Prove backend/gpu-worker recovery from crash, lost callback, duplicate delivery, lease loss,
  expired artifact capability and `UNKNOWN` outcome.
- [ ] Remove legacy services, image, dependencies, environment variables, migrations-only runtime
  assumptions, tests and documentation references.
- [ ] Delete `app/ai-worker` only after the deletion manifest is reviewed and recoverable from Git.
- [ ] Run CodeGraph/`rg` dependency scans and the full local verification gate.

### Task 10: Synchronize architecture and implementation documentation

**Files:**
- Modify: `documentation/codebase/BACKEND_CODEBASE.md`
- Replace: `documentation/codebase/AI_WORKER_CODEBASE.md` with a GPU worker codebase document
- Modify: `documentation/architecture/DATA_FLOW.md`
- Modify: `documentation/architecture/SERVICE_BOUNDARIES.md`
- Modify: `documentation/architecture/TECHNOLOGY_STACK.md`
- Modify: `documentation/workflows/NARRATION_AUDIO.md`
- Modify: `documentation/workflows/IMAGE_GENERATION.md`
- Modify: `documentation/workflows/STORY_TO_VIDEO.md`
- Modify: `CONTRIBUTING.md`
- Modify: `README.md`

- [ ] Mark target/partial/implemented states accurately after every vertical slice.
- [ ] Replace direct-PostgreSQL worker diagrams and commands with control/execution-plane flow.
- [ ] Document executor/model registry operations, local/remote target configuration and artifact
  security without embedding credentials.
- [ ] Update contributor commands from `ai-worker` to `gpu-worker` only after cut-over.
- [ ] Run `python scripts/check-docs-drift.py`; it must pass.

### Task 11: Verify final acceptance criteria

- [ ] `app/` contains only `desktop`, `backend-service`, and `gpu-worker`.
- [ ] `gpu-worker` has no NarrativeX DB access, domain vocabulary, absolute-path contract or
  application orchestration.
- [ ] Backend owns every job/attempt/provider/outbox transition and all retry/recovery decisions.
- [ ] Local and remote targets pass the same Compute Protocol contract suite.
- [ ] Narration, image and validation flows pass success/failure/recovery tests with real adapters
  smoke-tested separately from deterministic CI.
- [ ] Full `pwsh -File scripts/verify-local.ps1` passes.
- [ ] Move this plan to `docs/plans/completed/` after every acceptance criterion is met.

## Cut-over gates

For each vertical slice, require: contract compatibility, deterministic parity, no domain data in
worker requests/logs, duplicate/replay safety, crash recovery, artifact integrity, operational
metrics, configuration rollback and a dependency scan proving the disabled legacy path has no
exclusive consumer. Rollback changes routing only; it never rolls back already committed domain
state or blindly repeats an ambiguous provider operation.

## Post-completion

- Validate rented-GPU network policy, mTLS/certificate rotation and artifact gateway reachability in
  the deployment environment.
- Run licensed production engines/models with approved assets and real-person consent controls.
- Benchmark RTX 4060 and remote GPU concurrency per executor before changing registry limits.
