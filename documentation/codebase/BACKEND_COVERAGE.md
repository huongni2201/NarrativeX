# Backend coverage policy

## Purpose

JaCoCo is a regression signal for the Spring Boot backend. Coverage work must
protect business invariants such as idempotency, snapshot identity,
authorization, transaction atomicity, provider state transitions, quota
finalization, and immutable results. Tests that only execute code without
asserting behavior do not satisfy this policy.

## Current gate and baseline

The Maven build generates the JaCoCo report and enforces the bundle line gate
during `verify`:

- Current enforced line gate: **15%**
- Baseline measured on 2026-08-21: **52.92% line** (2,274/4,297)
- Baseline measured on 2026-08-21: **37.25% branch** (510/1,369)
- Baseline measured on 2026-08-21: **51.35% instruction** (10,215/19,892)
- Test run: **167 tests passed**, including PostgreSQL/Testcontainers tests

The baseline is observational at this stage; it is not a second Maven
threshold. Thresholds are raised only after the corresponding tests and CI
verification are green, with approximately 2–5 percentage points of buffer.
The proposed progression is 35% line, 50% line, 60% line, then 70% and
75–80% long term. Branch coverage is introduced after the line gate reaches
60%.

## Reports

After a successful report phase, local artifacts are available at:

- `app/backend-service/target/site/jacoco/index.html`
- `app/backend-service/target/site/jacoco/jacoco.xml`
- `app/backend-service/target/surefire-reports/`

Backend CI uploads the JaCoCo and Surefire directories as the
`backend-verification-reports` artifact, including when verification fails.

## Scope rules

- Keep PostgreSQL/Testcontainers for PostgreSQL locking, JSONB, constraints,
  migrations, transaction, and SQL behavior.
- Do not exclude business packages to improve the percentage.
- Prefer deterministic provider fakes and explicit transaction coordination;
  do not synchronize concurrency tests with `sleep()`.
- Critical generation, storyboard concurrency, persistence, and authentication
  paths require invariant-focused tests and may receive package-specific gates
  after their baseline is stable.

## Baseline command

From `app/backend-service`:

```powershell
./mvnw.cmd --batch-mode --no-transfer-progress clean verify
```

The command requires Docker for the PostgreSQL/Testcontainers integration
tests. A coverage number is valid as the backend baseline only when the full
test suite reaches the JaCoCo report phase.
