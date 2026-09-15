# Compute Execution Plane Migration Plan

## Overview

Replace the domain-aware PostgreSQL-polling `app/ai-worker` with a Spring Boot control plane and the domain-agnostic `app/generation-service`. Preserve the backend's durable lifecycle guarantees while making local RTX 4060 and remote GPU targets interchangeable through one Compute Protocol.

This is a staged replacement. It is not a directory rename, a big-bang rewrite, or a permanent dual-write system.

## Current Repository Reality

- `app/generation-service` already exists with Hexagonal architecture (`application/ports`, `application/services`, `domain`, `adapters`), FastAPI transport, and SQLite execution journal.
- Compute Protocol v1 schemas and examples exist in `contracts/compute/v1/`.
- Backend already owns `GenerationJob`, `StageAttempt`, `NarrationOperation`, `ProviderOperation`, `OperationPlan`, non-monetary capacity reservations, and MyBatis persistence.
- `ProviderOperation` models `UNKNOWN` and reconciliation-safe transitions (ADR-0031).
- `app/ai-worker` continues direct PostgreSQL polling as a temporary legacy migration implementation.

## Chosen Approach

Use backend-push HTTP submission with callback observations plus backend reconciliation polling.
The backend persists intent before submission, translates domain data into closed task schemas, and maps results back into domain state. Generation-service responses are observations only. Artifact bytes use opaque, time-limited capabilities and SHA-256 checksums.

Testing approach: regular implementation with unit, contract and integration tests in every task.

## Target Topology

```text
Desktop -> backend-service (control plane: domain + lifecycle + routing + persistence)
                         |
                  Compute Protocol v1 (HTTP)
                         |
               +----------+----------+
               |                     |
   local generation-service    remote generation-service
               |                     |
        executor adapters      executor adapters
```

## Migration Invariants

- Backend is the only component that reads/writes NarrativeX business tables.
- No domain ID, DB credential, absolute path, open metadata bag or provider secret crosses the compute boundary.
- Reservation state is durable before external submission.
- Ambiguous submission becomes backend `UNKNOWN`; reconciliation precedes resubmission.
- Every attempt is immutable, fingerprinted and idempotently replayable.
- Fake executors are test-only and cannot report production readiness.
- No legacy deletion occurs until dependency scan, parity, recovery and rollback gates pass.

---

## Remaining Implementation Tasks

### Task 1: Backend compute control-plane persistence

- Implement compute task and attempt mapping in `backend-service`.
- Manage generation target registry (local loopback vs remote endpoint).
- Implement durable submission checkpoints and callback sequencing.
- Provide reconciliation worker for ambiguous task states.

### Task 2: Narration cutover

- Wire `VoiceStudio` and `WhisperX` executor adapters in `generation-service`.
- Implement backend narration segmentation and ComputeTask materialization.
- Transport audio artifacts via capability URLs and verify SHA-256 digests.
- Pass end-to-end recovery and parity tests for Vietnamese narration.

### Task 3: Image generation cutover

- Complete `ComfyUI` (RealVisXL) executor adapter in `generation-service`.
- Move image generation task materialization to backend use cases.
- Validate generated images against contract constraints.
- Materialize accepted image results into Desktop ProjectStorage.

### Task 4: Media validation cutover

- Migrate domain-neutral media validation tasks to `generation-service`.
- Ensure all media probe rules are verified without NarrativeX DB access.

### Task 5: Analysis ownership decision

- Maintain domain orchestration and scene planning in backend.
- Invoke model inference via closed compute task only when local GPU execution is required.

### Task 6: Local and remote target registry

- Validate identical service container image on both local RTX 4060 and remote cloud GPU instances.
- Verify mTLS or machine token authentication across targets.

### Task 7: Delete `app/ai-worker`

- Verify that zero backend paths or workflows poll PostgreSQL directly.
- Ensure all vertical slices pass parity and recovery gates.
- Remove `app/ai-worker` directory and clean up Compose definitions.

### Task 8: Cleanup legacy docs, configuration and tests

- Run repository-wide dependency scans.
- Remove retired test fixtures and legacy scripts.
