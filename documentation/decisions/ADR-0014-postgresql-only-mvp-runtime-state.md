# ADR-0014: PostgreSQL-only MVP runtime state

- Status: Partially superseded; PostgreSQL remains authoritative, while identity/session and direct worker-polling details below are historical MVP context.
- Date: 2026-08-26

## Context

NarrativeX treats PostgreSQL as the durable source of truth for generation jobs, stage attempts, provider operations, media state and event receipts. The current worker does not claim work directly from PostgreSQL; it uses the versioned Compute Protocol and a local SQLite journal/outbox under ADR-0025.

The historical MVP also carried Spring HTTP sessions, Desktop OAuth handoff codes and generation/media wake-up hints. ADR-0020 removed application identity/session state, and ADR-0025 replaced direct worker polling with signed callbacks plus scheduled reconciliation.

## Decision

For the current runtime, PostgreSQL is the single authoritative business-state service. It is not an application identity/session store, and the worker has no direct database access.

1. Project, job, attempt, lease, artifact and compute-event receipt state use PostgreSQL.
2. The worker records execution attempts and `compute_event_outbox` rows in SQLite, then delivers HMAC-signed callbacks with bounded retry/backoff.
3. Backend callback receipt/finalization is idempotent and monotonic; scheduled reconciliation is a non-blocking fallback for ambiguous outcomes.
4. Desktop receives project-scoped SSE snapshots and can recover through GET/watchdog queries.
5. No Redis, Kafka, RabbitMQ, Temporal, or other broker is introduced.

## Consequences

### Positive

- One fewer production/local service to deploy, monitor, secure, back up and diagnose.
- Business-state correctness remains easy to reason about: durable rows and finalization state live in PostgreSQL.
- Google/Gemini Chrome login remains provider/browser state, not NarrativeX authentication.
- Worker restart and callback loss are handled by the SQLite journal/outbox and reconciliation path.

### Trade-offs

- Event delivery is at-least-once and depends on idempotent receipts, monotonic sequence checks, and reconciliation after ambiguous outcomes.

## Revisit criteria

Introduce Redis, RabbitMQ, Kafka, SQS, PostgreSQL `LISTEN/NOTIFY` or another broker/cache/wake-up layer only when measurements show a concrete need such as unacceptable polling load/latency, high fan-out realtime delivery, distributed rate-limit/cache pressure or queue throughput that the current PostgreSQL design cannot meet economically. Any future broker remains non-authoritative unless a separate ADR deliberately changes the durable queue architecture.

## Superseded guidance

This ADR supersedes earlier documentation that described Redis as a required runtime dependency. Its session, OAuth-handoff, direct worker-polling and PostgreSQL-outbox details are historical MVP context. Current implementation guidance follows ADR-0020 and ADR-0025.
