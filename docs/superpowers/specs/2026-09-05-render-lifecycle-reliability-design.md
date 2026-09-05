# Render Lifecycle Reliability Design

## Goal

Fix the six reviewed render/idempotency defects without broadening scope into unrelated SSE or media-preparation optimization.

## Architecture

Desktop render delivery becomes a main-process-owned lifecycle rather than renderer-local React state. A destination selection authorizes and binds a destination to a render job; delivery can be retried without re-rendering and survives route unmount. Local execution additionally validates a session generation after asynchronous claim and keeps transient heartbeat failures on a retry loop. Backend media idempotency validates operation type, scope and request fingerprint before replay.

## Requirements

1. RenderScreen must allow choosing a destination and starting render without relying on synchronous React state propagation.
2. A failed artifact copy must not invalidate the destination authorization needed for a legitimate retry.
3. Route unmount must not be required for delivery to complete; main owns pending delivery state keyed by projectId/jobId.
4. Destination authorization must not expire merely because queue/render time exceeds one hour after selection.
5. Logout, unpair, account change or stop while claimProjectRender is pending must prevent the returned claim from starting provider/local render work.
6. Initial transient heartbeat failure must retry with bounded exponential backoff and jitter; auth rejection/logout/unpair stops retry.
7. CreateMediaJobUseCase must reject replay when an idempotency key belongs to another job type, project, chapter or request fingerprint.
8. Delivery must prevent concurrent copies for the same task and use a temporary destination file before final rename where possible.
9. Tests must exercise behavior across the main-process token/delivery boundary rather than relying only on source-regex assertions.

## Non-goals

- Replacing job-specific SSE polling with PostgreSQL LISTEN/NOTIFY.
- Deduplicating repeated asset checksum reads during render preparation.
- Refactoring unrelated renderer/editor architecture.

## Error handling

Delivery failures retain a retryable task with the last error and artifact intact. Session invalidation after a successful backend claim cancels/releases that claim through the existing cancellation/failure lease path and does not start preparation. Heartbeat transient failures move to OFFLINE while scheduling another attempt; authentication failures clear identity and stop retry.

## Testing

Desktop tests cover destination binding/retry, RenderScreen command behavior, route-independent task state, long-running destination authorization, logout-during-claim and initial-heartbeat reconnect. Backend tests cover cross-operation, cross-project/chapter and changed-request idempotency conflicts plus valid replay.