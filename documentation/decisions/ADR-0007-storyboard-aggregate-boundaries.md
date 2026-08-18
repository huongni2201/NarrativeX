# ADR-0007: Storyboard aggregate boundaries

- Status: Accepted
- Date: 2026-08-18
- Scope: `storyboard` domain ownership, transaction boundaries, scene concurrency and lifecycle

## Context

NarrativeX edits and generates scenes independently. A chapter can contain many scenes while users, backend commands and AI workers may update different scenes concurrently. Treating the entire chapter and all of its scenes as one aggregate would create unnecessary optimistic-lock contention and would force unrelated scene generation work through one transaction boundary.

The V1.8 domain model also gives Scene its own mutable lifecycle: `DRAFT -> READY_FOR_VISUAL -> GENERATING -> REVIEW -> APPROVED`, with `FAILED` and `OUTDATED` outcomes. VisualBeat is subordinate to scene-level generation semantics.

## Decision

- Keep `storyboard` as a separate backend feature/business capability.
- `Chapter` is an `AggregateRoot` for chapter identity, StoryVersion reference, title and ordering rules.
- `Scene` is an independent `AggregateRoot` for scene identity, chapter reference, title/order, narration/duration and scene lifecycle.
- `VisualBeat` remains a child `DomainEntity` owned by scene-level behavior; it is not promoted to an aggregate merely because it has its own table.
- Aggregate references cross boundaries by stable IDs. `Scene` references `chapterId`; it does not hold a mutable Chapter object graph.
- Scene lifecycle transitions are expressed as intent-based domain methods, not arbitrary setters.
- Editing an `APPROVED` Scene invalidates the approved scene snapshot and moves the Scene to `OUTDATED`; immutable generated assets/renders are not deleted or overwritten.
- Edits are rejected while Scene is `GENERATING` or `REVIEW` unless a future explicit workflow defines a safe transition.
- Cross-aggregate orchestration remains in the application layer. Scene/Chapter aggregates must not call Redis, MinIO/S3, provider SDKs, repositories or worker runtimes directly.
- PostgreSQL `row_version`/JPA `@Version` remains the optimistic-concurrency guard for mutable aggregate writes.
- Scene status is persisted as a string enum in the consolidated Flyway V1 baseline.

## Consequences

- Workers can update independent Scene aggregates without locking an entire Chapter aggregate.
- Chapter-level commands and scene-level commands have explicit ownership boundaries.
- Storyboard read models may compose Chapter, Scene, VisualBeat, Character, Generation and Asset data without becoming a giant transactional aggregate.
- Application use cases coordinate Scene + GenerationJob + Asset behavior; domain aggregates only enforce their own invariants.
- Repositories should be created for aggregate roots when write use cases are implemented; child entities should not gain repositories merely because persistence has a table.

## Verification

- `Chapter` and `Scene` extend `AggregateRoot` and live under `storyboard/domain/aggregate`.
- `VisualBeat` extends `DomainEntity` and remains under `storyboard/domain/entity`.
- Domain tests cover valid/invalid Scene transitions and approved-scene invalidation.
- JPA persists `SceneStatus` using `EnumType.STRING`.
- Flyway adds `scenes.status` with default `DRAFT`.
