# ADR-0008: Durable provider operations, result immutability and execution persistence

- Status: Accepted
- Date: 2026-08-19 (consolidated and updated: 2026-08-21)
- Scope: External AI provider execution boundary, compare-and-set state machine, completed result immutability, canonical execution persistence values, and quota reservation lifecycle.
- Consolidated from: former ADR-0010, ADR-0011 (results), and ADR-0012 (persistence contract).

## Context

NarrativeX interacts with expensive and asynchronous external AI providers (Google Vertex Gemini, TTS providers, local Wan video endpoints). Because network calls can time out or workers may crash mid-flight, memory state or simple message queues cannot serve as the authoritative truth of whether an external operation occurred or succeeded.

To ensure strict billing accuracy, eliminate duplicate charges, and enable deterministic crash recovery, every interaction with an external provider must cross an explicit durable admission boundary in PostgreSQL before execution.

## Decision

### 1. Provider Operation State Machine & Pre-Submit Fencing

- **Durable `provider_operations` Record:** Created with a unique key `(provider_key, request_fingerprint)` and initial status `RESERVED`.
- **Pre-Submit CAS Fence:** Before the worker invokes the external provider API, it performs an optimistic Compare-And-Set (CAS) transition to `UNKNOWN`.
- **State Graph:**
  - `RESERVED -> UNKNOWN`
  - `UNKNOWN -> SUBMITTED | RUNNING | COMPLETED | FAILED`
  - `SUBMITTED -> RUNNING | UNKNOWN | COMPLETED | FAILED`
  - `RUNNING -> UNKNOWN | COMPLETED | FAILED`
  - `COMPLETED` and `FAILED` are strictly terminal.
- **Optimistic Concurrency:** Every mutation requires matching the expected `row_version` and valid previous status. Conflicting updates result in a concurrency conflict rather than a provider failure.
- **Narration-specific reconciliation:** Narration `UNKNOWN` rows always receive a due time unless explicitly suspended for manual attention. Reconciliation metadata is updated with a row-version CAS and deterministic bounded backoff; a retry stage may reuse the logical operation by provider key and request fingerprint while retaining the original stage as audit provenance.

### 2. Completed Result Immutability & SHA-256 Fingerprint

- **Atomic Terminal Write:** When an external operation completes, the worker atomically writes `status = COMPLETED`, `completed_at`, `normalized_result_json`, and `result_fingerprint`.
- **Fingerprint Invariant:** `result_fingerprint` is a 64-character lowercase SHA-256 hex digest of the canonical normalized result.
- **Duplicate Completion Handling:**
  - Same fingerprint -> Idempotent success (no mutation to the row).
  - Different fingerprint -> Invariant violation; the first durable result remains authoritative and is never overwritten.
- **Crash Recovery & Materialization:** Domain materialization occurs only *after* the `COMPLETED` transaction commits. If the worker crashes after provider completion, recovery reads the normalized result directly from PostgreSQL and replays materialization without invoking the external provider again.

### 3. Canonical Execution Persistence Values

- Validated via PostgreSQL `TEXT/VARCHAR` + `CHECK` constraints in the consolidated `V1__initial_schema.sql`:
  - **Job Types:** `STORY_ANALYZE`, `CHAPTER_ANALYZE`, `IMAGE_GENERATE`, `CHAPTER_GENERATE`, `CHAPTER_RENDER`, `PROJECT_CONTINUE`, `VISUAL_BEAT_PLAN`, `SHOT_IMAGE_GENERATE`, `RENDER_PROJECT`, `RENDER_SHORT`.
  - **Resource Classes:** `PROVIDER_INTERACTIVE`, `PROVIDER_BATCH`, `GPU_HEAVY`, `CPU_RENDER`, `CPU_LIGHT`, `BACKGROUND`, `NOTIFICATION`, `FAST_CPU`, `CPU_HEAVY`, `MEDIA_IO`.
  - **Job & Stage Statuses:** `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELED`, `UNKNOWN`, `STALLED`, `PAUSED_COST_LIMIT`.
  - **Provider Operation Statuses:** `RESERVED`, `UNKNOWN`, `SUBMITTED`, `RUNNING`, `COMPLETED`, `FAILED`.

### 4. Quota Reservation Lifecycle & Billing Evidence

- **Atomic Admission:** Admission enqueues an `OperationPlan`, `GenerationJob`, `StageAttempt`, and inserts a `quota_reservations` row with `RESERVED` status and `estimated_cost`.
- **Active Capacity Authority:** Concurrent expensive jobs are counted as active `RESERVED` rows in `quota_reservations`, independent of calendar-month resets.
- **Durable Billing Metadata:** When an operation completes, immutable provider usage, pricing catalog snapshots, currency, and calculated `actual_cost` are persisted.
- **Automated Settlement Trigger:** A PostgreSQL trigger runs on `generation_jobs` status updates:
  - `COMPLETED` -> Settles reservation using total durable `actual_cost`.
  - `FAILED` / `CANCELED` with positive incurred cost -> Settles the incurred amount.
  - `FAILED` / `CANCELED` with zero cost -> Releases the reservation.

### 5. Durable Generation Persistence & MyBatis Adapters

- Generation execution persistence boundaries use dedicated MyBatis row models and explicit XML mappers: `StageAttempt`, `OperationPlan`, `GenerationOutbox`, `JobHistory`, and `MediaPlan`. Chapter analysis has no application-owned pre-moderation persistence gate.
- `OperationPlan` updates use an explicit `row_version` compare-and-set and translate zero affected rows into not-found or optimistic-lock conflicts.
- `GenerationOutbox` enqueue remains idempotent on `event_key`; the durable insert is decoupled from the dispatcher lease query.
- Architecture tests reject direct JPA/JdbcTemplate imports in these durable generation adapters.

## Invariants

1. `ProviderOperation.status = COMPLETED` strictly requires non-null `normalized_result_json` and matching `result_fingerprint`.
2. First completion wins; completed results are immutable.
3. Ambiguous outcomes (`UNKNOWN`) trigger reconciliation, never blind automatic re-submissions.
4. Quota transitions out of `RESERVED` at most once via database triggers.
5. All execution types and statuses conform to the canonical SQL CHECK constraints.
6. After the external-call fence, transient storage/database failures remain recoverable and never
   trigger blind provider resubmission.

## Consequences

- No duplicate provider charges on worker retries, timeouts, or restarts.
- Financial accounting and billing audit trails are fully reproducible from immutable pricing snapshots.
- Replay and reconciliation logic is completely deterministic.
