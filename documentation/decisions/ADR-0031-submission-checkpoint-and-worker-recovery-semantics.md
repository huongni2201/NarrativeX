# ADR-0031: Durable submission checkpointing and safe worker recovery semantics

## Status

Accepted

## Context

`app/generation-service` operates as the domain-agnostic compute execution plane. It receives versioned `ComputeTask` requests from the backend control plane and delegates execution to external GPU engines (ComfyUI, VoiceStudio, WhisperX).

Previously:
1. When a worker process restarted, attempts recorded as `RUNNING` without a persisted handle were rescheduled for fresh execution, leading to blind resubmission and duplicate GPU workloads.
2. Network timeouts or lost acknowledgements during engine dispatch were caught by generic exception handlers and marked as terminal `FAILED`, even when the external engine might still be actively computing the result.
3. The worker lacked an explicit, durable record of intent commit prior to initiating external I/O.

In accordance with ADR-0028, the backend control plane owns job orchestration, retry policies, and `ProviderOperation.UNKNOWN` reconciliation. The worker must not blind-resubmit ambiguous tasks, nor may it silently fabricate failure or cancellation states that improperly release backend retry paths.

## Decision

Implement durable submission checkpointing and conservative recovery inside `app/generation-service`:

### 1. Internal Submission Checkpoints (`domain/submission.py`)

Separate internal submission checkpoints from wire `ExecutionState`:

| Checkpoint | Semantic Meaning | Recovery Behavior |
|---|---|---|
| `NOT_SUBMITTED` | Task accepted; external submission not yet initiated | May dispatch if deadline and cancellation checks permit |
| `SUBMITTING` | Submission intent committed to journal; external I/O initiated or outcome in-flight | Never blind-resubmit; reconcile if supported, otherwise mark `UNKNOWN` |
| `SUBMITTED` | Engine handle/identifier acknowledged and persisted | Resume/poll existing handle; never issue a second submit |
| `UNKNOWN` | Ambiguous outcome (timeout, disconnect, unconfirmed crash window) | Never blind-resubmit; wait for provider status or backend reconciliation |

### 2. Journal-Before-I/O Flow

- Before initiating external engine calls, the worker must persist `SUBMITTING` in the SQLite execution journal.
- Once the external engine acknowledges submission with an execution identifier, the worker atomically persists `SUBMITTED` and the opaque `execution_handle`.
- All journal writes occur in transactions before downstream operations.

### 3. Recovery Invariants

On worker startup or attempt recovery:
1. **Deadline Check**: If `constraints.deadline` has elapsed, immediately transition to `FAILED` with code `DEADLINE_EXCEEDED` and category `PERMANENT`.
2. **Cancellation Check**: If `cancel_requested` is set, transition to `CANCELED`.
3. **Checkpoint Evaluation**:
   - `NOT_SUBMITTED`: Resume execution pipeline.
   - `SUBMITTED`: Pass `existing_execution_handle` to executor to resume polling without resubmitting.
   - `SUBMITTING` / `UNKNOWN`: If the executor adapter supports verifiable lookup/deduplication (e.g., querying ComfyUI history by deterministic prompt/client ID), reconcile. If reconciliation cannot prove non-execution, maintain `UNKNOWN` without creating new external work.

### 4. Database Migration & Backward Compatibility

The SQLite journal table `execution_attempts` is updated with additive columns:
- `submission_state TEXT NOT NULL DEFAULT 'NOT_SUBMITTED'`
- `correlation_key TEXT` (formatted as `<task_id>:<attempt_id>`)

Migration of existing records:
- `ACCEPTED` $\rightarrow$ `NOT_SUBMITTED`
- `RUNNING` with non-null `execution_handle` $\rightarrow$ `SUBMITTED`
- `RUNNING` with null `execution_handle` $\rightarrow$ `UNKNOWN` (conservative safety)

### 5. Wire Protocol Compatibility

Compute Protocol v1 wire states remain `ACCEPTED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELED`. Internal submission checkpoints remain execution-local. Ambiguous outcomes report current sequenced observations during reconciliation or transient failure with detailed error categories without altering protocol wire specifications.

## Consequences

- Prevents duplicate rendering, double audio generation, and resource contention on external GPU engines.
- Clarifies boundaries: the worker manages local durability; the backend control plane manages retry decisions across workers.
- Additive journal schema allows zero-loss upgrades.
