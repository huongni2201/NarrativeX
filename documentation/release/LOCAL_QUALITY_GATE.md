# Local quality gate

`./scripts/verify-local.sh` (Linux/macOS/WSL) or `./scripts/verify-local.ps1` (PowerShell) is the merge gate while hosted CI is unavailable.

The gate stops at the first failure and protects both executable behavior and documentation freshness.

## Default merge gate

```powershell
./scripts/verify-local.ps1
```

Current steps include:

```text
secret scan
  -> documentation governance unit tests
  -> current-document drift scan
  -> documentation checkpoint freshness check
  -> Docker Compose configuration validation when Docker is available
  -> backend Maven verify (tests, Spotless, JaCoCo gate)
  -> AI worker pytest
  -> AI worker Ruff
  -> AI worker mypy
  -> Desktop npm check (tests, type-check, production build)
```

The documentation checkpoint step is intentional: current docs record the last audited application/runtime code commit. If application/runtime code changes after that checkpoint, the gate fails until affected docs are reviewed and all synchronized checkpoint references advance.

Focused documentation checks:

```powershell
python -m unittest scripts/test_check_docs_drift.py scripts/test_check_docs_checkpoint.py
python scripts/check-docs-drift.py
python scripts/check-docs-checkpoint.py
```

## Release candidate

Use the same gate and request the Windows package build:

```powershell
./scripts/verify-local.ps1 --package-win
```

Production release readiness still requires the packaging/signing/protocol/OAuth verification described in `../product/ROADMAP.md`; a successful developer package is not proof that release hardening is complete.

## Disposable database verification

Database-destructive verification is opt-in. `--with-db` refuses to run unless `NARRATIVEX_DISPOSABLE_DB=1`; if `NARRATIVEX_DB_NAME` is supplied it must visibly look local/test/tmp. Never point this gate at production or shared staging data.

```powershell
$env:NARRATIVEX_DISPOSABLE_DB="1"
$env:NARRATIVEX_DB_NAME="narrativex_test"
./scripts/verify-local.ps1 --with-db
```

NarrativeX is still pre-production, so V1-V8 are a clean development baseline. Disposable database recreation is expected when that baseline is intentionally rewritten. After the first production deployment, migration policy changes to append-only evolution.

## Evidence rules

A green local gate is evidence for a PR body, not a replacement for code review. Record:

- exact command;
- operating system/toolchain when relevant;
- whether Docker/PostgreSQL integration checks executed;
- any intentionally skipped real-provider/external integration tests;
- whether packaged runtime verification was performed for release-facing changes.

Do not claim a hosted CI, provider integration or PostgreSQL/Testcontainers result that did not actually execute.

Documentation plans/ADRs are not implementation evidence on their own. Capability status is updated in `../TRACEABILITY.md` only after current code/tests verify the behavior.
