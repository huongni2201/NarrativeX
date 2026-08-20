# ADR-0015: Shared MyBatis persistence conventions

## Status

Accepted — 2026-08-20

## Context

NarrativeX is a modular monolith with PostgreSQL as the authoritative store.
ProviderOperation has established a SQL-first MyBatis adapter while the other
persistence boundaries still use JPA or JDBC. Incremental migration needs a
repeatable boundary that does not duplicate mapper configuration, transaction
setup or PostgreSQL integration-test infrastructure.

## Decision

- Keep application repository ports technology-neutral. Domain and application
  code must not import JPA, MyBatis, persistence entities or row models.
- Register MyBatis through the shared
  `MyBatisPersistenceConfiguration`, scanning only interfaces that extend
  `NarrativeXMyBatisMapper` under `com.narrativex.backend.feature`.
- Keep each MyBatis aggregate under its feature infrastructure boundary:
  `adapter`, `mybatis` mapper/row classes and `resources/mybatis/<Mapper>.xml`.
  A `XxxRow` belongs only to the MyBatis adapter; a `XxxJpaEntity` belongs only
  to the JPA adapter.
- Keep SQL in XML with explicit `resultMap` mappings. The global
  `map-underscore-to-camel-case` setting remains disabled. JSONB, enum,
  timestamp and fingerprint mappings stay explicit until multiple real use
  cases justify a focused abstraction.
- Put compare-and-set predicates in SQL. Updates must check the expected
  `row_version` (and allowed state where applicable), validate `affected rows`
  in the adapter and raise the boundary's optimistic-concurrency conflict on
  zero rows.
- Use explicit domain-semantic mapper methods such as `transition`, `claim`,
  `reserve` or `reconcile`; do not introduce a generic MyBatis repository or
  mini-ORM abstraction.
- Use `INSERT ... RETURNING` for normal inserts, idempotent
  `ON CONFLICT DO NOTHING RETURNING` followed by an existing-row lookup for
  reservations, and `ON CONFLICT DO UPDATE` only when the domain operation is a
  true upsert.
- Let use cases and repository adapters participate in Spring-managed
  transactions. MyBatis uses the application's existing DataSource and
  transaction strategy; it must not create another pool, DataSource or
  `SqlSessionFactory`.
- Use PostgreSQL Testcontainers for persistence, concurrency, locking, JSONB
  and PostgreSQL-specific SQL evidence. H2 remains available for lightweight
  tests but is not compatibility evidence for MyBatis SQL.
- Keep JPA and MyBatis adapter selection per persistence boundary using
  `narrativex.persistence.<boundary>=mybatis|jpa`. The default adapter must be
  explicit in tests, and a rollback selection test must prove exactly one
  implementation is active.

## Consequences

### Positive

- A new repository can follow one documented migration recipe.
- SQL mappings, CAS behavior and affected-row handling are reviewable.
- JPA and MyBatis writes share one DataSource and rollback boundary during the
  migration period.
- PostgreSQL integration tests share infrastructure without sharing business
  fixtures.

### Negative

- XML and row mapping are more verbose than convention-based mapping.
- JPA and MyBatis adapters may temporarily coexist for one boundary.
- Each migrated boundary still owns its semantic SQL and contract tests.

## Scope and non-goals

This decision introduces the shared foundation only. It does not migrate
Chapter, GenerationJob or Outbox, change database schema or indexes, remove
JPA/H2, generalize JSONB handling or add generic repository abstractions.

## Verification

- `ProviderOperationRepositoryIntegrationTest` keeps the PostgreSQL lifecycle,
  idempotency and concurrency assertions.
- `ProviderOperationDefaultPersistenceSelectionTest` proves the absent-property
  default and exactly one MyBatis adapter.
- `ProviderOperationPersistenceSelectionTest` proves the explicit JPA rollback
  switch and exactly one adapter.
- `JpaMyBatisTransactionIntegrationTest` proves JPA-first and MyBatis-first
  writes roll back together through the shared Spring transaction boundary.
