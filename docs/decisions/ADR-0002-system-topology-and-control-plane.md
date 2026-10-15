# ADR-0002: System topology — Spring control plane, PostgreSQL authority, domain-agnostic compute plane

- **Status:** Accepted
- **Date:** 2026-10-15 (consolidated)
- **Replaces:** former ADR-0018 (topology part), ADR-0040 and the older topology, PostgreSQL-only, generation-service structure and public-ID decisions (Git history)

## Context

A former Python worker polled NarrativeX PostgreSQL and mixed domain orchestration, job claiming, materialization and provider integration. Business ownership was split across two runtimes, and moving GPU work from a local machine to a rented one was a business-code change. That worker has been removed. This ADR records the topology that replaced it.

## Decision

### Runtimes

| Runtime | Owns |
|---|---|
| `app/desktop` (Electron) | Editor UI, local project media, native capabilities, agy CLI analysis execution, final FFmpeg render (ADR-0004, ADR-0005, ADR-0009) |
| `app/backend-service` (Spring Boot modular monolith) | Domain interpretation, admission, job/operation lifecycle, compute routing, target registry, retry/recovery, idempotency, capacity policy, event receipt and finalization, artifact metadata |
| PostgreSQL | The only durable application-state store; no Redis, broker or second business database |
| `app/generation-service` (Python/FastAPI) | Domain-agnostic execution of closed Compute Protocol v1 tasks |

1. Spring Boot is the only control plane. Feature modules stay inside one deployable. Adding a broker, cache or business microservice requires measured need and a new ADR.
2. `generation-service` implements [Compute Protocol v1](../architecture/compute-protocol.md). It never connects to PostgreSQL, never receives NarrativeX domain identifiers and never reads project files. The backend compiles domain state into typed `ComputeTask` requests and turns verified `ComputeResult` observations into domain transitions.
3. Local and remote workers run the same protocol and implementation. A target registry selects endpoint, credential, capabilities and weight. Engines (LTX, VieNeu, WhisperX, ComfyUI, media validation) are executor adapters behind worker ports. Provider SDKs never enter backend domain modules.
4. Artifacts cross the boundary only as integrity-checked, time-bounded, single-object `ArtifactRef` capabilities. Absolute or Windows paths, database credentials and project-relative storage knowledge never cross it.
5. Inside the worker: wire contracts own models and fingerprints, the worker domain owns only attempt identity, sequencing and terminal rules, and adapters (HTTP, executors, SQLite, artifact transport) are chosen at one composition root.

### Persistence baseline policy (pre-production)

6. Until the first production release, the Flyway baseline is a squashed development contract (currently V1–V7). V1–V4 hold domain tables, V5 functions and triggers, V6 all indexes, V7 deterministic seeds. A schema change is folded into its owning file. No patch migration alters or drops schema created earlier in the same baseline.
7. Unused columns, tables and contracts are removed from the baseline instead of kept "just in case". The list of removed items lives in [database.md](../architecture/database.md), not in an ADR.
8. Editing the baseline never upgrades an installed database. Each installation needs an audit of its applied Flyway history, and a reset is allowed only when its data is explicitly confirmed disposable.
9. At the first production release the baseline freezes. Every later change is an append-only forward migration (V8 onward).

### Identifiers

10. Public and domain aggregate IDs use UUIDv7. Internal operational IDs may stay numeric when they are neither public resources nor cross-device identities.

## Invariants

1. Business truth lives in PostgreSQL, written only by Spring Boot.
2. The worker has no business-database access, no project-file access and no domain orchestration.
3. Compute payloads are closed task-specific schemas with no free-form metadata or domain IDs.
4. Architecture tests enforce framework-free domain layers, feature isolation, separation of API and infrastructure, and adapter boundaries.

## Consequences

- Business lifecycle has one owner and one transactional boundary. Moving compute between local and remote targets is a deployment choice.
- The backend carries dispatch, callback, reconciliation and artifact-gateway infrastructure, and the worker carries a small durable journal (ADR-0003).
- Capability-based artifact transport needs expiry refresh and checksum handling.

## Related

- [ADR-0003](ADR-0003-durable-compute-execution.md) · [Compute Protocol](../architecture/compute-protocol.md) · [Database](../architecture/database.md) · [System architecture](../architecture/system-architecture.md)
