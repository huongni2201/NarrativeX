# Architecture Decision Records

This directory records decisions that affect more than one feature or change a production safety boundary. The v1.7 source specification remains the product authority; ADRs explain implementation choices and deliberate deviations.

## Index

- [ADR-0001: Modular monolith and separated AI/media worker](./ADR-0001-modular-monolith-and-worker.md)
- [ADR-0002: PostgreSQL authoritative state and durable provider operations](./ADR-0002-durable-state-and-provider-operations.md)
- [ADR-0003: v1.7 control plane and chapter-first continuation](./ADR-0003-v17-control-plane-and-chapter-continuation.md)
- [ADR-0004: DDD aggregates and persistence adapters](./ADR-0004-ddd-aggregates-and-persistence-adapters.md)
- [ADR-0005: Reusable Character identity and ProjectCharacter assignment](./ADR-0005-reusable-character-identity-and-project-assignment.md)
- [ADR-0006: Chapter-first storyboard routes](./ADR-0006-chapter-first-storyboard-routes.md)
- [ADR-0007: Fail-closed OIDC profiles and browser CSRF protection](./ADR-0007-fail-closed-oidc-and-browser-csrf.md)
- [ADR-0008: Runtime API mode and fixture isolation](./ADR-0008-runtime-api-mode-and-fixture-isolation.md)
- [ADR-0009: Unified JSON API envelope and error contract](./ADR-0009-api-envelope-and-error-contract.md)
- [ADR-0010: Application command/query boundaries and auth module isolation](./ADR-0010-application-boundaries-and-auth-module.md)
- [ADR-0011: Module package and aggregate boundaries](./ADR-0011-module-package-and-aggregate-boundaries.md)
- [ADR-0012: Feature boundaries and keyset pagination](./ADR-0012-feature-boundaries-and-keyset-pagination.md)

Use a new sequential ADR for a new cross-cutting decision. Do not delete or rewrite historical decisions merely because a newer ADR supersedes part of them.
