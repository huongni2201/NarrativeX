# Persistence architecture — MyBatis-only production persistence

Production persistence uses **MyBatis + explicit SQL + PostgreSQL**. The PostgreSQL JDBC driver and
Spring's `DataSourceTransactionManager` remain transport/transaction infrastructure underneath
MyBatis; application persistence code does not use JPA repositories/entities or `JdbcTemplate`.

| Boundary | Current implementation | Target / priority |
|---|---|---|
| ProviderOperation | MyBatis default; rollback adapter may exist where documented | DONE foundation |
| Chapter | MyBatis only | DONE |
| Project command/query persistence | MyBatis | DONE |
| StoryVersion | MyBatis + explicit SQL | DONE |
| GenerationJob / StageAttempt / OperationPlan / MediaPlan legacy persistence | MyBatis + explicit SQL | DONE for generation execution boundaries |
| Generation outbox | MyBatis + explicit SQL for enqueue and dispatcher lease | DONE |
| Job history / chapter-analysis durable enqueue | MyBatis + explicit SQL | DONE |
| Quota reservation / usage queries | MyBatis + explicit SQL | DONE |
| Scene / VisualBeat / revisions | MyBatis + explicit SQL | DONE |
| Character / ProjectCharacter / Location continuity | MyBatis + explicit SQL for persistence boundaries | DONE |
| AuthUser and remaining CRUD/query ports | MyBatis + explicit SQL | DONE |

## Migration recipe

```text
application port stays unchanged
  -> MyBatis adapter
  -> dedicated XxxRow
  -> mapper interface extending NarrativeXMyBatisMapper
  -> explicit resources/mybatis/XxxMapper.xml
  -> PostgreSQL integration/concurrency tests
  -> cut over active bean
  -> remove old active adapter when rollback window closes
```

## Required rules

- no MyBatis/JPA types in domain/application ports;
- explicit column lists/resultMap mappings;
- semantic mapper operations (`claim`, `transition`, `reserve`, `reconcile`) instead of generic repository abstractions;
- SQL CAS via expected `row_version` and allowed state where applicable;
- zero affected rows becomes a conflict, not silent success;
- one shared Spring DataSource/transaction boundary;
- PostgreSQL Testcontainers for PostgreSQL-specific correctness;
- do not reintroduce JPA or direct JDBC-template persistence in new work without an ADR exception.

## Completion condition

The migration is complete when the build contains no JPA dependency, production source has no JPA
or `JdbcTemplate` references, and architecture tests keep that boundary enforced.

## Generation execution migration status

The generation execution persistence cutover is protected by `ArchitectureRulesTest` and
`GenerationDurablePersistenceIntegrationTest`. The active adapters for GenerationJob,
StageAttempt, OperationPlan, GenerationOutbox and JobHistory, and
MediaPlan use dedicated MyBatis rows and XML mappers. The outbox dispatcher also uses its
dedicated MyBatis mapper for claim/lease operations.
