# Backend coverage policy

## Purpose

JaCoCo is a regression signal for the Spring Boot backend. Coverage work must protect business invariants such as idempotency, snapshot identity, authorization, transaction atomicity, provider state transitions, quota finalization, guest ownership transfer, storyboard/continuity materialization and immutable results. Tests that only execute code without asserting behavior do not satisfy this policy.

## Current enforced gate

`app/backend-service/pom.xml` is authoritative for the numeric threshold. At audited code checkpoint `2c965b2e95ddcc1e03dc5527340c6adb18cdd05e` it contains:

```text
jacoco.minimum.line.coverage = 0.35
```

The Maven `verify` lifecycle therefore requires at least **35% bundle line coverage**. Do not duplicate a historical measured percentage or test count here as if it were current; those values change with normal development and should be read from the generated report for the commit being evaluated.

If `pom.xml` changes the threshold after the documented checkpoint, documentation must be resynchronized rather than silently leaving this file stale.

Coverage is a floor, not a substitute for invariant-focused tests. Raise the floor only when tests are stable and the full PostgreSQL/Testcontainers verification retains reasonable headroom.

## Reports

After a successful report phase:

- `app/backend-service/target/site/jacoco/index.html`
- `app/backend-service/target/site/jacoco/jacoco.xml`
- `app/backend-service/target/surefire-reports/`

If hosted CI is unavailable or runner/account limits prevent execution, the local `verify` result is the required development signal; do not claim a remote CI result that did not execute.

## Scope rules

- Keep PostgreSQL/Testcontainers for PostgreSQL locking, JSONB, constraints, migrations, transaction and SQL behavior.
- Keep architecture/schema-reference tests around Flyway and MyBatis boundaries.
- Do not exclude business packages merely to improve percentage.
- Prefer deterministic provider fakes and explicit transaction coordination; do not synchronize concurrency tests with arbitrary sleeps.
- Critical generation, storyboard/continuity, persistence, guest/authentication, ownership-transfer and local-execution paths require behavior assertions, not only line execution.
- New VisualBeat source/timing reconciliation work must test UTF-16 source spans, stale source hash rejection, alignment projection/normalization and timing-state semantics rather than merely increasing coverage.

## Local verification

From `app/backend-service`:

```powershell
./mvnw.cmd --batch-mode --no-transfer-progress clean verify
```

Docker is required for PostgreSQL/Testcontainers integration tests. A coverage value is a valid backend baseline only when the full verification lifecycle reaches the JaCoCo report/check phase.

Repository-level verification also runs documentation governance/checkpoint guards so runtime code cannot advance past the audited docs checkpoint unnoticed.
