# Architecture Decision Records

This directory records decisions that affect more than one feature or change a production safety boundary. The maintained V1.10 source-of-truth specification remains the product/architecture authority; ADRs explain implementation choices and deliberate deviations.

## Canonical ADRs

- [ADR-0001: System topology and durable execution](./ADR-0001-system-topology-and-durable-execution.md)
- [ADR-0002: Chapter-first workflow and routes](./ADR-0002-chapter-first-workflow-and-routes.md)
- [ADR-0003: DDD feature boundaries and API contracts](./ADR-0003-ddd-feature-boundaries-and-api-contracts.md)
- [ADR-0004: Authentication and frontend runtime security](./ADR-0004-authentication-and-frontend-runtime-security.md)
- [ADR-0005: Reusable Character identity and ProjectCharacter assignment](./ADR-0005-reusable-character-identity-and-project-assignment.md)
- [ADR-0006: Consolidated Flyway PostgreSQL baseline](./ADR-0006-consolidated-flyway-baseline.md)
- [ADR-0007: Storyboard aggregate boundaries](./ADR-0007-storyboard-aggregate-boundaries.md)
- [ADR-0008: Redis-backed HTTP sessions](./ADR-0008-redis-backed-http-sessions.md)
- [ADR-0009: Separate VisualBeat motion mode and camera movement](./ADR-0009-visual-beat-motion-model.md)
- [ADR-0010: Durable provider operations and admission](./ADR-0010-durable-provider-operation-and-admission.md)
- [ADR-0014: SQL-first ProviderOperation persistence](./ADR-0014-provider-operation-mybatis-migration.md)
- [ADR-0015: Shared MyBatis persistence conventions](./ADR-0015-mybatis-persistence-conventions.md)
- [ADR-0016: Cloudflare R2 generated-image durability](./ADR-0016-cloudflare-r2-generated-image-durability.md)
- [ADR-0017: SQL-first Chapter persistence](./ADR-0017-chapter-mybatis-persistence.md)
- [ADR-0018: Full-chapter narration and alignment](./ADR-0018-full-chapter-narration-and-alignment.md)

The previous ADR records were consolidated into the canonical files above. Use a new sequential ADR for a new cross-cutting decision.
