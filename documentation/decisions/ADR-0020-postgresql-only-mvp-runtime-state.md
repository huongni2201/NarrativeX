# ADR-0020: PostgreSQL-only MVP runtime state

- Status: Accepted
- Date: 2026-08-26

## Context

NarrativeX already treats PostgreSQL as the durable source of truth for generation jobs, stage attempts, provider operations, media state and transactional outbox events. Python workers claim work directly from PostgreSQL using durable locking/lease semantics; Redis delivery was only a non-authoritative hint.

Redis nevertheless remained a runtime dependency for Spring HTTP sessions, 90-second Desktop OAuth handoff codes and generation/media wake-up hints. This added a second state service without strengthening generation correctness.

## Decision

For the MVP runtime, PostgreSQL is the single application state service.

1. Spring HTTP sessions use Spring Session JDBC and PostgreSQL.
2. Desktop OAuth handoff codes are stored in `desktop_auth_handoffs`. Only a SHA-256 hash of the random code is persisted. Rows expire after 90 seconds and are atomically consumed with PostgreSQL `DELETE ... RETURNING`; a failed PKCE verifier still consumes the handoff.
3. Generation/media outbox rows remain durable PostgreSQL transactional evidence.
4. Python workers discover and claim durable work directly from PostgreSQL using polling, row locking and lease semantics. There is no Redis, broker, `LISTEN`, or `NOTIFY` dependency in the MVP queue path.
5. The generation outbox dispatcher only finalizes committed generation/media-validation outbox rows. A failed acknowledgement leaves the row `PENDING`; reservation expiry makes it claimable again without a separate retry timer.
6. Redis is removed from backend dependencies, runtime configuration, Compose services and MVP operational requirements.

## Consequences

### Positive

- One fewer production/local service to deploy, monitor, secure, back up and diagnose.
- No cross-store consistency question for session/handoff/job state.
- Google Desktop login and sessions survive backend process restarts as long as PostgreSQL is available.
- Queue correctness is easy to reason about: durable rows and claim state live in one database.
- No unused notification publisher/channel/listener abstraction remains in the MVP runtime.

### Trade-offs

- PostgreSQL carries session and short-lived handoff traffic in addition to business state. This is acceptable for MVP load and should be measured before introducing a separate cache/session store.
- Idle workers may notice new work up to `POLL_INTERVAL_SECONDS` later than an event-driven listener would. The default one-second interval is acceptable for current asynchronous AI/media workloads.
- If polling load becomes material at scale, measure it before adding a broker/listener.

## Revisit criteria

Introduce Redis, RabbitMQ, Kafka, SQS, PostgreSQL `LISTEN/NOTIFY` or another broker/cache/wake-up layer only when measurements show a concrete need such as unacceptable polling load/latency, high fan-out realtime delivery, distributed rate-limit/cache pressure or queue throughput that the current PostgreSQL design cannot meet economically. Any future broker remains non-authoritative unless a separate ADR deliberately changes the durable queue architecture.

## Superseded guidance

This ADR supersedes earlier documentation that described Redis as a required runtime dependency for sessions, transient auth state or generation delivery hints. It also supersedes the short-lived intermediate implementation of PostgreSQL `NOTIFY` wake-up hints on PR #296. Historical ADRs remain historical records; current implementation guidance follows this decision.
