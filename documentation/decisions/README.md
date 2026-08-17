# Architecture Decision Records

This directory records decisions that affect more than one module or change a production safety boundary. Each ADR states the context, decision, consequences, and follow-up work. The v1.7 source specification remains the product authority; ADRs explain implementation choices and deliberate deviations.

## Index

- [ADR-0001: Modular monolith and separated AI/media worker](./ADR-0001-modular-monolith-and-worker.md)
- [ADR-0002: PostgreSQL authoritative state and durable provider operations](./ADR-0002-durable-state-and-provider-operations.md)
- [ADR-0003: v1.7 control plane and chapter-first continuation](./ADR-0003-v17-control-plane-and-chapter-continuation.md)
- [ADR-0004: DDD aggregates and persistence adapters](./ADR-0004-ddd-aggregates-and-persistence-adapters.md)

Use a new sequential ADR for a new cross-cutting decision. Do not rewrite a historical decision; supersede it with a new ADR.
