# Backend coverage policy

## Purpose

JaCoCo is a regression signal for the Spring Boot backend. Coverage work must protect business invariants such as idempotency, snapshot identity, authorization, transaction atomicity, provider state transitions, quota finalization, guest ownership transfer and immutable results. Tests that only execute code without asserting behavior do not satisfy this policy.

## Current enforced gate

`app/backend-service/pom.xml` is authoritative for the numeric threshold. At the 2026-08-26 documentation checkpoint it enforces:

```text
jacoco.minimum.line.coverage = 0.35
```

That means the Maven `verify` lifecycle requires at least **35% bundle line coverage**. Do not duplicate a historical measured percentage or test count here as if it were current; those values change with normal development and should be read from the generated report for the commit being evaluated.

The threshold should be raised only after invariant-focused tests are stable and the full PostgreSQL/Testcontainers verification remains green with reasonable headroom.

## Reports

After a successful report phase:

- `app/backend-service/target/site/jacoco/index.html`
- `app/backend-service/target/site/jacoco/jacoco.xml`
- `app/backend-service/target/surefire-reports/`

If CI is unavailable or account/runner limits prevent GitHub Actions from running, the local `verify` result is the required development signal; do not claim a remote CI result that did not execute.

## Scope rules

- Keep PostgreSQL/Testcontainers for PostgreSQL locking, JSONB, constraints, migrations, transaction and SQL behavior.
- Keep architecture/schema-reference tests around Flyway and MyBatis boundaries.
- Do not exclude business packages merely to improve the percentage.
- Prefer deterministic provider fakes and explicit transaction coordination; do not synchronize concurrency tests with arbitrary sleeps.
- Critical generation, storyboard concurrency, persistence, guest/authentication, ownership-transfer and local-execution paths require behavior assertions, not only line execution.
- Treat coverage as a floor, not a substitute for state-machine, authorization, idempotency and concurrency tests.

## Local verification

From `app/backend-service`:

```powershell
./mvnw.cmd --batch-mode --no-transfer-progress clean verify
```

Docker is required for the PostgreSQL/Testcontainers integration tests. A coverage value is a valid backend baseline only when the full verification lifecycle reaches the JaCoCo report/check phase.
