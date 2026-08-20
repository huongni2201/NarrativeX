# NarrativeX Backend Codebase

## Runtime

- Entry point: `com.narrativex.backend.NarrativeXBackendApplication`.
- Build: Maven under `app/backend-service`.
- Runtime: Java 25, Spring Boot 4.1.0.
- Persistence: Spring Data JPA plus MyBatis SQL-first persistence for ProviderOperation, backed by PostgreSQL and Flyway. PostgreSQL remains authoritative for durable business and execution state.
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

ProviderOperation uses the MyBatis adapter by default. Its application port is
persistence-technology-neutral; the JPA adapter remains available with
`narrativex.persistence.provider-operation=jpa` during rollout. MyBatis uses a
dedicated row model and PostgreSQL CAS predicates for allowed status plus
`row_version`.

Future MyBatis boundaries must extend
`NarrativeXMyBatisMapper` so the shared configuration can register only
explicitly opted-in mapper interfaces. XML uses explicit result maps and keeps
SQL-specific JSONB/enum/timestamp mappings visible. Adapters validate affected
rows for every CAS update; they do not read a Java version and then issue an
unconditional update. See
[`PERSISTENCE_MIGRATION.md`](./PERSISTENCE_MIGRATION.md) for the migration
recipe, contract-test template and audited tracker.

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

## Authentication/session infrastructure

The browser contract is Spring Security server-managed session + CSRF for password and Google OIDC authentication. Spring Session Data Redis stores authenticated sessions. JWT access/refresh tokens are not the current browser contract.

Session loss can sign users out but must not lose PostgreSQL business state. Password login/register abuse limiting is separate Redis infrastructure.

## Database ownership

- Backend owns Flyway and JPA mappings.
- `V1__initial_schema.sql` is the consolidated development schema baseline.
- `V2__seed_demo_data.sql` contains deterministic local/demo rows.
- Released/shared migration history is forward-only.
- PostgreSQL is authoritative for durable domain/job/quota/safety state.

## Remaining backend gaps

- Full Character editing/version-lock/reference workflow.
- Approved Storyboard reset/versioning workflow.
- Complete actual-cost/usage reconciliation and unused reservation release.
- Image generation, TTS/subtitles, render/export and FinalArtifact validation.
- Broader production moderation/consent/abuse, observability and disaster-recovery evidence.

## Architecture enforcement and CI

Architecture tests enforce package/dependency direction and storyboard aggregate boundaries. Backend CI runs Maven `clean verify`, including tests, Spotless and JaCoCo. The current coverage threshold is a bootstrap quality gate, not evidence of comprehensive behavior coverage.
