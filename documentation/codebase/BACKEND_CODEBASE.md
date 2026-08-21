# NarrativeX Backend Codebase

## Runtime

- Entry point: `com.narrativex.backend.NarrativeXBackendApplication`.
- Build: Maven under `app/backend-service`.
- Runtime: Java 25, Spring Boot 4.1.0.
- Persistence: Spring Data JPA plus MyBatis SQL-first persistence for migrated boundaries such as ProviderOperation, Chapter, and Project, backed by PostgreSQL and Flyway. PostgreSQL remains authoritative for durable business and execution state.
- Redis: Spring Data Redis provides non-authoritative abuse-control/delivery/cache/progress infrastructure, while Spring Session Data Redis stores authenticated HTTP session state.
- Architecture: modular monolith with extraction-oriented feature boundaries plus a separate Python asynchronous AI/media worker.

## Feature/dependency rules

A business feature owns its API, application, domain and infrastructure vertical slice. Feature domains do not import other business feature domains; cross-feature application dependencies use explicit application contracts/ports. Controllers belong to the feature that owns the use case. Domain aggregates do not call repositories, Redis, object storage, provider SDKs or worker runtimes directly.

## Current aggregate classification

| Feature | Aggregate roots | Entities/state |
|---|---|---|
| project | `Project` | `StoryVersion` |
| character | `Character`, `ProjectCharacter` | `CharacterVersion`, appearance/outfit/reference foundations |
| generation | `GenerationJob`, `OperationPlan` | `ProviderOperation`, `StageAttempt` |
| storyboard | `Chapter`, `Scene` | `VisualBeat` |

Chapter and Scene are independent aggregate roots. Chapter owns Chapter-level source/title/order behavior; Scene owns Scene-level mutable lifecycle and VisualBeat children.

## Chapter analysis boundary

- Creating a Project is metadata-only and never implicitly starts AI/media work.
- Chapter source is persisted before analysis.
- Analysis is explicitly requested through `POST /api/v1/projects/{projectId}/chapters/{chapterId}/analysis-jobs`.
- Backend reloads persisted Chapter state and performs safety/entitlement/quota/estimated-cost admission before durable enqueue.
- Durable enqueue persists `OperationPlan`, `GenerationJob`, `StageAttempt` and outbox state before worker execution.
- Redis generation hints are non-authoritative.
- Worker validates the persisted Chapter snapshot before result materialization.

The Chapter Analyze endpoint is an implemented durable foundation; older scaffold-only documentation is historical and not current implementation status.

## Durable generation model

```text
OperationPlan
    -> GenerationJob
        -> StageAttempt
            -> ProviderOperation
```

Provider requests require durable lifecycle state. Ambiguous external state uses `UNKNOWN` reconciliation instead of blind retry/resubmit. Full actual-usage reconciliation and unused-reservation release remain follow-up work.

ProviderOperation, Chapter, and Project use MyBatis adapters. Their application ports are persistence-technology-neutral. MyBatis boundaries use dedicated row models and explicit PostgreSQL predicates, including `row_version` CAS for mutable writes.

Future MyBatis boundaries must extend `NarrativeXMyBatisMapper` so the shared configuration can register only explicitly opted-in mapper interfaces. XML uses explicit result maps and keeps SQL-specific JSONB/enum/timestamp mappings visible. Adapters validate affected rows for every CAS update; they do not read a Java version and then issue an unconditional update. See [ADR-0010](../decisions/ADR-0010-sql-first-mybatis-persistence-architecture.md) for the accepted SQL-first persistence decisions and their verification boundaries.

## Current continuity materialization

Chapter analysis currently materializes/reuses:

- Character / ProjectCharacter / CharacterVersion foundations;
- stable Character AI-key mappings;
- project-scoped Locations and Location AI-key mappings;
- Scene / VisualBeat;
- Scene -> ProjectCharacter relations;
- Scene -> Location references.

This is analysis-time continuity persistence. Full Character review/version-lock/reference management remains a separate incomplete workflow.

## Current API/capability foundations

- Project list/create/detail and Project Overview.
- StoryVersion and persisted Chapter CRUD/import/workspace foundations.
- Explicit Chapter Analyze and generation-job reads.
- Storyboard/VisualBeat read/review foundations.
- Character library/project-character API foundations.
- Location and Asset read/API foundations where recorded in the integration matrix.
- Job history, user quota and notification read foundations.
- Authentication/session endpoints with password auth and Google OIDC.

Backend endpoint availability does not imply every frontend surface is wired. See `FRONTEND_API_INTEGRATION_MATRIX.md`.

## Domain rules and concurrency

- Domain code remains framework-free.
- Aggregate invariants are enforced by domain factories/intent methods; application services coordinate authorization, persistence and external systems.
- Mutable aggregate writes use optimistic `row_version`/JPA `@Version` plus stale-version guards where implemented.
- Provider calls stay outside long database transactions.
