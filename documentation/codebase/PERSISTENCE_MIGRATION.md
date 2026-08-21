# Persistence migration tracker — V1.11

Strategic target: **MyBatis + explicit SQL + PostgreSQL**. JPA/JDBC coexist only while migration is in progress.

| Boundary | Current implementation | Target / priority |
|---|---|---|
| ProviderOperation | MyBatis default; rollback adapter may exist where documented | DONE foundation |
| Chapter | MyBatis only | DONE |
| Project command/query persistence | MyBatis | DONE |
| StoryVersion | JPA | NEXT |
| GenerationJob / StageAttempt / OperationPlan / MediaPlan legacy persistence | MyBatis + explicit SQL | DONE for generation execution boundaries |
| Generation outbox | MyBatis + explicit SQL; dispatcher JDBC lease remains deliberate | DONE for enqueue boundary |
| Job history / chapter-analysis safety gate | MyBatis + explicit SQL | DONE |
| Quota reservation / usage queries | JDBC/mixed | HIGH |
| Scene / VisualBeat / revisions | JPA | MEDIUM-HIGH |
| Character / ProjectCharacter / Location continuity | JPA/mixed | MEDIUM-HIGH |
| AuthUser and remaining CRUD/query ports | JPA/JDBC | later by risk |

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
- do not deepen JPA/JDBC in new persistence-heavy work without an ADR exception.

## Completion condition

JPA can be removed only when repository-bean selection/architecture tests and PostgreSQL integration tests prove no active production boundary still depends on it.

## Generation execution migration status

The generation execution persistence cutover is now protected by `ArchitectureRulesTest` and
`GenerationDurablePersistenceIntegrationTest`. The active adapters for GenerationJob,
StageAttempt, OperationPlan, GenerationOutbox, JobHistory, ChapterAnalysisSafetyGate, and
MediaPlan use dedicated MyBatis rows and XML mappers. The outbox dispatcher still uses
`JdbcTemplate` for its short-lived claim/lease query; that is a dispatch concern, not the
durable enqueue boundary, and remains governed by the outbox dispatcher transaction tests.
