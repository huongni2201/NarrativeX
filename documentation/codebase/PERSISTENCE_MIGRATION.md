# Persistence migration tracker

This tracker records persistence boundaries audited from the current backend
source. It is intentionally boundary-oriented: a port may have JPA, JDBC and
MyBatis implementations during incremental migration, but only one default
implementation is selected at runtime.

| Boundary | Current implementation | Default | Rollback/configuration | Risk | Target |
|---|---|---|---|---|---|
| ProviderOperation | MyBatis + JPA | MyBatis | `narrativex.persistence.provider-operation=jpa` | High: lifecycle/CAS/provider ambiguity | Done / foundation proof |
| Chapter | MyBatis | MyBatis | Not available | Medium: row version and aggregate writes | Done / foundation proof |
| Scene / VisualBeat | JPA | JPA | Not available | Medium: ordering and review state | Later |
| Project | MyBatis | MyBatis | Not available | Medium: ownership, cursor ordering and versioning | Done / Project boundary |
| StoryVersion | JPA | JPA | Not available | Medium: append-only versioning and activation | Next PR |
| Character / versions / appearances | JPA | JPA | Not available | High: reusable identity and immutable versions | Later |
| GenerationJob / StageAttempt / OperationPlan | JPA | JPA | Not available | High: leases, admission and concurrency | Later |
| Generation outbox | JDBC adapter | JDBC | Not available | High: durable enqueue and dispatch | Later |
| AuthUser | JPA | JPA | Not available | High: authentication data | Later |
| Quota reservation and query boundaries | JDBC adapters | JDBC | Not available | High: atomic billing/admission | Later |
| Read/query ports | JDBC adapters and feature-specific queries | Existing adapter | Not available | Varies by query contract | Audit per boundary |

## Migration recipe

For a new boundary, keep the application port unchanged and add the following
vertical slice under the owning feature:

```text
application/port/out/XxxRepository.java
domain/entity/Xxx.java
infrastructure/persistence/
  adapter/MyBatisXxxPersistenceAdapter.java
  mybatis/XxxMapper.java
  mybatis/XxxRow.java
resources/mybatis/XxxMapper.xml
```

During migration, a JPA adapter may remain as a boundary-scoped rollback path.
The MyBatis adapter becomes default only after wiring, PostgreSQL contract and
transaction evidence pass.

## Repository contract-test template

Name the test `XxxRepositoryIntegrationTest` and extend
`PostgreSqlIntegrationTestSupport`. Keep business fixtures in the test class or
an aggregate-specific fixture, not in the shared support class.

Write-heavy repositories should cover:

- insert and find-by-id;
- update and affected-row validation;
- optimistic conflict and concurrent writer behavior;
- rollback and constraint violation;
- ordering, limit/pagination where supported; and
- the domain-specific invariant for claim, reserve, transition, complete or
  reconcile operations.

Read-only repositories should cover mapping, ordering, filters, pagination,
nulls, enums and timestamps.

## Scope guardrails

This foundation does not change tables, indexes or Flyway migrations. It does
not introduce a generic repository, custom DataSource, custom connection pool,
second `SqlSessionFactory` or a global JSONB type handler. Project query
projections are also mapped through XML so no business `JdbcTemplate` adapter
remains in the Project boundary.
