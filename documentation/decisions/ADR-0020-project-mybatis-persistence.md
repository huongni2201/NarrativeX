# ADR-0020: SQL-first Project persistence

## Status

Accepted — 2026-08-21

## Context

NarrativeX is in a deliberate JPA/MyBatis coexistence period. The Project
feature had three persistence styles: a Spring Data JPA aggregate repository,
JDBC query adapters for overview/resources, and technology-neutral application
ports. This made ownership predicates, cursor ordering and optimistic locking
harder to review as one boundary.

## Decision

- Keep `ProjectRepository`, `ProjectOverviewQueryRepository` and
  `ProjectResourceQueryRepository` unchanged at the application boundary.
- Make MyBatis the only Project aggregate implementation through
  `MyBatisProjectRepository`, `ProjectMapper`, `ProjectRow` and
  `ProjectMapper.xml`.
- Move Project overview and resource projections to
  `ProjectQueryMapper.xml`; SQL stays in XML with explicit result maps.
- Encode ownership filters, deterministic `(updated_at DESC, id DESC)` cursor
  pagination, `FOR UPDATE` locking and `row_version` compare-and-set updates in
  SQL.
- Keep `StoryVersion` on its existing JPA boundary for the next migration
  slice; Project migration must not silently expand into StoryVersion.
- Remove `ProjectJpaEntity`, `ProjectJpaRepository`, and the Project JDBC
  adapters once the MyBatis PostgreSQL contract tests pass.

## Consequences

Project application/domain code remains persistence-technology-neutral, while
the SQL behavior is visible and testable against PostgreSQL. The global JPA
dependency remains because StoryVersion and other features still use it.
Project query rows are intentionally separate from the aggregate row and do
not create nested MyBatis collections.

## Verification

- Repository integration tests cover create/read/update, timestamps, ownership,
  cursor pagination and stale `row_version` updates.
- Architecture tests ensure migrated Project adapters do not import JPA or
  JDBC APIs.
- Existing Flyway/Testcontainers migration and transaction tests remain part of
  backend verification.
