# Local quality gate

`./scripts/verify-local.sh` (Linux/macOS/WSL) or `./scripts/verify-local.ps1` (PowerShell) is the merge gate while hosted CI is unavailable.

It stops at the first failure and covers docs drift, backend Maven tests, AI-worker pytest, and Desktop test/type-check/build. Use `--package-win` before a release candidate.

Database-destructive verification is opt-in. `--with-db` refuses to run unless `NARRATIVEX_DISPOSABLE_DB=1`; if `NARRATIVEX_DB_NAME` is supplied it must visibly look local/test/tmp. Never point this gate at production or shared staging data.

Recommended pre-PR command:

```powershell
./scripts/verify-local.ps1
```

Release candidate:

```powershell
./scripts/verify-local.ps1 --package-win
```

Disposable database verification:

```powershell
$env:NARRATIVEX_DISPOSABLE_DB="1"
$env:NARRATIVEX_DB_NAME="narrativex_test"
./scripts/verify-local.ps1 --with-db
```

A green local gate is evidence for the PR body, not a replacement for code review. Record the exact command, platform, and any skipped external-provider tests.
