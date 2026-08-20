# ADR-0017: SQL-first Chapter persistence

## Status

Accepted — 2026-08-20

## Context

`ChapterRepository` is a real application persistence boundary with source
text, source hashing, deterministic ordering and optimistic `row_version`
semantics. The existing implementation used a Spring Data JPA entity and
repository, leaving SQL concurrency behavior implicit through Hibernate.

## Decision

- Keep `ChapterRepository` unchanged so application and domain code remain
  persistence-technology-neutral.
- Make `MyBatisChapterRepository` the only Chapter repository adapter.
- Map rows through the dedicated `ChapterRow`; never reuse `ChapterJpaEntity`.
- Keep Chapter-specific SQL in `ChapterMapper.xml` with explicit column lists,
  deterministic `(order_index, id)` ordering and cursor predicates.
- Preserve current ownership semantics: PostgreSQL generates the `BIGINT`
  identity, the application supplies audit timestamps, and new Chapters start
  at row version `0` with `DRAFT` status and zero generation progress.
- Implement updates as compare-and-set SQL on `id` and expected
  `row_version`; one affected row succeeds and zero affected rows raises an
  optimistic-lock failure.
- Keep Scene and Story relationships out of the Chapter row model. Their
  repositories remain separate boundaries.
- Use the existing Spring `DataSource` and transaction manager. No Chapter
  feature flag or second persistence configuration is introduced.

## Consequences

Chapter writes no longer depend on Hibernate dirty checking, and the source
text/source hash/version invariants are visible in SQL and PostgreSQL tests.
The global JPA dependency remains because other aggregates still use it. The
repository contract retains `save` and `saveAndFlush` for application
compatibility; with MyBatis both execute the same explicit transaction-aware
command.

## Verification

- Unit tests cover insert mapping, missing-row behavior and stale CAS updates.
- PostgreSQL Testcontainers tests cover Unicode/long-text round trips,
  deterministic ordering and cursor pagination, source-hash preservation,
  optimistic locking, transaction rollback, FK violations and unique-order
  violations.
- The Spring context test asserts that exactly one ChapterRepository bean is
  active and it is the MyBatis adapter.
