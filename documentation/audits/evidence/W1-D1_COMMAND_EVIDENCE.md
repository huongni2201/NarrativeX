# W1-D1 Command Evidence

This file records concise, secret-free evidence from the 2026-08-17 audit. It intentionally omits credential values and full logs.

## Git and toolchain

```text
branch: main
HEAD: d6760188130814c7e4654c4bdc391472e05d338c
Java: 25.0.3
Maven: 3.9.16
Node: v26.4.0
npm: 11.17.0
Python: 3.12.10
Docker: 29.6.1
Compose: v5.2.0
```

`mvn -version` passed. `mvnw.cmd -version` failed in the PowerShell wrapper with `Cannot index into a null array` at wrapper line 35; system Maven remained usable.

## Compose dependencies

`docker compose config --quiet` passed. `docker compose up -d --quiet-pull` passed. `docker compose ps` reported:

```text
narrativex-postgres-1   postgres:16-alpine   healthy   0.0.0.0:5432->5432/tcp
narrativex-redis-1      redis:7-alpine      healthy   0.0.0.0:6379->6379/tcp
narrativex-minio-1      minio                healthy   0.0.0.0:9000-9001->9000-9001/tcp
```

## Backend verification

`mvn test` passed: 4 tests, 0 failures, 0 errors. `mvn -DskipTests package` produced the backend jar.

Starting Spring Boot against the fresh Compose PostgreSQL failed with:

```text
Schema-validation: missing table [chapters]
```

The follow-up PostgreSQL check reported:

```text
ERROR: relation "flyway_schema_history" does not exist
application table count: 0
```

This is the evidence for `NX-W1-D1-001`; it is a repository startup/migration behavior, not a claim about existing production data.

## Frontend verification

`npm ci` was attempted and could not replace the existing native Next binary:

```text
EPERM: operation not permitted, unlink ...node_modules/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node
```

Because the install did not complete, `npm run lint`, `npm run type-check`, and `npm run build` had no local `.bin` executables available. Frontend source status is therefore BLOCKED/UNKNOWN, not marked passing or failing.

## Worker verification

Using the worker's ignored local `.venv`:

```text
pytest: 7 passed
ruff check .: passed
mypy src: passed (strict, 10 files)
python -m narrativex_worker --dry-run: passed
```

The dry-run did not call an external provider. The configured disabled provider raises `ProviderNotConfiguredError` for real operations.
