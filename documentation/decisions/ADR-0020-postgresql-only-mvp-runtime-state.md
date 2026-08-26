# ADR-0020: PostgreSQL-only MVP runtime state

- Status: Accepted
- Date: 2026-08-26

## Context

NarrativeX already treats PostgreSQL as the durable source of truth for generation jobs, stage attempts, provider operations, media state and transactional outbox events. Python workers claim work directly from PostgreSQL using durable locking/lease semantics; Redis delivery was only a non-authoritative hint.

Redis nevertheless remained a runtime dependency for three narrow concerns: Spring HTTP sessions, 90-second Desktop OAuth handoff codes and generation/media wake-up hints. This added a second state service to local and production Compose without making generation correctness stronger. A Redis outage could also break login/session behavior even though the primary database remained healthy.

## Decision

For the MVP runtime, PostgreSQL is the single application state service.

1. Spring HTTP sessions use Spring Session JDBC and PostgreSQL.
2. Desktop OAuth handoff codes are stored in `desktop_auth_handoffs`. Only a SHA-256 hash of the random code is persisted. Rows expire after 90 seconds and are atomically consumed with PostgreSQL `DELETE ... RETURNING`; a failed PKCE verifier still consumes the handoff.
3. Generation/media outbox rows remain durable PostgreSQL state.
4. Best-effort queue wake-up signals use PostgreSQL `pg_notify`. `NOTIFY` is explicitly lossy and non-authoritative.
5. Python workers continue to discover and claim durable work directly from PostgreSQL. Polling remains the correctness fallback even when notifications are missed or not consumed.
6. Redis is removed from backend dependencies, runtime configuration, Compose services and MVP operational requirements.
7. Notification dispatch is batched by PostgreSQL channel, so one outbox reservation batch emits at most one wake-up notification per channel rather than one connection/notification per event.

## Consequences

### Positive

- One fewer production/local service to deploy, monitor, secure, back up and diagnose.
- No cross-store consistency question for session/handoff/job state.
- Google Desktop login and sessions survive backend process restarts as long as PostgreSQL is available.
- Queue correctness is easier to reason about: durable rows and claim state live in one database.
- Wake-up hints do not serialize full outbox JSON payloads and are coalesced by channel.

### Trade-offs

- PostgreSQL now carries session and short-lived handoff traffic in addition to business state. This is acceptable for MVP load and should be measured before introducing a separate cache/session store.
- `NOTIFY` is not a durable queue and must never be treated as one.
- Until workers adopt an optional shared `LISTEN` wait primitive, their existing polling interval remains the mechanism that notices newly queued work. This does not affect correctness.

## Revisit criteria

Introduce Redis, RabbitMQ, Kafka, SQS or another broker/cache only when measurements show a concrete need such as unacceptable database polling/load, high fan-out realtime delivery, distributed rate-limit/cache pressure or queue throughput that the PostgreSQL design cannot meet economically. Any future broker remains non-authoritative unless a separate ADR deliberately changes the durable queue architecture.

## Superseded guidance

This ADR supersedes earlier documentation that described Redis as a required runtime dependency for sessions, transient auth state or generation delivery hints. Historical ADRs remain historical records; current implementation guidance follows this decision.
