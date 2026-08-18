# ADR-0003: DDD feature boundaries and API contracts

- Status: Accepted
- Date: 2026-08-18
- Scope: Spring package structure, DDD/application boundaries, JSON transport and collection pagination
- Consolidated from the former DDD, application-boundary, envelope and pagination decisions.

## Context

The backend evolved from persistence-shaped modules into vertical feature slices. Without explicit boundaries, domain code could depend on JPA/frameworks, application code could leak Spring Data pagination, controllers could call repositories, and cross-feature coupling could become accidental.

## Decision

- The canonical package root is `com.narrativex.backend.feature` with `feature/<name>/api`, `application`, `domain` and `infrastructure` slices. `feature/common` is a small generic shared kernel, not a business god module.
- Domain code is framework-free. Aggregates/entities/enums live under domain semantics; persistence entities, repositories, mappers and adapters stay in infrastructure.
- Controllers map transport inputs to one application command/query and invoke a use case. Cross-feature calls use explicit `application.port.in` contracts. A controller belongs to the feature owning the use case; Generation owns the project analysis-job route.
- Aggregate boundaries in the current code are: Project; Character and ProjectCharacter; GenerationJob and OperationPlan. Storyboard currently has Chapter, Scene and VisualBeat persistence entities but no artificial aggregate root.
- Normal JSON success responses use `ApiResponse<T>`; collections use a cursor page inside the envelope. Application/security failures use `ErrorResponse` with stable code, status, path, correlation ID and validation details. Protocol-specific SSE, binary, redirect and actuator responses are separate contracts.
- Collection APIs use opaque cursor/keyset pagination. Project listing uses `limit` 1–100, order `(updated_at DESC, id DESC)`, fetches `limit + 1`, and is backed by `(owner_id, updated_at DESC, id DESC)`. `Page`/`Pageable` do not cross application ports.
- Ordered version allocation uses an owning-root lock plus uniqueness constraints. Mutable state uses optimistic concurrency; locked/approved/completed snapshots are immutable.

## Consequences

- Architecture tests can reject legacy package roots, framework imports in domain, misplaced controllers and cross-feature domain imports.
- Persistence and transport changes remain isolated from business invariants.
- Cursor pagination avoids growing offset scans but does not provide arbitrary page numbers or total counts.
- Existing routes and Flyway ownership remain stable while the feature boundaries become extraction-oriented.

## Consolidation note

This file is the canonical replacement for the former DDD, application-boundary, envelope and pagination records.
