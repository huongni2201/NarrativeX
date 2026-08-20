# NarrativeX Backend Codebase

## Runtime

- Entry point: `com.narrativex.backend.NarrativeXBackendApplication`.
- Build: Maven under `app/backend-service`.
- Runtime: Java 25, Spring Boot 4.1.0.
- Persistence: Spring Data JPA + PostgreSQL + Flyway. PostgreSQL remains authoritative for durable business and execution state.
- Redis: Spring Data Redis provides non-authoritative abuse-control/delivery/cache/progress infrastructure, while Spring Session Data Redis stores authenticated HTTP session state.
- Architecture: modular monolith with extraction-oriented feature boundaries plus a separate Python asynchronous AI/media worker.

## Standard feature layout

```text
feature/
  common/
    api/
    domain/
    pagination/
    exception/
    infrastructure/persistence/
    response/

  <feature>/
    api/
      controller/
      request/
      response/
    application/
      command/
      query/
      service/
      usecase/
      port/in/
      port/out/
    domain/
      aggregate/
      entity/
      enums/
      exception/
    infrastructure/
      ...
```

`feature` is a modular-monolith package boundary, not a claim that each feature is a microservice.

## Extraction and dependency rules

- A business feature owns its API, application, domain and infrastructure vertical slice.
- A feature domain must not import another business feature's domain.
- Cross-feature application dependencies use explicit application ports.
- Controllers belong to the feature that owns the use case even when the HTTP route is nested under another resource.
- Application use cases return application/domain results, not HTTP response envelopes or servlet types.
- `feature/common` is a deliberately small shared kernel and must not become a business-policy dumping ground.
- Domain aggregates do not call repositories, Redis, object storage, provider SDKs or worker runtimes directly.

## Current aggregate classification

| Feature | Aggregate roots | Entities |
|---|---|---|
| project | `Project` | `StoryVersion` |
| character | `Character`, `ProjectCharacter` | `CharacterVersion`, `CharacterAppearance`, `OutfitVersion` |
| generation | `GenerationJob`, `OperationPlan` | `ProviderOperation`, `StageAttempt` |
| storyboard | `Chapter`, `Scene` | `VisualBeat` |

Storyboard deliberately uses separate Chapter and Scene aggregate boundaries. Chapter owns chapter-level source/title/order behavior. Scene owns scene-level mutable state and lifecycle so independent user/worker updates do not contend on one Chapter version. VisualBeat remains a child entity. See ADR-0007.

## Chapter analysis boundary

- Creating a Project is metadata-only and never implicitly starts AI/media work.
- Chapter source is persisted before analysis.
- Analysis is explicitly requested through `POST /api/v1/projects/{projectId}/chapters/{chapterId}/analysis-jobs`.
- The backend reloads persisted Chapter state and performs admission checks before durable enqueue.
- The V1.10 durable path includes safety/entitlement/quota/cost admission plus durable `OperationPlan`, `GenerationJob`, `StageAttempt` and outbox state before worker execution.
- Redis delivery/progress hints are not authoritative; queued work must remain recoverable from PostgreSQL.
- The worker validates the persisted Chapter snapshot before result materialization.

The earlier V1.8 statement that this endpoint is only a `503 FEATURE_NOT_AVAILABLE` scaffold is obsolete and must not be used as current implementation status.

## Durable generation model

```text
OperationPlan
    -> GenerationJob
        -> StageAttempt
            -> ProviderOperation
```

Provider requests require durable lifecycle state. Ambiguous external operation state must be reconciled instead of blindly retried. Full actual-usage reconciliation and unused-reservation release remain follow-up work.

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

- True roots extend `AggregateRoot`; owned entities extend `DomainEntity`.
- Domain code remains framework-free.
- Aggregate invariants are enforced by factories/intent methods; application services coordinate authorization, persistence and external systems.
- Mutable aggregate writes use optimistic `row_version`/JPA `@Version` plus detached-domain stale-version guards where implemented.
- Version creation uses correctness guards/locking; optimization must preserve uniqueness and concurrency correctness.
- Provider calls stay outside database transactions.

## Authentication/session infrastructure

The browser contract is Spring Security server-managed session + CSRF for password and Google OIDC authentication.

- Spring Session Data Redis stores authenticated sessions.
- Browser session cookie is opaque; JWT access/refresh tokens are not the current browser contract.
- Session loss can sign users out but must not lose PostgreSQL business state.
- Password login/register abuse limiting is separate Redis infrastructure.

See ADR-0004 and ADR-0008 for authentication/session decisions.

## Pagination

Collection APIs use cursor/keyset pagination where established. Framework pagination objects must not cross application ports. Stable keyset ordering and opaque cursors are preferred over offset/count navigation for large collections.

## Database ownership

- Backend owns Flyway and JPA mappings.
- `V1__initial_schema.sql` is the consolidated development schema baseline.
- `V2__seed_demo_data.sql` contains deterministic local/demo rows.
- Released/shared migration history is forward-only.
- PostgreSQL is the source of truth for durable domain/job/quota/safety state.

## Remaining backend gaps

- AI Location materialization.
- Scene -> ProjectCharacter and Scene -> Location continuity materialization.
- Full Character editing/version-lock/reference workflow.
- Approved Storyboard reset/versioning.
- Complete actual-cost/usage reconciliation.
- Image generation, TTS/subtitles, render/export and FinalArtifact validation.
- Broader production moderation/consent/abuse, observability and disaster-recovery evidence.

## Architecture enforcement and CI

Architecture tests enforce package/dependency direction and storyboard aggregate boundaries. Backend CI runs Maven `clean verify`, including tests, Spotless and JaCoCo. The current coverage threshold is a bootstrap quality gate, not evidence of comprehensive behavior coverage.

See ADR-0001 for durable execution, ADR-0002 for chapter-first workflow, ADR-0003 for DDD/package decisions, ADR-0007 for storyboard aggregate boundaries and ADR-0008 for Redis-backed sessions.
