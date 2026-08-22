# ADR-0010: SQL-first MyBatis persistence architecture and aggregate boundaries

- Status: Accepted
- Date: 2026-08-20 (consolidated and updated: 2026-08-21)
- Scope: Standard persistence architecture across backend aggregates, shared MyBatis conventions, optimistic locking, and the completed production migration from JPA/JdbcTemplate to MyBatis.
- Consolidated from: former ADR-0014, ADR-0015, ADR-0017, and ADR-0020.

## Context

NarrativeX is a modular monolith backed authoritatively by PostgreSQL. Originally, persistence was implemented using Spring Data JPA and Hibernate, which obscured SQL execution, made optimistic locking and CAS predicates implicit, and created runtime impedance mismatches with the Python AI worker's PostgreSQL commands.

To establish clear, auditable SQL behavior and predictable transaction boundaries, NarrativeX adopted a SQL-first persistence strategy using MyBatis while keeping application and domain layers persistence-technology-neutral.

## Decision

### 1. Architectural Conventions & Boundary Isolation

- **Technology-Neutral Ports:** Domain and application code interact only with repository interfaces (e.g. `ChapterRepository`, `ProjectRepository`, `ProviderOperationRepository`). They never import JPA, Hibernate, JDBC template, or MyBatis classes.
- **MyBatis Configuration:** All mappers extend `NarrativeXMyBatisMapper` and are automatically scanned under `com.narrativex.backend.feature`.
- **Dedicated Row Models:** Each feature keeps dedicated row models (e.g., `ChapterRow`, `ProjectRow`, `ProviderOperationRow`) and XML mappers (e.g., `ChapterMapper.xml`). JPA entities are never reused for MyBatis mapping.
- **Shared Connection & Transaction:** MyBatis participates directly in Spring's JDBC-backed `DataSourceTransactionManager` and shares the application HikariCP `DataSource`. It does not create separate connection pools; the JDBC driver is an implementation detail below the mapper boundary.
- **Explicit Result Maps:** Global `map-underscore-to-camel-case` is disabled; all column-to-property mappings are declared explicitly in XML.

### 2. Optimistic Concurrency & CAS Predicates

- **Version-Checked Updates:** Updates explicitly test `WHERE id = #{id} AND row_version = #{expectedRowVersion}`.
- **Affected Row Validation:** Repository adapters verify `affectedRows == 1`. If zero rows are returned, the adapter immediately raises the boundary's domain optimistic concurrency conflict exception.

### 3. Boundary Implementation Details

- **`ProviderOperation` Boundary:**
  - Full CAS transitions (`WHERE id = #{id} AND status = #{expectedStatus} AND row_version = #{expectedVersion}`).
  - Persists normalized JSON and `result_fingerprint` atomically on `COMPLETED`.
  - Stale worker callbacks lose on version conflict.
- **`Chapter` Boundary:**
  - Manages source text, UTF-8 source hashing, and deterministic `(order_index, id)` ordering.
  - Implements optimistic CAS on `row_version`.
- **`Project` Boundary:**
  - Manages Project aggregate roots, deterministic `(updated_at DESC, id DESC)` cursor pagination, and ownership verification in SQL.
  - Keeps Project overview and resource queries isolated in `ProjectQueryMapper.xml`.

## Invariants

1. Domain aggregates never import persistence framework packages.
2. Updates on mutable state always use explicit `row_version` CAS in SQL.
3. All durable application persistence operations use MyBatis within one PostgreSQL transaction boundary.
4. Database integration tests run against PostgreSQL in Testcontainers (H2 is not accepted as compatibility evidence).

## Consequences

- Direct observability and reviewability of all database queries and indexing patterns.
- Clear alignment with the Python worker's PostgreSQL repository operations.
- Clean isolation between transaction boundaries, query models, and domain aggregates.
