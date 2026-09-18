# ADR-0009: Bounded image-provider retries and circuit breaking

## Status

Accepted

## Context

Image generation crosses a paid external provider boundary and uses asynchronous provider
operations. A transport error or an ambiguous response must not trigger a blind resubmission, but
an operation that remains unknown forever can hot-loop reconciliation and leave the user-facing
generation job stuck indefinitely.

## Decision

The image worker uses an in-process circuit breaker for new provider submissions. After
`IMAGE_CIRCUIT_BREAKER_FAILURE_THRESHOLD` consecutive provider failures, the circuit blocks new
paid submissions for `IMAGE_CIRCUIT_BREAKER_OPEN_SECONDS` and permits one later probe.

Durable image provider operations count every unknown reconciliation transition in
`provider_operations.reconcile_attempts`. Once `IMAGE_RECONCILE_MAX_ATTEMPTS` is reached, the
operation and linked generation items are marked `FAILED`, and normal job aggregation stops
further retries.

The circuit breaker does not make an ambiguous external operation safe to delete. The application
retry is canceled, while an operation with a provider operation ID remains auditable in PostgreSQL.
Provider-specific cancellation can be added separately when the provider adapter supports a
reliable cancel contract.

## Consequences

- A temporary provider outage no longer creates unlimited paid submissions or reconciliation work.
- A generation job fails deterministically after bounded recovery attempts and can be retried by the
  user as a new explicit request.
- Circuit state is process-local and resets when the worker restarts; durable retry bounds remain in
  PostgreSQL.
