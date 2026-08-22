# NarrativeX Backend Codebase

## Runtime

- Entry point: `com.narrativex.backend.NarrativeXBackendApplication`.
- Build: Maven under `app/backend-service`.
- Runtime: Java 25, Spring Boot 4.1.0.
- Persistence: MyBatis + explicit SQL is the sole production persistence boundary, backed by PostgreSQL and Flyway. The JDBC driver/DataSource remain underlying infrastructure; JPA and `JdbcTemplate` are not used by production code.
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
- Backend locks/reloads the persisted Chapter state and performs safety/entitlement/quota/estimated-cost admission before durable enqueue.
- The Chapter Workspace exposes the persisted StoryVersion moderation decision and reports `canAnalyze=false` until the decision is `SAFE`; this keeps the UI aligned with the fail-closed analysis admission gate.
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

The active generation durability path is MyBatis/explicit SQL for ProviderOperation, GenerationJob, StageAttempt, OperationPlan, MediaPlan, generation outbox enqueue/dispatch, Job History and the Chapter Analyze safety gate. Chapter, Project, StoryVersion, storyboard, characters, account/quota, auth, catalog, notifications and the account-scoped MediaAsset library are also MyBatis-backed. MediaAsset bytes use verified R2 upload intents/finalization; metadata uses PostgreSQL upload sessions, guarded lifecycle transitions, soft delete, and cursor pagination.

Application ports remain persistence-technology-neutral. MyBatis boundaries use dedicated row models and explicit PostgreSQL predicates, including `row_version` CAS for mutable writes. Future MyBatis boundaries must extend `NarrativeXMyBatisMapper` so shared configuration registers only explicitly opted-in mapper interfaces. XML uses explicit result maps and keeps SQL-specific JSONB/enum/timestamp mappings visible. Adapters validate affected rows for guarded updates rather than issuing unconditional writes after a Java-side version check. See ADR-0010 and ADR-0015 for the accepted SQL-first persistence and generation-durability migration decisions.

## Current continuity materialization

Chapter analysis currently materializes/reuses:

- Character / ProjectCharacter / CharacterVersion foundations;
- stable Character AI-key mappings;
- project-scoped Locations and Location AI-key mappings;
- Scene / VisualBeat;
- Scene -> ProjectCharacter relations;
- Scene -> Location references.

This is analysis-time continuity persistence. Full Character review/version-lock/reference management remains a separate incomplete workflow.

## Current project Character reads

The backend exposes project-scoped Character list/detail reads under `/api/v1/projects/{projectId}/characters`. The read adapter is MyBatis-backed and checks owner/project context before returning Character data. Current authoritative fields include canonical/project aliases, role, importance, groups, pinned CharacterVersion data, appearance state and scene count.

Avatar/asset counts, relationship graphs and detailed scene participation are not fabricated when no authoritative read model exists.

## Current API/capability foundations

- Project list/create/detail, dashboard/favorite and Project Overview.
- StoryVersion and persisted Chapter CRUD/import/workspace foundations.
- Explicit Chapter Analyze and generation-job reads.
- Storyboard/VisualBeat read/review foundations.
- Global Character library plus project-scoped Character list/detail read foundations.
- Location and Asset read/API foundations where recorded in the integration matrix.
- Job history, user quota and notification read foundations.
- Authentication/session endpoints with password auth and Google OIDC.
- New password and Google accounts receive the default `NORMAL v1` plan assignment transactionally; the Flyway baseline also provisions the default assignment for existing accounts that have none.

Backend endpoint availability does not imply every frontend surface is wired. Project Character list/detail is an exception: that vertical slice is wired end to end. See `FRONTEND_API_INTEGRATION_MATRIX.md`.

## Domain rules and concurrency

- Domain code remains framework-free.
- Aggregate invariants are enforced by domain factories/intent methods; application services coordinate authorization, persistence and external systems.
- Mutable aggregate writes use guarded `row_version` CAS predicates in explicit SQL.
- Provider calls stay outside long database transactions.

## MVP media generation boundary

`CHAPTER_GENERATE` creates an executable, revision-pinned `MediaPlan` and one
`MediaGenerationItem` per reviewed VisualBeat. Each item carries a request fingerprint and separate
execution/review status. `CHAPTER_RENDER` remains a separate command and must consume the pinned plan
revision. The consolidated V1 baseline includes the execution-item and append-only asset-lineage persistence contract; provider SDKs
remain worker/infrastructure concerns and are not imported by backend domain code.
