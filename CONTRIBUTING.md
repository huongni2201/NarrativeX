# Contributing to NarrativeX

## Before opening a change

1. Read `AGENTS.md` and the relevant document under `documentation/`.
2. Confirm the change against current migration status, accepted ADRs and current code. For factual AS-IS behavior, current code/migrations/tests outrank stale derived documentation.
3. Treat `app/desktop` as the only editor client. Do not introduce a browser frontend or browser-only product architecture unless a new ADR explicitly reopens that decision.
4. Keep the write scope focused and preserve unrelated worktree changes.
5. Add tests for new business rules, state transitions, contracts, security boundaries, local-storage invariants or execution lifecycle changes.

## Local checks

Run the full provider-independent local quality gate before pushing or merging:

```powershell
pwsh -File scripts/verify-local.ps1
```

Windows PowerShell can run the same command with `powershell -File scripts/verify-local.ps1`.

For faster iteration, run only the narrow checks relevant to the files being changed. These development checks do not replace the full gate:

```powershell
# Backend
cd app/backend-service
./mvnw.cmd test

# Generation service
cd ../generation-service
python -m pytest
python -m ruff check .
python -m mypy src

# Desktop
cd ../desktop
npm ci
npm test
npm run type-check
npm run build
```

Provider integrations must use deterministic fakes or mocked adapters in ordinary automated tests.

## Scope-specific rules

Read `AGENTS.md` for domain, Desktop, storage and runtime verification rules. Read `documentation/CURRENT_STATUS.md` before using older authentication or deployment instructions.

For generation-service changes, also run `python scripts/check_compute_contracts.py` from the repository root.

For docs-only changes, run `python scripts/check-docs-drift.py` and `git diff --check`, and verify edited local links. Code tests and runtime UI checks are required when implementation changes; prose-only updates do not require starting Electron. The full provider-independent gate remains required before pushing or merging.

For database changes, follow `documentation/architecture/flyway-baseline-policy.md`. Reset a database only when its data has explicitly been confirmed disposable.

## Documentation changes

Update the smallest relevant document, but update an ADR when a change crosses a client, storage, authentication, timing-authority or execution boundary. Keep `IMPLEMENTED`, `PARTIAL`, `TARGET` and `DEFERRED` distinct.

Use the [ADR index](documentation/decisions/README.md) and [current migration status](documentation/CURRENT_STATUS.md). ADR-0030 supersedes the former authentication and per-user quota model; ADR-0028/0029 define the compute boundary and ADR-0031 defines recovery semantics. Preserve earlier ADRs as historical rationale.

## Pull request checklist

- [ ] Tests and type/lint/build checks pass for changed modules.
- [ ] `python scripts/check-docs-drift.py` passes when current-state docs change.
- [ ] No secrets, provider keys, personal data, absolute local project paths or production credentials were added.
- [ ] Migrations are backward-compatible or include a documented rollout plan.
- [ ] Idempotency, retry/UNKNOWN behavior, ownership, lease loss and optimistic-lock behavior are covered where relevant.
- [ ] Desktop preload/main security boundaries remain narrow.
- [ ] Documentation and contract versions match the implementation.
