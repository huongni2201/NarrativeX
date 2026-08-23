# Architecture Decision Records

This directory records decisions that affect more than one feature or change a production safety boundary. The maintained V1.11 source-of-truth specification remains the product/architecture authority; ADRs explain implementation choices and deliberate deviations.

## Consolidated Architecture Decision Records

Architectural decisions across NarrativeX are maintained in the following canonical records:

1. **[ADR-0001: System topology, modular monolith, durable execution and persistence architecture](./ADR-0001-system-topology-execution-and-persistence.md)**
   - *Scope:* Spring Boot modular monolith, Python 3.12 AI worker boundary, DDD vertical package slices, SQL-first MyBatis persistence, Flyway PostgreSQL baseline V1, pre-submit fencing (`UNKNOWN`), result immutability, and quota reservation lifecycle.
   - *Consolidates:* Former ADR-0001, ADR-0003, ADR-0006, ADR-0008, and ADR-0010.

2. **[ADR-0002: Storyboard aggregate, character continuity, motion models and production workflows](./ADR-0002-storyboard-character-continuity-and-production-workflows.md)**
   - *Scope:* Chapter-first workflow & route hierarchy, reusable `Character` identity with `ProjectCharacter` assignments, `StoryboardRevision` non-destructive re-analysis lifecycle, `VisualBeat` decoupled motion modes (`IMAGE_MOTION`, `HYBRID_LOCAL_I2V`), and immutable `chapter_content_variants` with translation lineage.
   - *Consolidates:* Former ADR-0002, ADR-0005, ADR-0007, ADR-0009, and ADR-0014.

3. **[ADR-0003: Media storage, generation pipelines and external provider integrations](./ADR-0003-media-storage-generation-pipelines-and-external-integrations.md)**
   - *Scope:* Two-tier storage architecture (Cloudflare R2 for pipeline media + Google Drive for final rendered MP4 exports), client presigned upload intents with tokened validation leases, narration audio pipeline with multi-part continuous clock & VieNeu local voice cloning, and Vertex Gemini 2.5 Flash image batch inference with GCS staging.
   - *Consolidates:* Former ADR-0011, ADR-0012, ADR-0015, and ADR-0016.

4. **[ADR-0004: Authentication, runtime security and test credentials](./ADR-0004-authentication-runtime-security-and-test-credentials.md)**
   - *Scope:* Internal user identity in PostgreSQL, Spring Security server-managed session persistence (`NX_SESSION`) in Redis, CSRF protection, Google OIDC safe linking, Redis fail-open rate limiting, out-of-band E2E test credentials (`E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`), and automated CI secret scanning.
   - *Consolidates:* Former ADR-0004 and ADR-0013.

5. **[ADR-0018: Transactional chapter creation owns StoryVersion orchestration](./ADR-0018-transactional-chapter-creation.md)**
   - *Scope:* Backend-owned StoryVersion/Chapter orchestration, PostgreSQL idempotency for chapter creation, server-derived ordering, and batch-import transaction boundaries.

6. **[ADR-0019: Architecture guards and pipeline observability](./ADR-0019-architecture-guards-and-pipeline-observability.md)**
   - *Scope:* ArchUnit dependency boundaries, stable worker repository facades, cross-stage pipeline metrics, correlation fields, and final-artifact streaming counters.

7. **[ADR-0020: Production-profile Docker runtime for real machine-local execution](./ADR-0020-real-docker-runtime.md)**
   - *Scope:* Production provider/storage semantics inside Docker on a developer-owned machine, with fake/local adapters restricted to tests and Storybook.

---

Use the next sequential ADR number for future cross-cutting architectural decisions.
