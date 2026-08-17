# ADR-0002: PostgreSQL authoritative state and durable provider operations

- Status: Accepted
- Date: 2026-08-17
- Scope: v1.7 job, cost, and external-provider workflows

## Context

AI providers, TTS, object storage, and FFmpeg are asynchronous and can time out after accepting work. A transient queue or in-memory status cannot safely support retries, cost attribution, reconciliation, deletion, or user-visible progress.

## Decision

Persist business state, job/stage attempts, provider reservations/operations, cost reservations, usage records, and final-artifact validation state in PostgreSQL. Redis may accelerate queue delivery, caching, and progress fan-out but must be reconstructable. Persist a provider reservation before submission; ambiguous results use `UNKNOWN` and require reconciliation before retry.

## Consequences

- Retries are policy-driven and idempotent rather than blind.
- Finalization can verify required stages, MIME, dimensions, and storage integrity.
- Cost and safety decisions remain auditable after worker restarts.
- Schema migrations and recovery drills are release concerns, not optional infrastructure polish.
