# Architecture Decision Records

This directory records decisions that affect more than one feature or change a production safety boundary. The maintained V1.10 source-of-truth specification remains the product/architecture authority; ADRs explain implementation choices and deliberate deviations.

## Canonical ADRs

- [ADR-0001: System topology and durable execution](./ADR-0001-system-topology-and-durable-execution.md)
- [ADR-0002: Chapter-first workflow and routes](./ADR-0002-chapter-first-workflow-and-routes.md)
- [ADR-0003: DDD feature boundaries and API contracts](./ADR-0003-ddd-feature-boundaries-and-api-contracts.md)
- [ADR-0004: Authentication, session persistence and runtime security](./ADR-0004-authentication-session-and-runtime-security.md)
- [ADR-0005: Reusable Character identity with ProjectCharacter assignments](./ADR-0005-reusable-character-identity-and-project-assignment.md)
- [ADR-0006: Two-file Flyway PostgreSQL baseline](./ADR-0006-consolidated-flyway-baseline.md)
- [ADR-0007: Storyboard aggregate boundaries and revision lifecycle](./ADR-0007-storyboard-aggregate-and-revision-lifecycle.md)
- [ADR-0008: Durable provider operations, result immutability and execution persistence](./ADR-0008-durable-provider-operations-and-execution-lifecycle.md)
- [ADR-0009: VisualBeat motion model, local I2V and production modes](./ADR-0009-visual-beat-motion-and-production-modes.md)
- [ADR-0010: SQL-first MyBatis persistence architecture and aggregate boundaries](./ADR-0010-sql-first-mybatis-persistence-architecture.md)
- [ADR-0011: Narration audio pipeline, multi-part alignment and worker concurrency](./ADR-0011-narration-pipeline-and-worker-runtime.md)
- [ADR-0012: Cloudflare R2 durable media storage](./ADR-0012-cloudflare-r2-durable-media-storage.md)
- [ADR-0013: Out-of-band E2E credentials and repository secret scanning](./ADR-0013-test-credential-handling-and-secret-scanning.md)
- [ADR-0014: Drop the deprecated expensive-jobs projection](./ADR-0014-drop-deprecated-expensive-jobs-projection.md)
- [ADR-0015: Generation durable persistence migration](./ADR-0015-generation-durable-persistence-migration.md)

The previous granular/transitional ADR records were consolidated into the canonical files above. Use a new sequential ADR (`ADR-0014+`) for any new cross-cutting architecture decisions.
