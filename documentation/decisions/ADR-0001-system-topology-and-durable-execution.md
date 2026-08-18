# ADR-0001: System topology and durable execution

- Status: Accepted
- Date: 2026-08-18
- Scope: application topology, worker boundary, durable state and external-provider execution
- Consolidated from the former topology and durable-provider decisions.

## Context

NarrativeX combines transaction-heavy project/story/character state with Python AI/media workloads that have different runtime, provider and scaling needs. External providers and media processing are asynchronous and may time out after accepting work, so queue messages or in-memory status cannot be the business authority.

## Decision

- Use a Spring Boot modular monolith as the application and authorization authority, plus a separately deployed Python 3.12 AI/media worker as the technical execution boundary.
- Keep provider SDKs, GPU/model libraries, TTS and FFmpeg behind capability-oriented ports/adapters. Add another service only after a measured bottleneck, independent ownership/deployment need or hard runtime/security boundary is documented.
- PostgreSQL is authoritative for business state, ownership, jobs, stages, provider operations, cost, safety, notifications and audit. Redis may accelerate delivery, cache and progress, but all required work must be reconstructable after Redis loss.
- Object storage owns binary media; PostgreSQL stores keys, checksums, MIME, dimensions, duration, manifests and lifecycle state. Final artifacts become ready only after immutable-object validation.
- Before an external submission, persist the operation reservation, idempotency/fingerprint and stage attempt. An ambiguous outcome becomes `UNKNOWN` and must reconcile before resubmission.
- Expensive work requires authorization, affected-scope planning, estimate/reservation, entitlement and abuse checks, usage attribution and a spending cap before billable execution.

## Consequences

- Domain transactions and ownership checks remain local and explicit.
- Worker scaling and GPU/CPU resource classes can evolve independently without moving canonical authority out of PostgreSQL.
- Retries preserve prior evidence and are policy-driven rather than blind.
- Cross-runtime contracts must be versioned, tested and unable to bypass ownership, entitlement, safety or reconciliation rules.

## Consolidation note

This file is the canonical replacement for the former modular-monolith/worker and durable-provider records.
