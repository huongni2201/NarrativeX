# ADR-0025: Event-Driven Compute Orchestration, Worker Callback Outbox, and Scheduled State Reconciliation

## Status

Accepted

## Context

NarrativeX orchestrates compute generation workloads (chapter analysis via Vertex Gemini, visual generation via ComfyUI, narration via VieNeu/WhisperX).

Previously:
1. **Blocking Polling Orchestration**: The backend used synchronous blocking loops (`while (true) { sleeper.sleep(pollInterval); }` in `ComputeObservationReconciler`) while waiting for GPU workers, tying up worker and HTTP threads.
2. **Transaction Scope Bleed**: External AI calls and GPU submissions risked holding database connections across unpredictable network latencies.
3. **Frontend Polling Overhead**: The Electron desktop client constantly polled `/api/v1/...` every 3000ms to detect job status and workspace changes.
4. **Resilience Gaps**: If callbacks were interrupted or workers restarted, there was no guaranteed durable outbox or scheduled non-blocking reconciliation fallback to recover in-flight tasks without blind resubmission.

In accordance with ADR-0014 (PostgreSQL-only runtime authority) and ADR-0018 (backend control plane / domain-agnostic GPU plane), the architecture must remain free of heavy external message brokers (Kafka, RabbitMQ, Redis, Temporal) while achieving event-driven responsiveness and monotonic consistency.

## Decision

Implement an event-driven, durable state reconciliation architecture across `app/backend-service`, `app/generation-service`, and `app/desktop`:

### 1. Durable Job State Machine (`domain/service/GenerationJobStateMachine.java`)

Introduce explicit async lifecycle states in `GenerationJob`:
- `QUEUED` $\rightarrow$ `SUBMITTING` $\rightarrow$ `SUBMITTED` $\rightarrow$ `RUNNING` $\rightarrow$ `COMPLETED` / `FAILED` / `CANCELED`.
- Fallback states: `UNKNOWN` (unconfirmed remote state) and `RECONCILING` (scheduled probe in progress).
- **Invariants**:
  - Terminal states (`COMPLETED`, `FAILED`, `CANCELED`) are strictly immutable and must never regress.
  - Monotonic sequence checks reject stale out-of-order events.

### 2. Short, Fine-Grained Transaction Boundaries (`GenerationJobTransactionService.java`)

All external I/O (Vertex Gemini API calls, GPU worker HTTP dispatch) executes strictly **outside** `@Transactional` boundaries:
1. Short transaction 1: Atomically claim job and commit `SUBMITTING` intent.
2. External I/O: Submit payload to worker or provider.
3. Short transaction 2: Atomically commit `SUBMITTED` with `compute_attempt_id`, `compute_execution_handle`, sequence, and initial `next_reconcile_at`.
4. If submission fails ambiguously: Commit `UNKNOWN` and schedule reconciliation.

### 3. Worker Durable Event Outbox (`sqlite_execution_journal.py` & `outbox_delivery_service.py`)

In `app/generation-service`:
- A local SQLite table `compute_event_outbox` durably records every state transition and observation within the same atomic transaction that updates attempt state.
- `OutboxDeliveryService` asynchronously drains pending outbox items and publishes them to the backend callback endpoint using exponential backoff (1s, 2s, 5s, 10s, 30s, 60s, 120s, 300s).
- **Safety guarantee**: A failure to deliver an outbox callback to the backend NEVER mutates or invalidates a successful compute attempt (`SUCCEEDED`) in the worker journal.

### 4. Signed Worker Callback Ingestion & Unified Finalization

- Endpoint: `POST /internal/compute/events` (and `/internal/v1/compute-events`).
- Authentication: HMAC-SHA256 signature calculated over `${timestamp}.${rawBody}` verified against `X-NarrativeX-Compute-Signature` with a 5-minute replay skew limit.
- Idempotency: Incoming event IDs are recorded in `compute_event_receipts`. Duplicate deliveries are acknowledged immediately without reprocessing.
- Unified Finalization (`ComputeResultFinalizer`): Both callbacks and scheduled reconciliation delegate completion to the same `ComputeResultFinalizer` implementations (`ImageGenerationResultFinalizer`, `NarrationGenerationResultFinalizer`) to verify output artifacts and persist `MediaAsset` records.

### 5. Scheduled Non-Blocking Reconciliation Fallback (`ComputeReconciliationService.java`)

- Replaces `ComputeObservationReconciler` blocking loops.
- `ComputeReconciliationScheduler` runs `@Scheduled(fixedDelay = 5000)` querying jobs due for reconciliation (`status IN ('SUBMITTED', 'RUNNING', 'UNKNOWN', 'RECONCILING') AND next_reconcile_at <= now()`).
- `ComputeReconciliationService.reconcileOnce(jobId)` performs exactly **one** non-blocking remote query against the worker.
- Backoff schedule (`ReconciliationBackoffPolicy`): 2s $\rightarrow$ 5s $\rightarrow$ 10s $\rightarrow$ 30s $\rightarrow$ 60s $\rightarrow$ max 300s.

### 6. Realtime Server-Sent Events (SSE) to Desktop (`ProjectGenerationEventController.java`)

- Backend endpoint: `GET /api/v1/projects/{projectId}/generation/events`.
- In-memory broadcaster (`SseGenerationJobEventBroadcaster`) delivers typed events (`job.updated`, `job.completed`, `job.failed`).
- Desktop renderer connects via `useProjectGenerationEvents` in `WorkspaceShell`, invalidating TanStack Query caches (`generation`, `chapters`, `timeline`, `storyboards`) in real-time.
- Fallback polling is backed off from 3000ms to 30s while SSE connection is active.

## Consequences

### Positive
- **No Blocking Threads**: Worker threads and backend request threads are freed immediately after submitting tasks.
- **Zero Lock Contention**: Database transactions are bounded to sub-millisecond single-row updates.
- **Durable Zero-Loss Guarantee**: SQLite outbox on the worker guarantees event delivery even if the backend is temporarily restarting.
- **Automatic Fallback Recovery**: Any dropped or delayed callback is reconciled by the scheduled non-blocking reconciler.
- **Zero Additional Infrastructure**: Pure PostgreSQL + SQLite implementation with no Kafka, RabbitMQ, Redis, or Temporal required.

### Negative / Trade-offs
- Requires managing HMAC shared secrets (`narrativex.compute.worker.shared-secret`) across backend and generation service environments.
- SQLite outbox requires periodic vacuuming or cleanup of delivered events over time.
