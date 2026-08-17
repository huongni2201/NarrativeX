# NarrativeX Week 1 Baseline Audit

Status: PARTIAL  
Audit: W1-D1 repository audit  
Audit date: 2026-08-17  
Repository: `D:\workplace\NarrativeX`  
OS: Windows 11, PowerShell  
Branch: `main`  
HEAD: `d6760188130814c7e4654c4bdc391472e05d338c`

## Scope and integrity

This audit is repository evidence only. No production source code was refactored. Existing user changes were preserved, including the frontend changes and untracked asset/preset work already present in the worktree. Generated `target/`, `node_modules/`, `.venv/`, and test-cache outputs are not part of the audit change set.

## Runtime baseline

| Tool | Observed version | Result |
|---|---:|---|
| Java | 25.0.3 | PASS |
| Maven | 3.9.16 | PASS |
| Node.js | 26.4.0 | PASS |
| npm | 11.17.0 | PASS |
| Python | 3.12.10 | PASS |
| pip | 26.1.2 | PASS |
| Docker | 29.6.1 | PASS |
| Docker Compose | v5.2.0 | PASS |

## Initial Git baseline

The initial branch was `main` and the worktree already contained modified frontend files, branding assets, and planning/product documentation. Those changes were not reverted. The audit added only documentation under `documentation/codebase/` and `documentation/audits/`.

## Verification matrix

| Check | Result | Evidence / first actionable error |
|---|---|---|
| `git status --short --branch` | PASS | Initial user changes recorded before audit work. |
| `git branch --show-current` / `git rev-parse HEAD` | PASS | `main`; `d6760188130814c7e4654c4bdc391472e05d338c`. |
| `mvn -version` | PASS | Maven 3.9.16 with Java 25.0.3. |
| `mvnw.cmd -version` | BLOCKED | PowerShell wrapper fails at line 35 with `Cannot index into a null array`; system Maven works. |
| `docker compose config --quiet` | PASS | Compose file parses successfully. |
| `docker compose up -d --quiet-pull` | PASS | PostgreSQL 16, Redis 7, and MinIO started successfully. |
| `docker compose ps` | PASS | All three dependency containers reported healthy. |
| `mvn test` | PASS | 4 tests: 3 domain tests and 1 application context test; 0 failures/errors. |
| `mvn -DskipTests package` | PASS | `target/backend-service-0.0.1-SNAPSHOT.jar` produced. |
| Spring Boot against fresh Compose PostgreSQL | FAIL / P0 | Hibernate reports `Schema-validation: missing table [chapters]`. PostgreSQL then confirmed no `flyway_schema_history` and zero application tables. See `evidence/W1-D1_COMMAND_EVIDENCE.md`. |
| `npm ci` | BLOCKED | EPERM unlink on existing `node_modules/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node`; install could not replace a locked native binary. |
| `npm run lint` / `type-check` / `build` | BLOCKED | Local `.bin` executables were unavailable after the blocked install; no source verdict is claimed. |
| Worker dev install | PASS | Ignored `.venv` installed from `.[dev]`. |
| Worker `pytest` | PASS | 7 tests passed. |
| Worker `ruff check .` | PASS | No Ruff findings. |
| Worker `mypy src` | PASS | Strict mypy passed for 10 source files. |
| Worker `python -m narrativex_worker --dry-run` | PASS | Startup and dry-run path completed without provider calls. |

## Environment observations

- Compose publishes PostgreSQL, Redis, and MinIO ports to the host and uses local default credentials. This is acceptable only as an explicitly local profile and is unsafe if exposed beyond the developer machine.
- No real AI/provider call was made. The worker has a disabled provider adapter and the backend provider-health response explicitly reports `externalCallVerified=false`.
- The frontend verification result is environmental and inconclusive because dependency installation was blocked by a locked native binary. It is not evidence that the frontend source passes or fails its checks.

## Audit disposition

The baseline is PARTIAL. The worker and backend unit/package checks pass, but a fresh PostgreSQL environment cannot boot the backend because migrations are not applied before schema validation. Authentication also has a fail-open local mode. These remain OPEN findings and block the next phase until explicitly closed.
